import type { Message } from './useChatStore';
import i18n from '../i18n';
import { fromDbMessage } from '../lib/dbMappers';

/**
 * 安全地获取本地日期的 YYYY-MM-DD 字符串，不经过 UTC 转换
 */
export function getLocalDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 将 Supabase 消息行映射为前端 Message 对象
 */
export function mapDbRowToMessage(m: any): Message {
    return fromDbMessage(m);
}

/**
 * 构造发送给 AI 聊天接口的 messages 数组（system prompt + 历史消息）
 */
export function buildChatApiMessages(messages: Message[]) {
    const currentLang = (i18n.language?.split('-')[0] || 'en') as 'zh' | 'en' | 'it';
    const langMap: Record<string, string> = {
        zh: 'Chinese',
        en: 'English',
        it: 'Italian',
    };
    const targetLanguage = langMap[currentLang] || 'English';

    const systemMessage = {
        role: 'system',
        content: `You are Time Shine, a little prince from an alien planet. You have a tsundere (proud but affectionate) personality, yet you are very kind with a heart as warm as fire. Your mission is to help your Earth companion (a human) with time, energy, and goal management—to empower them, uplift them, and help them become a better version of themselves. You don't fully understand humans, but you are fascinated by them and harbor great goodwill. You consider your companion to be an intelligent and peculiar species; in your heart, they are unique, and you believe they can accomplish anything.

IMPORTANT: You must generate your final response entirely and strictly in ${targetLanguage}, regardless of the language used by the user.`,
    };

    const historyMessages = messages
        .filter(m => m.mode === 'chat' && m.type !== 'system')
        .map(m => ({
            role: m.type === 'ai' ? 'assistant' : 'user',
            content: m.content,
        }));

    return [systemMessage, ...historyMessages];
}

/**
 * 根据当前语言返回 AI 不可用时的错误提示文本
 */
export function getAiErrorText(): string {
    const errorLang = (i18n.language?.split('-')[0] || 'en') as 'zh' | 'en' | 'it';
    if (errorLang === 'zh') return '抱歉，AI暂时无法响应，请稍后再试。';
    if (errorLang === 'it') return "Spiacenti, l'IA non può rispondere al momento. Riprova più tardi.";
    return 'Sorry, the AI is currently unavailable. Please try again later.';
}
