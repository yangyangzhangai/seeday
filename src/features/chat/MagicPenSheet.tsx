// DOC-DEPS: LLM.md -> docs/MAGIC_PEN_CAPTURE_SPEC.md -> src/features/chat/README.md -> src/features/growth/GrowthPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Wand2, X } from 'lucide-react';
import {
  errorToI18nKey,
  fromDateTimeLocal,
  toDateTimeLocal,
} from './magicPenSheetHelpers';
import { alignPeriodDraftsToMessageGaps, validateDrafts } from '../../services/input/magicPenDraftBuilder';
import type { MagicPenAutoWrittenItem, MagicPenDraftItem } from '../../services/input/magicPenTypes';
import type { Message } from '../../store/useChatStore';
import { commitMagicPenDrafts } from '../../store/magicPenActions';

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

  const upsertDraft = (next: MagicPenDraftItem) => {
    setDrafts((prev) => prev.map((item) => (item.id === next.id ? next : item)));
    resetErroredDraftState(next.id);
  };

  const revalidateAll = (nextDrafts: MagicPenDraftItem[], editedDraftId?: string) => {
    setDrafts(validateDrafts(nextDrafts, messages));
    if (editedDraftId) {
      resetErroredDraftState(editedDraftId);
    }
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

  const handleToggleKind = (draft: MagicPenDraftItem) => {
    if (draft.kind === 'activity_backfill') {
      upsertDraft({
        ...draft,
        kind: 'todo_add',
        activity: undefined,
        todo: { priority: 'important-not-urgent', scope: 'daily' },
        needsUserConfirmation: false,
        errors: [],
      });
      return;
    }
    const nowMs = Date.now();
    upsertDraft({
      ...draft,
      kind: 'activity_backfill',
      todo: undefined,
      activity: { timeResolution: 'missing', startAt: nowMs - 30 * 60 * 1000, endAt: nowMs },
      needsUserConfirmation: true,
      errors: [],
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
        for (const draft of validated) {
          updated.set(draft.id, 'error');
        }
        return updated;
      });
      setStatusText(t('chat_magic_pen_item_error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUndoAutoWrite = async (item: MagicPenAutoWrittenItem) => {
    if (!item.messageId) {
      return;
    }
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
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-2xl p-6 space-y-4 animate-in slide-in-from-bottom-10 fade-in max-h-[85vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Wand2 size={18} className="text-blue-600" />
              {t('chat_magic_pen_title')}
            </h2>
            <p className="text-xs text-gray-500 mt-1">{t('chat_magic_pen_subtitle')}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={20} />
          </button>
        </div>

        {grouped.activities.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-gray-500">{t('chat_magic_pen_group_activity')}</p>
            {grouped.activities.map((draft) => {
              const commitState = commitStates.get(draft.id) || 'idle';
              const editable = commitState !== 'success';
              const highlightTime = draft.needsUserConfirmation;
              return (
                <div key={draft.id} className="border border-gray-200 rounded-xl p-3 space-y-2 bg-white">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={draft.content}
                      disabled={!editable}
                      onChange={(event) => upsertDraft({ ...draft, content: event.target.value })}
                      className="flex-1 text-base px-2 py-1 border border-gray-300 rounded-md outline-none"
                    />
                    <button
                      type="button"
                      disabled={!editable}
                      onClick={() => handleToggleKind(draft)}
                      className="text-xs px-2 py-1 rounded-md border border-gray-300"
                    >
                      {t('chat_magic_pen_switch_kind')}
                    </button>
                    <button
                      type="button"
                      disabled={!editable}
                      onClick={() => handleDraftDelete(draft.id)}
                      className="text-xs px-2 py-1 rounded-md border border-red-200 text-red-500"
                    >
                      {t('delete')}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <input
                      type="datetime-local"
                      disabled={!editable}
                      value={toDateTimeLocal(draft.activity?.startAt)}
                      onChange={(event) => {
                        const startAt = fromDateTimeLocal(event.target.value);
                        const next = {
                          ...draft,
                          needsUserConfirmation: false,
                          activity: { ...draft.activity!, startAt, timeResolution: 'exact' as const },
                        };
                        const nextDrafts = drafts.map((item) => (item.id === draft.id ? next : item));
                        revalidateAll(nextDrafts, draft.id);
                      }}
                      className={`w-full px-3 py-2 border rounded-lg text-base ${
                        highlightTime ? 'border-dashed border-orange-400' : 'border-gray-300'
                      }`}
                    />
                    <input
                      type="datetime-local"
                      disabled={!editable}
                      value={toDateTimeLocal(draft.activity?.endAt)}
                      onChange={(event) => {
                        const endAt = fromDateTimeLocal(event.target.value);
                        const next = {
                          ...draft,
                          needsUserConfirmation: false,
                          activity: { ...draft.activity!, endAt, timeResolution: 'exact' as const },
                        };
                        const nextDrafts = drafts.map((item) => (item.id === draft.id ? next : item));
                        revalidateAll(nextDrafts, draft.id);
                      }}
                      className={`w-full px-3 py-2 border rounded-lg text-base ${
                        highlightTime ? 'border-dashed border-orange-400' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  {highlightTime && <p className="text-xs text-orange-600">{t('chat_magic_pen_estimated_time')}</p>}
                  <p className="text-[11px] text-gray-500">{t('chat_magic_pen_confidence')}: {draft.confidence}</p>
                  {draft.errors.map((error) => (
                    <p key={error} className="text-xs text-red-500">
                      {t(errorToI18nKey(error))}
                    </p>
                  ))}
                  {commitState === 'success' && <p className="text-xs text-emerald-600">{t('chat_magic_pen_item_success')}</p>}
                  {commitState === 'error' && <p className="text-xs text-red-500">{t('chat_magic_pen_item_error')}</p>}
                </div>
              );
            })}
          </div>
        )}

        {autoWrittenItems.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-gray-500">{t('chat_magic_pen_group_auto_written')}</p>
            <div className="space-y-2">
              {autoWrittenItems.map((item) => {
                const isUndoing = undoingAutoWriteIds.has(item.id);
                return (
                  <div key={item.id} className="border border-emerald-200 bg-emerald-50 rounded-xl p-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-emerald-700">{t('chat_magic_pen_auto_written_badge')}</p>
                        <p className="text-sm text-emerald-900 break-words">{item.content}</p>
                        {item.linkedMoodContent && (
                          <p className="text-xs text-emerald-700 mt-1">
                            {t('chat_magic_pen_linked_mood_label')}: {item.linkedMoodContent}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={!item.messageId || isUndoing}
                        onClick={() => handleUndoAutoWrite(item)}
                        className="text-xs px-2 py-1 rounded-md border border-emerald-300 text-emerald-700 disabled:opacity-50"
                      >
                        {isUndoing ? t('loading') : t('chat_magic_pen_undo_auto_written')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {grouped.todos.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-gray-500">{t('chat_magic_pen_group_todo')}</p>
            {grouped.todos.map((draft) => {
              const commitState = commitStates.get(draft.id) || 'idle';
              const editable = commitState !== 'success';
              return (
                <div key={draft.id} className="border border-gray-200 rounded-xl p-3 space-y-2 bg-white">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={draft.content}
                      disabled={!editable}
                      onChange={(event) => upsertDraft({ ...draft, content: event.target.value })}
                      className="flex-1 text-base px-2 py-1 border border-gray-300 rounded-md outline-none"
                    />
                    <button
                      type="button"
                      disabled={!editable}
                      onClick={() => handleToggleKind(draft)}
                      className="text-xs px-2 py-1 rounded-md border border-gray-300"
                    >
                      {t('chat_magic_pen_switch_kind')}
                    </button>
                    <button
                      type="button"
                      disabled={!editable}
                      onClick={() => handleDraftDelete(draft.id)}
                      className="text-xs px-2 py-1 rounded-md border border-red-200 text-red-500"
                    >
                      {t('delete')}
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 grid grid-cols-2 gap-2">
                    <span>{t('chat_magic_pen_scope')}: daily</span>
                    <span>{t('chat_magic_pen_priority')}: important-not-urgent</span>
                    <span className="col-span-2">
                      {t('chat_magic_pen_category')}: {draft.todo?.category || t('chat_magic_pen_category_auto')}
                    </span>
                    <label className="col-span-2 flex items-center gap-2">
                      <span>{t('chat_magic_pen_due_date')}:</span>
                      <input
                        type="datetime-local"
                        disabled={!editable}
                        value={toDateTimeLocal(draft.todo?.dueDate)}
                        onChange={(event) => {
                          const dueDate = fromDateTimeLocal(event.target.value);
                          upsertDraft({
                            ...draft,
                            todo: {
                              ...draft.todo!,
                              dueDate,
                            },
                          });
                        }}
                        className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded-md text-xs"
                      />
                    </label>
                  </div>
                  <p className="text-[11px] text-gray-500">{t('chat_magic_pen_confidence')}: {draft.confidence}</p>
                  {commitState === 'success' && <p className="text-xs text-emerald-600">{t('chat_magic_pen_item_success')}</p>}
                  {commitState === 'error' && <p className="text-xs text-red-500">{t('chat_magic_pen_item_error')}</p>}
                </div>
              );
            })}
          </div>
        )}

        {unparsedSegments.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-gray-500">{t('chat_magic_pen_group_unparsed')}</p>
            <div className="rounded-xl bg-gray-100 p-3 text-xs text-gray-600 space-y-1">
              <p>{t('chat_magic_pen_unparsed_hint')}</p>
              {unparsedSegments.map((segment) => (
                <p key={segment}>- {segment}</p>
              ))}
            </div>
          </div>
        )}

        {statusText && <p className="text-xs text-blue-600">{statusText}</p>}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700"
          >
            {t('chat_magic_pen_cancel')}
          </button>
          <button
            type="button"
            disabled={isConfirmDisabled}
            onClick={handleConfirm}
            className="flex-1 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
          >
            {isSubmitting
              ? t('loading')
              : failedDraftCount > 0 && idleDraftCount === 0
                ? t('chat_magic_pen_retry_failed')
                : t('chat_magic_pen_confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
