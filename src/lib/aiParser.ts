/**
 * 移除 AI 推理模型的 <think>...</think> 标签及其内容
 * 适用于 Qwen3、DeepSeek-R1 等推理模型的响应
 * 
 * @param text 原始文本
 * @returns 过滤后的文本
 */
export function removeThinkingTags(text: string): string {
    if (!text || typeof text !== 'string') return '';

    // 匹配 AI 推理模型的思考标签及其内容（支持多行）
    let cleaned = text
        .replace(/<think>[\s\S]*?<\/think>/gi, '') // 标准 <arg_key> 标签
        .replace(/<think\s+[^>]*>[\s\S]*?<\/think>/gi, '') // 带属性的 <arg_key> 标签
        .replace(/&lt;think&gt;[\s\S]*?&lt;\/think&gt;/gi, '') // 转义的 &lt;think&gt; 标签
        .replace(/<\?\?>[\s\S]*?<\?\?>/gi, '') // <??> 自定义标签
        .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '') // <thinking> 标签
        .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '') // <reasoning> 标签
        .replace(/<output>[\s\S]*?<\/output>/gi, ''); // <output> 标签（Qwen3 格式）

    // 清理可能残留的思考内容（匹配 <arg_key> 开头到文本结束的情况）
    if (cleaned.includes('<think>')) {
        cleaned = cleaned.replace(/<think>.*/gi, '');
    }

    return cleaned.trim();
}

/**
 * 从 AI 原始返回中提取有效批注
 * 
 * 策略（多层降级）：
 * 1. JSON 解析（最优）- 尝试解析 JSON 格式输出
 * 2. 正则定位 - 定位 prompt 结尾特征词，截取后面的内容
 * 3. 长度过滤 - 取符合批注长度的最后一句
 * 
 * @param rawText AI 原始返回文本
 * @param promptLastSentence prompt 最后一句特征词（可选）
 * @returns 提取出的批注内容，失败返回 null
 */
export function extractComment(rawText: string, promptLastSentence = '无前缀。'): string | null {
    if (!rawText || typeof rawText !== 'string') {
        return null;
    }

    const text = rawText.trim();

    // =============================
    // 策略一：JSON 解析（最优）
    // =============================
    try {
        // 兼容模型在 JSON 外面套了 ```json ``` 的情况
        const jsonMatch = text.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.comment && isValidComment(parsed.comment)) {
                console.log('[提取成功] 策略：JSON解析');
                return parsed.comment.trim();
            }
        }
    } catch (e) {
        console.warn('[JSON解析失败] 降级到策略二', e instanceof Error ? e.message : e);
    }

    // =============================
    // 策略二：定位最后一句指令，截取后面的内容
    // =============================
    // 用 prompt 里最后一句有特征的话来定位
    const anchors = [
        '无前缀。',
        '不要复述上面的任何内容',
        '你的批注内容"}',  // JSON格式说明的结尾
        '直接以你的风格输出',
        '【最近批注】',
    ];

    for (const anchor of anchors) {
        const idx = text.lastIndexOf(anchor);
        if (idx !== -1) {
            const after = text.slice(idx + anchor.length).trim();
            // 去掉可能残留的 JSON 花括号和引号
            const cleaned = after
                .replace(/^[{}"comment:\s]*/, '')
                .replace(/[}"]*$/, '')
                .replace(/^["']/, '')
                .replace(/["']$/, '')
                .trim();
            if (isValidComment(cleaned)) {
                console.log('[提取成功] 策略：正则定位，anchor:', anchor);
                return cleaned;
            }
        }
    }

    // =============================
    // 策略三：长度过滤（最后兜底）
    // 假设 AI 输出了一堆废话+正文，取最后一个"句子"
    // =============================
    const sentences = text
        .split(/[。！!？?\n]/)
        .map(s => s.trim())
        .filter(s => s.length >= 10 && s.length <= 80);  // 符合批注长度的句子

    if (sentences.length > 0) {
        // 取最后一句（一般正文在最后）
        const lastSentence = sentences[sentences.length - 1];
        if (isValidComment(lastSentence)) {
            console.log('[提取成功] 策略：长度过滤');
            return lastSentence;
        }
    }

    // 全部失败
    console.error('[提取失败] 原始内容:', rawText);
    return null;
}

/**
 * 校验提取出的内容是否像一条正常批注
 * 过滤掉明显是"指令泄漏"的内容
 * 
 * @param text 待校验文本
 * @returns 是否为有效批注
 */
export function isValidComment(text: string): boolean {
    if (!text || text.length < 8 || text.length > 100) return false;

    // 黑名单：这些词出现说明还是提示词泄漏
    const leakKeywords = [
        'activity_recorded',
        'activity_completed',
        'mood_recorded',
        '【刚刚发生】',
        '【今日时间线】',
        '【最近批注】',
        '直接以你的风格输出',
        '无前缀',
        '"comment"',
        'JSON',
        '15-60字',
        '批注文本',
        '输出格式',
        '系统提示词',
    ];

    for (const kw of leakKeywords) {
        if (text.includes(kw)) return false;
    }

    return true;
}
