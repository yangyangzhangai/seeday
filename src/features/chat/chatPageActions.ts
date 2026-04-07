// DOC-DEPS: LLM.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md -> docs/MAGIC_PEN_CAPTURE_SPEC.md -> src/features/chat/README.md
import { classifyLiveInput } from '../../services/input/liveInputClassifier';
import { getLiveInputContext } from '../../services/input/liveInputContext';
import type { MagicPenAutoWriteItem, MagicPenAutoWrittenItem, MagicPenDraftItem } from '../../services/input/magicPenTypes';
import type { LiveInputClassification } from '../../services/input/types';
import type { Message } from '../../store/useChatStore';

type ReclassifyKind = 'activity' | 'mood';

type ReclassifyRecentInputFn = (
  messageId: string,
  nextKind: ReclassifyKind,
) => Promise<void>;

type SetExpandedActionsIdFn = (next: string | null) => void;

interface AutoWriteExecutionResult {
  classification: LiveInputClassification | null;
  messageId?: string;
}

type SendAutoRecognizedInputFn = (content: string) => Promise<AutoWriteExecutionResult>;
type WriteMagicPenAutoItemFn = (item: MagicPenAutoWriteItem) => Promise<{ messageId?: string }>;
type CompleteActiveTodoFn = () => Promise<void>;
type UpdateMessageDurationFn = (content: string, timestamp: number, durationMinutes: number) => Promise<void>;
type ParseMagicPenFn = (rawText: string, options: { lang: 'zh' | 'en' | 'it' }) => Promise<{
  drafts: MagicPenDraftItem[];
  unparsedSegments: string[];
  autoWriteItems: Array<{
    id: string;
    kind: 'activity' | 'mood';
    content: string;
    sourceText: string;
    confidence: 'high' | 'medium' | 'low';
    linkedMoodContent?: string;
  }>;
}>;

interface ActiveTodoSnapshot {
  id: string;
  title?: string;
  content?: string;
  startedAt?: number;
}

interface HandleMagicPenModeSendParams {
  input: string;
  lang: string;
  isMagicPenSending: boolean;
  messages: Message[];
  activeTodoId: string | null;
  todos: ActiveTodoSnapshot[];
  sendAutoRecognizedInput: SendAutoRecognizedInputFn;
  writeMagicPenAutoItem: WriteMagicPenAutoItemFn;
  completeActiveTodo: CompleteActiveTodoFn;
  updateMessageDuration: UpdateMessageDurationFn;
  parseMagicPenInput: ParseMagicPenFn;
  setIsMagicPenSending: (next: boolean) => void;
  setMagicPenSeedDrafts: (drafts: MagicPenDraftItem[]) => void;
  setMagicPenSeedUnparsed: (segments: string[]) => void;
  setMagicPenSeedAutoWritten: (items: MagicPenAutoWrittenItem[]) => void;
  setIsMagicPenOpen: (next: boolean) => void;
  setInput: (next: string) => void;
}

let magicPenSendSequence = 0;

function logMagicPenFlow(step: string, payload: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  console.log(`[magic-pen-flow] ${step}`, payload);
}

function previewMagicPenText(text: string, maxLength: number = 48): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (!compact) return '[empty]';
  if (compact.length <= maxLength) return compact;
  const head = compact.slice(0, Math.floor(maxLength / 2));
  const tail = compact.slice(-Math.floor(maxLength / 2));
  return `${head} ... ${tail}`;
}

function toSupportedLang(inputLang: string): 'zh' | 'en' | 'it' {
  const resolved = inputLang.toLowerCase();
  if (resolved === 'en' || resolved === 'it') {
    return resolved;
  }
  return 'zh';
}

async function completeActiveTodoAfterRealtimeIfNeeded(
  writtenKinds: Array<'activity' | 'mood' | null>,
  activeTodoId: string | null,
  todos: ActiveTodoSnapshot[],
  completeActiveTodo: CompleteActiveTodoFn,
  updateMessageDuration: UpdateMessageDurationFn,
): Promise<void> {
  if (!activeTodoId) return;
  const hasActivity = writtenKinds.some((kind) => kind === 'activity');
  if (!hasActivity) return;

  const todoToComplete = todos.find((todo) => todo.id === activeTodoId);
  await completeActiveTodo();
  if (!todoToComplete?.startedAt) return;
  const duration = Math.round((Date.now() - todoToComplete.startedAt) / (1000 * 60));
  const todoLabel = todoToComplete.title ?? todoToComplete.content;
  if (!todoLabel) return;
  await updateMessageDuration(todoLabel, todoToComplete.startedAt, duration);
}

function shouldUseLocalFastPath(input: string, classification: LiveInputClassification): boolean {
  const compactSemanticLength = input
    .replace(/\s+/g, '')
    .replace(/[，,。.!?！？；;、:：'"“”‘’`~\-]/g, '')
    .length;

  const hasExplicitTimeSignal = /(今天|明天|后天|昨天|前天|今早|早上|上午|中午|下午|晚上|下周|本周|这周|本月|下个月|待会|等会|等下|一会|稍后|晚点|\d{1,2}(?::|：)\d{1,2}|\d{1,2}点(?:半|一刻|三刻|\d{1,2}分?)?|[零一二两俩三四五六七八九十]{1,3}点(?:半|一刻|三刻|[零一二三四五六七八九十]{1,2}分?)?|\d{1,2}\s*(?:到|至|~|～|-|—)\s*\d{1,2}(?:点)?)/.test(input);
  if (hasExplicitTimeSignal) {
    return false;
  }

  if (compactSemanticLength > 0 && compactSemanticLength <= 3) {
    return true;
  }

  const isSimpleText = !/[\n，,。.!?！？；;、]/.test(input);
  if (compactSemanticLength > 0 && compactSemanticLength <= 6 && isSimpleText) {
    return true;
  }

  if (classification.confidence !== 'high') {
    return false;
  }

  if (!isSimpleText) {
    return false;
  }

  const hasFutureOrNegationReason = classification.reasons.some((reason) =>
    reason.includes('future') || reason.includes('planned') || reason.includes('negated'),
  );
  if (hasFutureOrNegationReason) {
    return false;
  }

  const hasParserPrioritySignals = /(今天|明天|后天|昨[天日]|上午|早上|中午|下午|晚上|今早|刚刚|刚才|待会|等会|等下|一会|稍后|晚点|下周|本周|这周|下个月|本月|\d{1,2}(?::|：)\d{1,2}|\d{1,2}点(?:半|一刻|三刻|\d{1,2}分?)?|[零一二两俩三四五六七八九十]{1,3}点(?:半|一刻|三刻|[零一二三四五六七八九十]{1,2}分?)?|分钟|半小时|小时|记得|提醒|别忘了|还要|需要|打算|计划|要.+了)/.test(input);
  if (hasParserPrioritySignals) {
    return false;
  }

  return classification.internalKind === 'new_activity'
    || classification.internalKind === 'standalone_mood'
    || classification.internalKind === 'mood_about_last_activity'
    || classification.internalKind === 'activity_with_mood';
}

export async function handleMagicPenModeSend(params: HandleMagicPenModeSendParams): Promise<void> {
  const trimmed = params.input.trim();
  if (!trimmed || params.isMagicPenSending) {
    logMagicPenFlow('send.skipped', {
      reason: !trimmed ? 'empty_input' : 'already_sending',
      inputLength: trimmed.length,
    });
    return;
  }

  magicPenSendSequence += 1;
  const sendSeq = magicPenSendSequence;
  const startedAt = Date.now();

  params.setIsMagicPenSending(true);
  const supportedLang = toSupportedLang(params.lang);

  logMagicPenFlow('send.start', {
    sendSeq,
    inputLength: trimmed.length,
    supportedLang,
    messageCount: params.messages.length,
    hasActiveTodo: Boolean(params.activeTodoId),
  });

  try {
    const localClassification = classifyLiveInput(trimmed, getLiveInputContext(params.messages));
    logMagicPenFlow('send.local_classification', {
      sendSeq,
      kind: localClassification.kind,
      internalKind: localClassification.internalKind,
      confidence: localClassification.confidence,
      reasons: localClassification.reasons,
    });

    if (shouldUseLocalFastPath(trimmed, localClassification)) {
      logMagicPenFlow('send.path', {
        sendSeq,
        path: 'local_fast_path',
      });
      const localWriteResult = await params.sendAutoRecognizedInput(trimmed);
      await completeActiveTodoAfterRealtimeIfNeeded(
        [localWriteResult.classification?.kind ?? null],
        params.activeTodoId,
        params.todos,
        params.completeActiveTodo,
        params.updateMessageDuration,
      );
      params.setMagicPenSeedAutoWritten([]);
      params.setInput('');
      logMagicPenFlow('send.done_fast_path', {
        sendSeq,
        elapsedMs: Date.now() - startedAt,
        source: 'local_fast_path',
        wroteKind: localWriteResult.classification?.kind,
        internalKind: localWriteResult.classification?.internalKind,
      });
      return;
    }

    logMagicPenFlow('send.path', {
      sendSeq,
      path: 'parser_path',
    });
    const parsed = await params.parseMagicPenInput(trimmed, { lang: supportedLang });
    logMagicPenFlow('send.parser_result', {
      sendSeq,
      draftCount: parsed.drafts.length,
      unparsedCount: parsed.unparsedSegments.length,
      autoWriteCount: parsed.autoWriteItems.length,
    });
    const recoveredAutoWriteItems: MagicPenAutoWriteItem[] = parsed.autoWriteItems.map((item) => ({
      ...item,
      source: 'ai' as const,
    }));
    const remainingUnparsed = parsed.unparsedSegments
      .map((segment) => segment.trim())
      .filter((segment) => Boolean(segment));

    logMagicPenFlow('send.autowrite_candidates', {
      sendSeq,
      candidates: recoveredAutoWriteItems.map((item) => ({
        id: item.id,
        kind: item.kind,
        source: item.source,
        confidence: item.confidence,
        contentPreview: previewMagicPenText(item.content),
      })),
    });

    const autoWriteKinds: Array<'activity' | 'mood' | null> = [];
    const autoWrittenItems: MagicPenAutoWrittenItem[] = [];

    for (const autoWriteItem of recoveredAutoWriteItems) {
      if (!autoWriteItem.content.trim()) {
        continue;
      }
      const writeResult = await params.writeMagicPenAutoItem(autoWriteItem);
      autoWriteKinds.push(autoWriteItem.kind);
      autoWrittenItems.push({
        id: autoWriteItem.id,
        kind: autoWriteItem.kind,
        content: autoWriteItem.content,
        sourceText: autoWriteItem.sourceText,
        messageId: writeResult.messageId,
        linkedMoodContent: autoWriteItem.linkedMoodContent,
      });
      logMagicPenFlow('send.autowrite_item_written', {
        sendSeq,
        id: autoWriteItem.id,
        source: autoWriteItem.source,
        kind: autoWriteItem.kind,
        contentPreview: previewMagicPenText(autoWriteItem.content),
      });
    }

    logMagicPenFlow('send.autowrite_done', {
      sendSeq,
      attemptedAutoWriteCount: recoveredAutoWriteItems.length,
      writtenCount: autoWrittenItems.length,
      remainingUnparsedCount: remainingUnparsed.length,
      draftCount: parsed.drafts.length,
    });

    await completeActiveTodoAfterRealtimeIfNeeded(
      autoWriteKinds,
      params.activeTodoId,
      params.todos,
      params.completeActiveTodo,
      params.updateMessageDuration,
    );

    if (parsed.drafts.length > 0 || remainingUnparsed.length > 0) {
      params.setMagicPenSeedDrafts(parsed.drafts);
      params.setMagicPenSeedUnparsed(remainingUnparsed);
      params.setMagicPenSeedAutoWritten(autoWrittenItems);
      params.setIsMagicPenOpen(true);
      logMagicPenFlow('send.sheet_open', {
        sendSeq,
        draftCount: parsed.drafts.length,
        unparsedCount: remainingUnparsed.length,
        autoWrittenCount: autoWrittenItems.length,
      });
    } else {
      params.setMagicPenSeedAutoWritten([]);
      logMagicPenFlow('send.no_sheet_needed', {
        sendSeq,
        autoWrittenCount: autoWrittenItems.length,
      });
    }
    params.setInput('');
  } finally {
    params.setIsMagicPenSending(false);
    logMagicPenFlow('send.finally', {
      sendSeq,
      elapsedMs: Date.now() - startedAt,
    });
  }
}

export async function handleLatestMessageReclassify(
  messageId: string,
  nextKind: ReclassifyKind,
  reclassifyRecentInput: ReclassifyRecentInputFn,
  setExpandedActionsId: SetExpandedActionsIdFn,
): Promise<void> {
  await reclassifyRecentInput(messageId, nextKind);
  setExpandedActionsId(null);
}
