/**
 * 前端 API Client - 调用 Vercel Serverless Functions
 * 
 * 所有 AI 请求都通过服务端中转，API Key 不会暴露在前端
 */

// 自动检测环境
const isDevelopment = import.meta.env.DEV;
const isVercel = import.meta.env.VERCEL || window.location.hostname.includes('vercel.app');

// API 基础 URL
const API_BASE = isDevelopment && !isVercel
  ? '/api'  // 本地开发时通过 Vite proxy
  : '/api'; // 生产环境直接调用

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
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  const data: ChatResponse = await response.json();
  return data.content;
}

/**
 * 调用 Report API
 */
export async function callReportAPI(request: ReportRequest): Promise<string> {
  const response = await fetch(`${API_BASE}/report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  const data: ReportResponse = await response.json();
  return data.content;
}

/**
 * 调用 Annotation API
 */
export async function callAnnotationAPI(request: AnnotationRequest): Promise<AnnotationResponse> {
  const response = await fetch(`${API_BASE}/annotation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return await response.json();
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
  const response = await fetch(`${API_BASE}/classify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return await response.json();
}

/**
 * 步骤3: 调用日记 API - 生成诗意的观察手记
 */
export async function callDiaryAPI(request: DiaryRequest): Promise<DiaryResponse> {
  const response = await fetch(`${API_BASE}/diary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return await response.json();
}

// ── Stardust Emoji 生成 API ───────────────────────────────────────────────────

interface StardustRequest {
  userRawContent: string;
  message: string;
}

interface StardustResponse {
  emojiChar: string;
}

/**
 * 调用 Stardust API - 为珍藏记忆生成 Emoji 字符
 * 替代 useStardustStore 中的前端直连 Chutes API 行为
 */
export async function callStardustAPI(request: StardustRequest): Promise<StardustResponse> {
  const response = await fetch(`${API_BASE}/stardust`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return await response.json();
}
