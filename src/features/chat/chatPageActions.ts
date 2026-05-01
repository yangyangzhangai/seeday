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
  const normalizedInput = input.trim().replace(/\s+/g, ' ');
  const compactSemanticLength = normalizedInput
    .replace(/\s+/g, '')
    .replace(/[，,。.!?！？；;、:：'"“”‘’`~\-]/g, '')
    .length;

  const hasTodoListSignals = /(?:^|\b)(todo|to\s*-?\s*do)(?:\b|$)|待办|待辦|待做|任务清单|事項清單|清单|以下是我的待办|我的待办|今日待办|今天待办/.test(normalizedInput);
  if (hasTodoListSignals) {
    return false;
  }

  const hasExplicitListSeparators = /[\n，,。.!?！？；;、]|[()（）【】\[\]]/.test(normalizedInput);
  const zhSpaceChunks = normalizedInput.split(/\s+/).filter(Boolean).length;
  const hasLikelySpaceSeparatedList = /[\u3400-\u9fff]/.test(normalizedInput) && zhSpaceChunks >= 3;
  const actionSignalMatches = normalizedInput.match(/跑步|吃饭|开会|学习|写作业|做作业|见面|投简历|买菜|复习|整理|收集|回电话/g) ?? [];
  const hasMultiActionSignals = hasExplicitListSeparators || hasLikelySpaceSeparatedList || actionSignalMatches.length >= 2;
  if (hasMultiActionSignals) {
    return false;
  }

  const hasExplicitTimeSignal = /(今天|明天|后天|昨天|前天|今早|早上|上午|中午|下午|晚上|下周|本周|这周|本月|下个月|待会|等会|等下|一会|稍后|晚点|\d{1,2}(?::|：)\d{1,2}|\d{1,2}点(?:半|一刻|三刻|\d{1,2}分?)?|[零一二两俩三四五六七八九十]{1,3}点(?:半|一刻|三刻|[零一二三四五六七八九十]{1,2}分?)?|\d{1,2}\s*(?:到|至|~|～|-|—)\s*\d{1,2}(?:点)?)/.test(normalizedInput);
  if (hasExplicitTimeSignal) {
    return false;
  }

  const isSimpleText = !/[\n，,。.!?！？；;、]/.test(normalizedInput);
  if (compactSemanticLength > 0 && compactSemanticLength <= 8 && isSimpleText) {
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

  const hasParserPrioritySignals = /(今天|明天|后天|昨[天日]|上午|早上|中午|下午|晚上|今早|刚刚|刚才|待会|等会|等下|一会|稍后|晚点|下周|本周|这周|下个月|本月|\d{1,2}(?::|：)\d{1,2}|\d{1,2}点(?:半|一刻|三刻|\d{1,2}分?)?|[零一二两俩三四五六七八九十]{1,3}点(?:半|一刻|三刻|[零一二三四五六七八九十]{1,2}分?)?|分钟|半小时|小时|记得|提醒|别忘了|还要|需要|打算|计划|要.+了)/.test(normalizedInput);
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
    return;
  }

  params.setIsMagicPenSending(true);
  const supportedLang = toSupportedLang(params.lang);

  try {
    const localClassification = classifyLiveInput(trimmed, getLiveInputContext(params.messages));

    if (shouldUseLocalFastPath(trimmed, localClassification)) {
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
      return;
    }

    const parsed = await params.parseMagicPenInput(trimmed, { lang: supportedLang });
    const recoveredAutoWriteItems: MagicPenAutoWriteItem[] = parsed.autoWriteItems.map((item) => ({
      ...item,
      source: 'ai' as const,
    }));
    const remainingUnparsed = parsed.unparsedSegments
      .map((segment) => segment.trim())
      .filter((segment) => Boolean(segment));

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
    }

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
    } else {
      params.setMagicPenSeedAutoWritten([]);
    }
    params.setInput('');
  } finally {
    params.setIsMagicPenSending(false);
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
