// DOC-DEPS: LLM.md -> docs/MAGIC_PEN_CAPTURE_SPEC.md -> src/features/chat/README.md -> src/features/growth/GrowthPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Wand2, X, Clock, CheckSquare, Trash2, Undo2 } from 'lucide-react';
import {
  errorToI18nKey,
  toTimeInput,
  fromTimeInput,
  toDateInputValue,
  fromDateInputValue,
} from './magicPenSheetHelpers';
import { alignPeriodDraftsToMessageGaps, validateDrafts } from '../../services/input/magicPenDraftBuilder';
import type { MagicPenAutoWrittenItem, MagicPenDraftItem } from '../../services/input/magicPenTypes';
import type { Message } from '../../store/useChatStore';
import { commitMagicPenDrafts } from '../../store/magicPenActions';
import { cn } from '../../lib/utils';
import {
  APP_MODAL_CARD_CLASS,
  APP_MODAL_CLOSE_CLASS,
  APP_MODAL_OVERLAY_CLASS,
  APP_MODAL_PRIMARY_BUTTON_CLASS,
  APP_MODAL_SECONDARY_BUTTON_CLASS,
} from '../../lib/modalTheme';

type CommitState = 'idle' | 'submitting' | 'success' | 'error';

interface MagicPenSheetProps {
  isOpen: boolean;
  initialDrafts: MagicPenDraftItem[];
  initialUnparsedSegments: string[];
  initialAutoWrittenItems: MagicPenAutoWrittenItem[];
  messages: Message[];
  onUndoAutoWritten: (item: MagicPenAutoWrittenItem) => Promise<void>;
  onClose: () => void;
}

export function MagicPenSheet({
  isOpen,
  initialDrafts,
  initialUnparsedSegments,
  initialAutoWrittenItems,
  messages,
  onUndoAutoWritten,
  onClose,
}: MagicPenSheetProps) {
  const { t } = useTranslation();
  const [drafts, setDrafts] = useState<MagicPenDraftItem[]>([]);
  const [unparsedSegments, setUnparsedSegments] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoWrittenItems, setAutoWrittenItems] = useState<MagicPenAutoWrittenItem[]>([]);
  const [undoingAutoWriteIds, setUndoingAutoWriteIds] = useState<Set<string>>(new Set());
  const [commitStates, setCommitStates] = useState<Map<string, CommitState>>(new Map());
  const [statusText, setStatusText] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const alignedDrafts = alignPeriodDraftsToMessageGaps(initialDrafts, messages);
    setDrafts(validateDrafts(alignedDrafts, messages));
    setUnparsedSegments(initialUnparsedSegments);
    setAutoWrittenItems(initialAutoWrittenItems);
    setUndoingAutoWriteIds(new Set());
    setCommitStates(new Map());
    setStatusText('');
  }, [isOpen, initialDrafts, initialUnparsedSegments, initialAutoWrittenItems, messages]);

  const grouped = useMemo(() => {
    const activities = drafts.filter((draft) => draft.kind === 'activity_backfill');
    const todos = drafts.filter((draft) => draft.kind === 'todo_add');
    return { activities, todos };
  }, [drafts]);

  const pendingDrafts = useMemo(
    () => drafts.filter((draft) => commitStates.get(draft.id) !== 'success'),
    [commitStates, drafts],
  );
  const failedDraftCount = pendingDrafts.filter((draft) => commitStates.get(draft.id) === 'error').length;
  const idleDraftCount = pendingDrafts.filter((draft) => (commitStates.get(draft.id) || 'idle') === 'idle').length;
  const isConfirmDisabled = pendingDrafts.length === 0 || isSubmitting;

  const resetErroredDraftState = (draftId: string) => {
    setCommitStates((prev) => {
      if (prev.get(draftId) !== 'error') return prev;
      const next = new Map(prev);
      next.set(draftId, 'idle');
      return next;
    });
  };

  const revalidateAll = (nextDrafts: MagicPenDraftItem[], editedDraftId?: string) => {
    setDrafts(validateDrafts(nextDrafts, messages));
    if (editedDraftId) resetErroredDraftState(editedDraftId);
  };

  const handleDraftDelete = (id: string) => {
    const next = drafts.filter((draft) => draft.id !== id);
    revalidateAll(next);
    setCommitStates((prev) => {
      if (!prev.has(id)) return prev;
      const updated = new Map(prev);
      updated.delete(id);
      return updated;
    });
  };

  const handleConfirm = async () => {
    const toCommit = pendingDrafts.filter((draft) => draft.content.trim());
    const validated = validateDrafts(toCommit, messages);
    const hasErrors = validated.some((draft) => draft.errors.length > 0);
    setDrafts((prev) => prev.map((item) => validated.find((draft) => draft.id === item.id) ?? item));
    if (hasErrors || validated.length === 0) {
      setStatusText(t('chat_magic_pen_item_error'));
      return;
    }

    const nextStates = new Map(commitStates);
    for (const draft of validated) nextStates.set(draft.id, 'submitting');
    setCommitStates(nextStates);
    setIsSubmitting(true);
    setStatusText('');
    try {
      const result = await commitMagicPenDrafts(validated);
      const failed = new Set(result.failedDraftIds);
      setCommitStates((prev) => {
        const updated = new Map(prev);
        for (const draft of validated) {
          updated.set(draft.id, failed.has(draft.id) ? 'error' : 'success');
        }
        return updated;
      });

      if (result.failedDraftIds.length === 0) {
        setStatusText(
          t('chat_magic_pen_success_summary', {
            activityCount: result.successActivityCount,
            todoCount: result.successTodoCount,
          }),
        );
        onClose();
        return;
      }
      setStatusText(t('chat_magic_pen_partial_success'));
    } catch {
      setCommitStates((prev) => {
        const updated = new Map(prev);
        for (const draft of validated) updated.set(draft.id, 'error');
        return updated;
      });
      setStatusText(t('chat_magic_pen_item_error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUndoAutoWrite = async (item: MagicPenAutoWrittenItem) => {
    if (!item.messageId) return;
    setUndoingAutoWriteIds((prev) => new Set(prev).add(item.id));
    try {
      await onUndoAutoWritten(item);
      setAutoWrittenItems((prev) => prev.filter((entry) => entry.id !== item.id));
    } finally {
      setUndoingAutoWriteIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={cn('fixed inset-0 z-50 flex items-center justify-center p-4', APP_MODAL_OVERLAY_CLASS)}
      onClick={onClose}
    >
      <div
        className={cn(APP_MODAL_CARD_CLASS, 'w-[min(92vw,420px)] overflow-y-auto rounded-3xl animate-in zoom-in-95 fade-in max-h-[86vh]')}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white px-5 pt-5 pb-3 border-b border-[rgba(255,255,255,0.82)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#DBEAFE] border border-[#BFDBFE]">
                <Wand2 size={16} className="text-[#2563EB]" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-800">{t('chat_magic_pen_title')}</h2>
                <p className="text-xs text-slate-500">{t('chat_magic_pen_subtitle')}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className={cn(APP_MODAL_CLOSE_CLASS, 'p-1.5')}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-4">
          {/* Activities */}
          {grouped.activities.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-[#9C8567]">
                <Clock size={12} />
                <span>{t('chat_magic_pen_group_activity')}</span>
              </div>
              {grouped.activities.map((draft) => {
                const commitState = commitStates.get(draft.id) || 'idle';
                const editable = commitState !== 'success';
                const isEstimated = draft.needsUserConfirmation;
                const hasError = draft.errors.length > 0;
                return (
                  <div
                    key={draft.id}
                    className={`rounded-xl p-3 space-y-2 transition-colors ${
                      commitState === 'success'
                        ? 'bg-sky-50 border border-sky-200'
                        : hasError
                          ? 'bg-red-50/50 border border-red-200'
                          : 'bg-white border border-[#EDE5D8]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={draft.content}
                        disabled={!editable}
                        onChange={(event) => {
                          const next = { ...draft, content: event.target.value };
                          setDrafts((prev) => prev.map((item) => (item.id === next.id ? next : item)));
                          resetErroredDraftState(draft.id);
                        }}
                        className="flex-1 text-sm font-medium text-[#4A3520] bg-transparent px-0 py-0.5 border-none outline-none placeholder:text-[#C4B49A]"
                      />
                      {editable && (
                        <button
                          type="button"
                          onClick={() => handleDraftDelete(draft.id)}
                          className="p-1 rounded hover:bg-red-50 text-[#C4B49A] hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="time"
                        disabled={!editable}
                        value={toTimeInput(draft.activity?.startAt)}
                        onChange={(event) => {
                          const startAt = fromTimeInput(event.target.value, draft.activity?.startAt);
                          if (startAt === undefined) return;
                          const next: MagicPenDraftItem = {
                            ...draft,
                            needsUserConfirmation: false,
                            activity: { ...draft.activity!, startAt, timeResolution: 'exact' as const },
                          };
                          revalidateAll(drafts.map((item) => (item.id === draft.id ? next : item)), draft.id);
                        }}
                        className={`w-[90px] px-2 py-1 text-xs rounded-lg border text-center ${
                          isEstimated ? 'border-dashed border-amber-400 bg-amber-50/50' : 'border-[#E0D6C8] bg-[#FAFAF7]'
                        }`}
                      />
                      <span className="text-[#C4B49A] text-xs">—</span>
                      <input
                        type="time"
                        disabled={!editable}
                        value={toTimeInput(draft.activity?.endAt)}
                        onChange={(event) => {
                          const endAt = fromTimeInput(event.target.value, draft.activity?.endAt);
                          if (endAt === undefined) return;
                          const next: MagicPenDraftItem = {
                            ...draft,
                            needsUserConfirmation: false,
                            activity: { ...draft.activity!, endAt, timeResolution: 'exact' as const },
                          };
                          revalidateAll(drafts.map((item) => (item.id === draft.id ? next : item)), draft.id);
                        }}
                        className={`w-[90px] px-2 py-1 text-xs rounded-lg border text-center ${
                          isEstimated ? 'border-dashed border-amber-400 bg-amber-50/50' : 'border-[#E0D6C8] bg-[#FAFAF7]'
                        }`}
                      />
                      {isEstimated && (
                        <span className="text-xs text-amber-600 ml-1">{t('chat_magic_pen_estimated_time')}</span>
                      )}
                    </div>
                    {draft.errors.map((error) => (
                      <p key={error} className="text-xs text-red-500">{t(errorToI18nKey(error))}</p>
                    ))}
                    {commitState === 'success' && (
                      <p className="text-xs text-sky-600">{t('chat_magic_pen_item_success')}</p>
                    )}
                    {commitState === 'error' && (
                      <p className="text-xs text-red-500">{t('chat_magic_pen_item_error')}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Todos */}
          {grouped.todos.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-[#9C8567]">
                <CheckSquare size={12} />
                <span>{t('chat_magic_pen_group_todo')}</span>
              </div>
              {grouped.todos.map((draft) => {
                const commitState = commitStates.get(draft.id) || 'idle';
                const editable = commitState !== 'success';
                return (
                  <div
                    key={draft.id}
                    className={`rounded-xl p-3 space-y-2 transition-colors ${
                      commitState === 'success'
                        ? 'bg-sky-50 border border-sky-200'
                        : 'bg-white border border-[#EDE5D8]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={draft.content}
                        disabled={!editable}
                        onChange={(event) => {
                          const next = { ...draft, content: event.target.value };
                          setDrafts((prev) => prev.map((item) => (item.id === next.id ? next : item)));
                          resetErroredDraftState(draft.id);
                        }}
                        className="flex-1 text-sm font-medium text-[#4A3520] bg-transparent px-0 py-0.5 border-none outline-none placeholder:text-[#C4B49A]"
                      />
                      {editable && (
                        <button
                          type="button"
                          onClick={() => handleDraftDelete(draft.id)}
                          className="p-1 rounded hover:bg-red-50 text-[#C4B49A] hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    {draft.todo?.dueDate && (
                      <div className="flex items-center gap-1.5">
                        <Clock size={11} className="text-[#C4B49A]" />
                        <input
                          type="date"
                          disabled={!editable}
                          value={toDateInputValue(draft.todo.dueDate)}
                          onChange={(event) => {
                            const dueDate = fromDateInputValue(event.target.value);
                            const next = { ...draft, todo: { ...draft.todo!, dueDate } };
                            setDrafts((prev) => prev.map((item) => (item.id === next.id ? next : item)));
                          }}
                          className="text-xs text-[#7A6B55] bg-[#FAFAF7] border border-[#E0D6C8] rounded-lg px-2 py-1"
                        />
                      </div>
                    )}
                    {commitState === 'success' && (
                      <p className="text-xs text-sky-600">{t('chat_magic_pen_item_success')}</p>
                    )}
                    {commitState === 'error' && (
                      <p className="text-xs text-red-500">{t('chat_magic_pen_item_error')}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Auto-written items */}
          {autoWrittenItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-[#9C8567]">
                <span>{t('chat_magic_pen_group_auto_written')}</span>
              </div>
              {autoWrittenItems.map((item) => {
                const isUndoing = undoingAutoWriteIds.has(item.id);
                return (
                  <div key={item.id} className="rounded-xl bg-sky-50/80 border border-sky-200/70 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-sky-800 flex-1">{item.content}</p>
                      {item.messageId && (
                        <button
                          type="button"
                          disabled={isUndoing}
                          onClick={() => handleUndoAutoWrite(item)}
                          className="p-1 rounded hover:bg-sky-100 text-sky-600 disabled:opacity-50 transition-colors"
                        >
                          <Undo2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Unparsed segments */}
          {unparsedSegments.length > 0 && (
            <div className="rounded-xl bg-[#F5F0EA] p-3">
              <p className="text-xs text-[#9C8567] mb-1">{t('chat_magic_pen_unparsed_hint')}</p>
              {unparsedSegments.map((segment) => (
                <p key={segment} className="text-xs text-[#7A6B55]">· {segment}</p>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white px-5 pb-5 pt-3 border-t border-[rgba(255,255,255,0.82)]">
          {statusText && <p className="text-xs text-center text-[#2563EB] mb-2">{statusText}</p>}
          <div className="flex gap-3">
            {pendingDrafts.length > 0 && (
              <button
                type="button"
                onClick={onClose}
                className={cn(APP_MODAL_SECONDARY_BUTTON_CLASS, 'flex-1 py-2.5 text-sm')}
              >
                {t('chat_magic_pen_cancel')}
              </button>
            )}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={pendingDrafts.length === 0 ? onClose : handleConfirm}
              className={cn(APP_MODAL_PRIMARY_BUTTON_CLASS, 'flex-1 py-2.5 text-sm font-medium disabled:opacity-40')}
            >
              {isSubmitting
                ? t('loading')
                : pendingDrafts.length === 0
                  ? t('chat_magic_pen_cancel')
                  : failedDraftCount > 0 && idleDraftCount === 0
                    ? t('chat_magic_pen_retry_failed')
                    : t('chat_magic_pen_confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
