import type { Message } from './useChatStore.types';
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
