/**
 * 格式化持续时间
 * @param minutes 分钟数
 * @param t 可选的 i18n 翻译函数
 */
export function formatDuration(minutes: number, t?: (key: string, opts?: Record<string, unknown>) => string) {
    if (t) {
        if (minutes >= 60) {
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            return t('duration_hours_minutes', { hours, mins });
        }
        return t('duration_minutes', { mins: minutes });
    }
    // Fallback when t is not provided (e.g. server-side or legacy callers)
    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}m`;
    }
    return `${minutes}m`;
}
