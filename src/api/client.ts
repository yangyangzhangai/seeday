// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/api/README.md
/**
 * 前端 API Client - 调用 Vercel Serverless Functions
 * 
 * 所有 AI 请求都通过服务端中转，API Key 不会暴露在前端
 */

const API_BASE = '/api';

interface ApiErrorShape {
  error?: string;
}

type ApiLang = 'zh' | 'en' | 'it';

async function postJson<TReq, TRes>(path: string, body: TReq): Promise<TRes> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' })) as ApiErrorShape;
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json() as Promise<TRes>;
}

interface ChatRequest {
  messages: { role: string; content: string }[];
  temperature?: number;
  max_tokens?: number;
}

interface ChatResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface ReportRequest {
  data: {
    date: string;
    todos: any[];
    activities: { time: string; content: string; duration: number }[];
    stats: any;
  };
  type: 'daily' | 'weekly' | 'monthly';
}

interface ReportResponse {
  content: string;
}

interface AnnotationRequest {
  eventType: string;
  eventData: any;
  userContext: {
    todayActivities?: number;
    todayDuration?: number;
    currentHour?: number;
    recentAnnotations?: string[];
    recentMoodMessages?: string[]; // 连续心情原文（最多3条）
    todayActivitiesList?: any[];
  };
  lang?: 'zh' | 'en' | 'it';
}

interface AnnotationResponse {
  content: string;
  tone: 'playful' | 'celebrating' | 'concerned' | 'curious';
  displayDuration: number;
  source?: 'ai' | 'default';
  reason?: 'no_key' | 'fetch_failed' | 'empty_response' | 'empty_content' | 'extract_failed' | 'exception';
}

/**
 * 调用 Chat API
 */
export async function callChatAPI(request: ChatRequest): Promise<string> {
  const data = await postJson<ChatRequest, ChatResponse>('/chat', request);
  return data.content;
}

/**
 * 调用 Report API
 */
export async function callReportAPI(request: ReportRequest): Promise<string> {
  const data = await postJson<ReportRequest, ReportResponse>('/report', request);
  return data.content;
}

/**
 * 调用 Annotation API
 */
export async function callAnnotationAPI(request: AnnotationRequest): Promise<AnnotationResponse> {
  return postJson<AnnotationRequest, AnnotationResponse>('/annotation', request);
}

// ── Timeshine 三步走新 API ────────────────────────────────────────────────────

interface ClassifyRequest {
  rawInput: string;
  lang?: 'zh' | 'en' | 'it';
}

interface ClassifyResponse {
  success: boolean;
  data: {
    total_duration_min: number;
    items: Array<{
      name: string;
      duration_min: number;
      time_slot: 'morning' | 'afternoon' | 'evening' | null;
      category: string;
      flag: 'ambiguous' | null;
    }>;
    todos: {
      completed: number;
      total: number;
    };
    energy_log: Array<{
      time_slot: 'morning' | 'afternoon' | 'evening';
      energy_level: 'high' | 'medium' | 'low' | null;
      mood: string | null;
    }>;
  };
}

interface DiaryRequest {
  structuredData: string;
  rawInput?: string;
  date?: string;
  historyContext?: string;
  lang?: 'zh' | 'en' | 'it';
  userName?: string;
}

interface DiaryResponse {
  success: boolean;
  content: string;
}

/**
 * 步骤1: 调用分类器 API - 将用户原始输入分类为结构化数据
 */
export async function callClassifierAPI(request: ClassifyRequest): Promise<ClassifyResponse> {
  return postJson<ClassifyRequest, ClassifyResponse>('/classify', request);
}

/**
 * 步骤3: 调用日记 API - 生成诗意的观察手记
 */
export async function callDiaryAPI(request: DiaryRequest): Promise<DiaryResponse> {
  return postJson<DiaryRequest, DiaryResponse>('/diary', request);
}

// ── Stardust Emoji 生成 API ───────────────────────────────────────────────────

interface StardustRequest {
  userRawContent: string;
  message: string;
}

interface StardustResponse {
  emojiChar: string;
}

interface MagicPenParseRequest {
  rawText: string;
  lang?: ApiLang;
  todayDateStr: string;
  currentHour: number;
}

interface MagicPenParseSegment {
  text: string;
  sourceText: string;
  kind: 'activity' | 'mood' | 'todo_add' | 'activity_backfill';
  confidence: 'high' | 'medium' | 'low';
  startTime?: string;
  endTime?: string;
  timeSource?: 'exact' | 'period' | 'missing';
  periodLabel?: string;
}

interface MagicPenParseResponse {
  success: boolean;
  data: {
    segments: MagicPenParseSegment[];
    unparsed: string[];
  };
}

/**
 * 调用 Stardust API - 为珍藏记忆生成 Emoji 字符
 * 替代 useStardustStore 中的前端直连 Chutes API 行为
 */
export async function callStardustAPI(request: StardustRequest): Promise<StardustResponse> {
  return postJson<StardustRequest, StardustResponse>('/stardust', request);
}

export async function callMagicPenParseAPI(
  request: MagicPenParseRequest,
): Promise<MagicPenParseResponse> {
  return postJson<MagicPenParseRequest, MagicPenParseResponse>('/magic-pen-parse', request);
}
