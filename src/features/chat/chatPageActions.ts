// DOC-DEPS: LLM.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md -> docs/MAGIC_PEN_CAPTURE_SPEC.md -> src/features/chat/README.md
import type { MagicPenDraftItem } from '../../services/input/magicPenTypes';
import type { LiveInputClassification, RecentActivityContext } from '../../services/input/types';

type ReclassifyKind = 'activity' | 'mood';

type ReclassifyRecentInputFn = (
  messageId: string,
  nextKind: ReclassifyKind,
) => Promise<void>;

type SetExpandedActionsIdFn = (next: string | null) => void;

type SendAutoRecognizedInputFn = (content: string) => Promise<LiveInputClassification | null>;
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
  }>;
}>;

interface ActiveTodoSnapshot {
  id: string;
  content: string;
  startedAt?: number;
}

interface HandleMagicPenModeSendParams {
  input: string;
  lang: string;
  isMagicPenSending: boolean;
  activeTodoId: string | null;
  todos: ActiveTodoSnapshot[];
  recentActivity?: RecentActivityContext;
  sendAutoRecognizedInput: SendAutoRecognizedInputFn;
  completeActiveTodo: CompleteActiveTodoFn;
  updateMessageDuration: UpdateMessageDurationFn;
  parseMagicPenInput: ParseMagicPenFn;
  setIsMagicPenSending: (next: boolean) => void;
  setMagicPenSeedDrafts: (drafts: MagicPenDraftItem[]) => void;
  setMagicPenSeedUnparsed: (segments: string[]) => void;
  setIsMagicPenOpen: (next: boolean) => void;
  setInput: (next: string) => void;
}

const ZH_TODO_SIGNALS = ['明天', '后天', '下周', '待会', '记得', '提醒我', '别忘了'];
const EN_TODO_SIGNALS = ['tomorrow', 'the day after tomorrow', 'next week', 'remember to', 'remind me', 'do not forget'];
const IT_TODO_SIGNALS = ['domani', 'dopodomani', 'settimana prossima', 'ricordami', 'non dimenticare'];
const ZH_DATE_PATTERN = /(\d{1,2}[.-]\d{1,2}|\d{1,2}月\d{1,2}(?:日|号)?)/;

function hasTodoSignal(input: string, lang: 'zh' | 'en' | 'it'): boolean {
  if (lang === 'zh') {
    return ZH_TODO_SIGNALS.some((signal) => input.includes(signal)) || ZH_DATE_PATTERN.test(input);
  }

  const lowered = input.toLowerCase();
  if (lang === 'en') {
    return EN_TODO_SIGNALS.some((signal) => lowered.includes(signal));
  }
  return IT_TODO_SIGNALS.some((signal) => lowered.includes(signal));
}

function toSupportedLang(inputLang: string): 'zh' | 'en' | 'it' {
  const resolved = inputLang.toLowerCase();
  if (resolved === 'en' || resolved === 'it') {
    return resolved;
  }
  return 'zh';
}

async function completeActiveTodoAfterRealtimeIfNeeded(
  classifications: Array<LiveInputClassification | null>,
  activeTodoId: string | null,
  todos: ActiveTodoSnapshot[],
  completeActiveTodo: CompleteActiveTodoFn,
  updateMessageDuration: UpdateMessageDurationFn,
): Promise<void> {
  if (!activeTodoId) return;
  const hasActivity = classifications.some((item) => item?.kind === 'activity');
  if (!hasActivity) return;

  const todoToComplete = todos.find((todo) => todo.id === activeTodoId);
  await completeActiveTodo();
  if (!todoToComplete?.startedAt) return;
  const duration = Math.round((Date.now() - todoToComplete.startedAt) / (1000 * 60));
  await updateMessageDuration(todoToComplete.content, todoToComplete.startedAt, duration);
}

export async function handleMagicPenModeSend(params: HandleMagicPenModeSendParams): Promise<void> {
  const trimmed = params.input.trim();
  if (!trimmed || params.isMagicPenSending) {
    return;
  }

  params.setIsMagicPenSending(true);
  const supportedLang = toSupportedLang(params.lang);

  try {
    if (!hasTodoSignal(trimmed, supportedLang)) {
      const classification = await params.sendAutoRecognizedInput(trimmed);
      await completeActiveTodoAfterRealtimeIfNeeded(
        [classification],
        params.activeTodoId,
        params.todos,
        params.completeActiveTodo,
        params.updateMessageDuration,
      );
      params.setInput('');
      return;
    }

    const parsed = await params.parseMagicPenInput(trimmed, { lang: supportedLang });
    const autoWriteResults: Array<LiveInputClassification | null> = [];

    for (const item of parsed.autoWriteItems) {
      if (!item.content.trim()) {
        continue;
      }
      const classification = await params.sendAutoRecognizedInput(item.content);
      autoWriteResults.push(classification);
    }

    await completeActiveTodoAfterRealtimeIfNeeded(
      autoWriteResults,
      params.activeTodoId,
      params.todos,
      params.completeActiveTodo,
      params.updateMessageDuration,
    );

    if (parsed.drafts.length > 0 || parsed.unparsedSegments.length > 0) {
      params.setMagicPenSeedDrafts(parsed.drafts);
      params.setMagicPenSeedUnparsed(parsed.unparsedSegments);
      params.setIsMagicPenOpen(true);
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
