#!/usr/bin/env python3
"""Evaluate live-input classification against timeshine gold samples.

Usage:
  python scripts/evaluate_live_input_gold.py
  python scripts/evaluate_live_input_gold.py --lang zh
  python scripts/evaluate_live_input_gold.py --top-errors 20
"""

from __future__ import annotations

import argparse
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import openpyxl


ZH_ACTIVITY_STRONG_PHRASES = [
    "开会",
    "学习",
    "复习",
    "写周报",
    "做作业",
    "运动",
    "散步",
    "洗澡",
    "吃饭",
    "去洗澡",
    "去吃饭",
    "开始学习",
    "摸鱼",
    "健身",
    "健身房",
    "上课",
    "上班",
    "工作",
    "背单词",
    "刷题",
    "跑完步",
    "到公司",
    "出门",
    "下课",
    "聚餐",
    "视频通话",
    "通电话",
    "打电话",
    "逛街",
    "打球",
    "看电影",
    "午休",
    "睡觉",
    "买东西",
]

ZH_ACTIVITY_VERBS = [
    "开会",
    "学习",
    "复习",
    "运动",
    "散步",
    "洗澡",
    "跑步",
    "整理",
    "开发",
    "阅读",
    "看书",
    "复盘",
    "沟通",
    "摸鱼",
    "健身",
    "上课",
    "上班",
    "工作",
    "刷题",
    "背单词",
    "出门",
    "下课",
    "聚餐",
    "通话",
    "打球",
    "写",
    "做",
    "改",
    "买",
    "交",
]

ZH_ACTIVITY_SINGLE_VERB_PATTERNS = [
    re.compile(r"吃[了过]?(饭|早餐|午饭|晚饭)"),
    re.compile(r"吃个(饭|早餐|午饭|晚饭)"),
    re.compile(r"写(代码|周报|作业|方案|文档|报告|论文)"),
    re.compile(r"做(作业|饭|题|计划|决定|项目|.*东西)"),
    re.compile(r"做.*决定"),
    re.compile(r"做了"),
    re.compile(r"开(会|晨会|例会)"),
    re.compile(r"开.*会"),
    re.compile(r"学(习|英语|数学|单词)"),
    re.compile(r"背(单词|课文)"),
    re.compile(r"背.*单词"),
    re.compile(r"刷(题|视频)"),
    re.compile(r"刷.*视频"),
    re.compile(r"跑(步|完步)"),
    re.compile(r"跑.*公里"),
    re.compile(r"改(代码|文档|方案|报告)"),
    re.compile(r"打(球|电话)"),
    re.compile(r"通(电话|话)"),
    re.compile(r"看(电影|剧)"),
    re.compile(r"午休睡(了|得)"),
    re.compile(r"去洗个澡"),
    re.compile(r"到公司"),
    re.compile(r"出门了?"),
    re.compile(r"买到.+"),
    re.compile(r"刚把(作业|报告|文档|方案).*(交了|提交了)"),
    re.compile(r"做了(决定|选择|计划)"),
    re.compile(r"和(客户|朋友|家人).*(会开|开会|沟通|通话)"),
    re.compile(r"买.*东西"),
    re.compile(r"看.*电影"),
    re.compile(
        r"(刚|刚刚|已经).*(开会|吃饭|写|做|学习|下课|到公司|出门|睡觉|通话|聚餐)"
    ),
    re.compile(r"(刚|刚刚).*(打完)"),
    re.compile(r"(昨晚|今天早上).*(开会|吃饭|写|做|学习|工作|睡觉)"),
    re.compile(r"(刚|刚刚).*(开完会|吃完饭|通完电话|finish了.*project|gym完)"),
    re.compile(r"吃完$"),
    re.compile(r"(在|刚在|正在)搞"),
    re.compile(r"搞定了?$"),
    re.compile(r"终于搞定了?$"),
    re.compile(r"去健身房"),
    re.compile(r"去买(东西)?"),
    re.compile(r"和(客户|朋友|家人).*(开会|通话|聚餐|逛街)"),
    re.compile(r"(in|at)\s+(a\s+)?meeting", re.IGNORECASE),
    re.compile(r"(just\s+)?had\s+(lunch|dinner|breakfast)", re.IGNORECASE),
    re.compile(r"went\s+for\s+a\s+run", re.IGNORECASE),
    re.compile(r"(having|eating)\s+(lunch|dinner|breakfast)", re.IGNORECASE),
    re.compile(r"reading\s+a\s+book", re.IGNORECASE),
    re.compile(r"working\s+on\s+(slides|report|project)", re.IGNORECASE),
    re.compile(r"just\s+got\s+home", re.IGNORECASE),
    re.compile(
        r"(done|finished)\s+(with\s+)?(work|report|homework|slides)?", re.IGNORECASE
    ),
    re.compile(r"finished\s+the\s+report", re.IGNORECASE),
    re.compile(r"finally\s+done", re.IGNORECASE),
    re.compile(r"workout\s+was\s+\w+", re.IGNORECASE),
    re.compile(r"sto\s+(studiando|lavorando)", re.IGNORECASE),
    re.compile(r"ho\s+(finito|fatto|mangiato)", re.IGNORECASE),
    re.compile(r"appena\s+finito", re.IGNORECASE),
    re.compile(r"finito!?$", re.IGNORECASE),
]

ZH_ACTIVITY_OBJECTS = [
    "周报",
    "代码",
    "作业",
    "客户",
    "文档",
    "会议",
    "会",
    "方案",
    "项目",
    "报告",
    "饭",
    "东西",
    "电话",
    "电影",
    "词",
    "课",
]

ZH_MOOD_WORDS = [
    "开心",
    "烦",
    "焦虑",
    "累",
    "疲惫",
    "低落",
    "平静",
    "难受",
    "紧张",
    "满足",
    "崩溃",
    "无语",
    "糟糕",
    "压抑",
    "舒服",
    "放松",
    "没精神",
    "头疼",
    "后悔",
    "充实",
    "爽",
    "难",
    "状态差",
    "失望",
    "沮丧",
    "不满意",
    "没信心",
    "顺利",
    "轻松",
    "吵架",
    "撑过去了",
    "挫败",
]

ZH_MOOD_PATTERNS = [
    re.compile(r"^好.+"),
    re.compile(r"^很.+"),
    re.compile(r"^有点.+"),
    re.compile(r"^今天状态.+"),
    re.compile(r"真.+"),
    re.compile(r"心情.+"),
    re.compile(r"(good|great|terrible|awful|tired)", re.IGNORECASE),
]

ZH_EVALUATION_WORDS = [
    "终于",
    "总算",
    "可算",
    "太难了",
    "好爽",
    "好充实",
    "后悔",
    "不太对",
    "有成就感",
    "很有收获",
    "白忙了",
    "太值了",
    "太亏了",
    "好久没有",
    "上头",
    "踏实",
    "很崩",
]
ZH_LAST_ACTIVITY_REFERENCES = [
    "这件事",
    "这件事情",
    "这个",
    "刚才那个",
    "那个会",
    "那个电话",
    "那通电话",
    "那节课",
    "那次训练",
    "那个任务",
    "那份作业",
    "那次沟通",
    "那次会",
    "那通会",
    "那件活",
    "这波训练",
    "刚那节课",
    "刚才",
    "这种感觉",
]
ZH_FINISHING_PHRASES = ["做完了", "写完了", "结束了", "搞定了", "完成了"]
ZH_STRONG_COMPLETION_PATTERNS = [
    re.compile(r"(刚|刚刚).*(开完|写完|做完|吃完|忙完|通完|打完).*"),
    re.compile(r"已经.*(开完|写完|做完|吃完|结束|搞定|完成|打完).*"),
    re.compile(r"(开完了|写完了|做完了|吃完了|结束了|搞定了|完成了|下课了|打完了)$"),
    re.compile(r"(刚|刚刚).*(交了|提交了).*"),
]
ZH_NEW_ACTIVITY_SWITCHES = ["然后", "接着", "后来去", "再去", "去"]
ZH_WEAK_COMPLETION_WORDS = ["终于", "总算", "松口气", "撑过去"]

ZH_CONTEXT_ACTIVITY_KEYWORDS = [
    token
    for token in {
        *ZH_ACTIVITY_STRONG_PHRASES,
        *ZH_ACTIVITY_VERBS,
        *ZH_ACTIVITY_OBJECTS,
        "开完",
        "写完",
        "做完",
        "吃完",
        "下课",
        "通话",
        "视频通话",
        "聚餐",
        "健身",
        "跑步",
        "周报",
        "报告",
        "作业",
        "会议",
    }
    if len(token) >= 2
]

EN_ACTIVITY_VERBS = [
    "work",
    "working",
    "worked",
    "study",
    "studying",
    "studied",
    "meet",
    "meeting",
    "run",
    "running",
    "ran",
    "walk",
    "walking",
    "code",
    "coding",
    "coded",
    "cook",
    "cooking",
    "cooked",
    "write",
    "writing",
    "wrote",
    "report",
    "review",
    "reviewing",
    "workout",
    "exercising",
    "gym",
    "commute",
    "commuting",
    "shopping",
    "bought",
    "call",
    "calling",
    "debugging",
]

EN_MOOD_WORDS = [
    "tired",
    "exhausted",
    "stressed",
    "stressful",
    "anxious",
    "sad",
    "down",
    "upset",
    "frustrated",
    "annoyed",
    "drained",
    "relieved",
    "happy",
    "glad",
    "calm",
    "angry",
    "overwhelmed",
    "pointless",
]

EN_MOOD_PATTERNS = [
    re.compile(
        r"\b(feel|feeling)\s+(very\s+|so\s+|really\s+)?"
        r"(tired|exhausted|stressed|stressful|anxious|sad|down|happy|calm|angry|overwhelmed|drained|relieved|frustrated|annoyed)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(so|very|really|quite)\s+(tired|exhausted|stressed|stressful|anxious|sad|happy|calm|angry|frustrated|drained|relieved)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(was|is|felt|feels)\s+(stressful|annoying|great|awful|rough|smooth|pointless)\b",
        re.IGNORECASE,
    ),
    re.compile(r"\bmade\s+me\s+(anxious|stressed|upset|angry)\b", re.IGNORECASE),
]

EN_ACTIVITY_PATTERNS = [
    re.compile(
        r"\b(i am|i'm|im)\s+(working|studying|coding|running|walking|cooking)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(working|studying|coding|running|walking|cooking)\s+(now|right now)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(just\s+)?(had|did|wrapped\s+up)\s+(a\s+)?(meeting|workout|class|call)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(writing|working\s+on|reviewing)\s+(the\s+)?(report|doc|assignment|ticket|code|pr)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(on\s+my\s+way\s+to|at)\s+(the\s+)?(office|gym|school)\b", re.IGNORECASE
    ),
    re.compile(r"\b(in|on)\s+(a\s+)?meeting\b", re.IGNORECASE),
    re.compile(r"\bvideo\s+call\b", re.IGNORECASE),
    re.compile(r"\bin\s+the\s+middle\s+of\s+debugging\b", re.IGNORECASE),
    re.compile(r"\bjust\s+sent\s+the\s+update\b", re.IGNORECASE),
]

EN_STRONG_COMPLETION_PATTERNS = [
    re.compile(r"\b(just\s+)?(finished|done|completed)\b", re.IGNORECASE),
    re.compile(
        r"\bfinished\s+(the\s+)?(report|meeting|task|workout|class|coding)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(wrapped\s+up|got\s+done\s+with)\s+(the\s+)?(report|meeting|task|class|workout|call)\b",
        re.IGNORECASE,
    ),
    re.compile(r"\b(sent\s+out\s+the\s+report)\b", re.IGNORECASE),
]

EN_FUTURE_OR_PLAN_PATTERNS = [
    re.compile(
        r"\b(tomorrow|later|soon|tonight|later\s+today|next\s+(hour|meeting|class|week))\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(gonna|going\s+to|plan\s+to|want\s+to|about\s+to|will|need\s+to|have\s+to)\b",
        re.IGNORECASE,
    ),
]

EN_LAST_ACTIVITY_REFERENCES = [
    "that",
    "it",
    "the meeting",
    "that meeting",
    "that task",
    "that call",
    "that report",
    "just now",
    "earlier",
    "earlier one",
    "what i just did",
    "that phone call",
    "that class",
    "that workout",
    "that training",
    "that lesson",
    "the call earlier",
    "the class earlier",
    "the workout earlier",
]

IT_ACTIVITY_VERBS = [
    "studio",
    "studiare",
    "studiando",
    "ho studiato",
    "lavoro",
    "lavorare",
    "lavorando",
    "ho lavorato",
    "riunione",
    "meeting",
    "corro",
    "correre",
    "correndo",
    "ho corso",
    "cammino",
    "camminare",
    "camminando",
    "scrivo",
    "scrivere",
    "scrivendo",
    "ho scritto",
    "allenamento",
    "palestra",
    "spesa",
    "ho comprato",
    "chiamata",
    "telefonata",
    "ticket",
    "report",
]

IT_MOOD_WORDS = [
    "stanco",
    "stanca",
    "stressato",
    "stressata",
    "ansioso",
    "ansiosa",
    "triste",
    "felice",
    "contento",
    "contenta",
    "calmo",
    "calma",
    "arrabbiato",
    "arrabbiata",
    "esausto",
    "esausta",
    "sollevato",
    "sollevata",
    "confuso",
    "confusa",
    "sollievo",
]

IT_MOOD_PATTERNS = [
    re.compile(
        r"\b(mi\s+sento|sono)\s+(molto\s+|troppo\s+|davvero\s+)?"
        r"(stanco|stanca|stressato|stressata|ansioso|ansiosa|triste|felice|calmo|calma|arrabbiato|arrabbiata|esausto|esausta|sollevato|sollevata|confuso|confusa)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(era|e\s+stata|e\s+stato|andata)\s+(stressante|pesante|ottima|bene|male)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\bmi\s+ha\s+(stressato|stressata|confuso|confusa|stancato|stancata)\b",
        re.IGNORECASE,
    ),
    re.compile(r"\bmi\s+ha\s+dato\s+sollievo\b", re.IGNORECASE),
]

IT_ACTIVITY_PATTERNS = [
    re.compile(
        r"\b(sto|stavo)\s+(studiando|lavorando|correndo|camminando|scrivendo)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(ho\s+appena\s+)?(fatto|finito)\s+(la\s+)?(riunione|chiamata|spesa|lezione|corsa)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(sto\s+scrivendo|sto\s+lavorando\s+su|sto\s+preparando)\s+(il\s+)?(report|documento|compito|codice|presentazione)\b",
        re.IGNORECASE,
    ),
    re.compile(r"\b(in\s+ufficio|in\s+palestra|a\s+scuola)\b", re.IGNORECASE),
    re.compile(r"\b(in|alla)\s+riunione\b", re.IGNORECASE),
    re.compile(r"\b(videochiamata|chiamata)\b", re.IGNORECASE),
    re.compile(r"\bho\s+appena\s+chiuso\s+il\s+ticket\b", re.IGNORECASE),
]

IT_STRONG_COMPLETION_PATTERNS = [
    re.compile(r"\b(ho\s+)?(finito|completato)\b", re.IGNORECASE),
    re.compile(r"\bappena\s+finito\b", re.IGNORECASE),
    re.compile(
        r"\b(ho\s+)?(chiuso|terminato)\s+(la\s+)?(riunione|chiamata|lezione|sessione)\b",
        re.IGNORECASE,
    ),
    re.compile(r"\b(ho\s+)?(inviato)\s+(il\s+)?(report|documento)\b", re.IGNORECASE),
]

IT_FUTURE_OR_PLAN_PATTERNS = [
    re.compile(
        r"\b(domani|dopo|piu\s+tardi|tra\s+poco|stasera|prossim[oa])\b", re.IGNORECASE
    ),
    re.compile(
        r"\b(voglio|vorrei|devo|andr[oò]|sto\s+per|andr[oò]\s+a|ho\s+intenzione\s+di)\b",
        re.IGNORECASE,
    ),
]

IT_LAST_ACTIVITY_REFERENCES = [
    "quello",
    "quella",
    "prima",
    "quella riunione",
    "riunione di prima",
    "quella chiamata",
    "quella lezione",
    "quel lavoro",
    "quella sessione",
    "la chiamata di prima",
    "quella cosa che ho fatto",
    "quella cosa",
]

ZH_NON_ACTIVITY_PATTERNS = [
    re.compile(r"什么都不想做"),
    re.compile(r"什么都没做"),
    re.compile(r"不想(开会|学习|上课|上班|运动|跑步|做|写)"),
    re.compile(r"想去.+但没去"),
    re.compile(r"明天要.+"),
    re.compile(r"待会(儿)?(去|要)?"),
    re.compile(r"等下(去|要)?"),
    re.compile(r"没有心情(开会|学习|上课|上班|工作|运动)"),
]


def includes_any(text: str, words: list[str]) -> bool:
    return any(word in text for word in words)


def has_cjk(text: str) -> bool:
    return bool(re.search(r"[\u3400-\u9fff]", text))


def has_latin(text: str) -> bool:
    return bool(re.search(r"[A-Za-z\u00C0-\u017F]", text))


def detect_latin_language(text: str) -> str:
    lowered = text.lower()
    if includes_any(
        lowered,
        [
            "sono",
            "sto ",
            "stanco",
            "felice",
            "riunione",
            "domani",
            "appena",
            "palestra",
            "lezione",
            "lavoro",
            "chiamata",
            "mi sento",
            "quella",
            "sollievo",
        ],
    ):
        return "it"
    return "en"


def extract_latin_keywords(text: str) -> list[str]:
    tokens = [
        token
        for token in re.split(r"[^a-z\u00c0-\u017f]+", text.lower())
        if len(token) >= 4
    ]
    return list(dict.fromkeys(tokens))


def has_latin_context_keyword_overlap(text: str, context_text: str) -> bool:
    text_tokens = extract_latin_keywords(text)
    if not text_tokens:
        return False
    context_tokens = set(extract_latin_keywords(context_text))
    return any(token in context_tokens for token in text_tokens)


def extract_activity_keywords(input_text: str) -> list[str]:
    seen: set[str] = set()
    for token in ZH_CONTEXT_ACTIVITY_KEYWORDS:
        if token in input_text:
            seen.add(token)
    return list(seen)


def has_context_keyword_overlap(text: str, context_text: str) -> bool:
    current_tokens = extract_activity_keywords(text)
    if not current_tokens:
        return False
    context_tokens = set(extract_activity_keywords(context_text))
    return any(token in context_tokens for token in current_tokens)


def punct_only(text: str) -> bool:
    return all(ch.isspace() or unicodedata.category(ch)[0] in {"P", "S"} for ch in text)


def normalize(raw: str) -> tuple[str, bool]:
    trimmed = " ".join(raw.strip().split())
    if not trimmed or punct_only(trimmed):
        return "", False

    normalized = trimmed.replace("，", ",").replace("、", ",")
    for punct in ["。", "！", "？", "；", "："]:
        normalized = normalized.replace(punct, ".")
    normalized = re.sub(r"[啊呀呢吧嘛哦哈]$", "", normalized)
    return normalized, bool(normalized)


def has_activity_signal(text: str) -> bool:
    if text in {"吃", "跑", "学"}:
        return True
    if includes_any(text, ZH_ACTIVITY_STRONG_PHRASES):
        return True
    if includes_any(text, ZH_ACTIVITY_OBJECTS) and includes_any(
        text, ZH_ACTIVITY_VERBS
    ):
        return True
    if any(pattern.search(text) for pattern in ZH_ACTIVITY_SINGLE_VERB_PATTERNS):
        return True
    return includes_any(text, ZH_ACTIVITY_VERBS)


def has_mood_signal(text: str) -> bool:
    if includes_any(text, ZH_MOOD_WORDS):
        return True
    if re.search(
        r"(好累|好烦|很开心|很顺利|感觉轻松|不太确定|不满意|没信心|很失望|[得地]很(好|顺利))",
        text,
    ):
        return True
    if re.search(r"(感觉不错|很好|什么正事没干)", text):
        return True
    return any(pattern.search(text) for pattern in ZH_MOOD_PATTERNS)


def has_non_activity_signal(text: str) -> bool:
    return any(pattern.search(text) for pattern in ZH_NON_ACTIVITY_PATTERNS)


def contains_new_activity_signal(text: str) -> bool:
    if includes_any(
        text, ["去洗澡", "去吃饭", "开始学习", "去运动", "去散步", "去健身房"]
    ):
        return True
    return includes_any(text, ZH_NEW_ACTIVITY_SWITCHES) and includes_any(
        text, ZH_ACTIVITY_VERBS
    )


def classify_latin(content: str, last_activity_context: str | None) -> tuple[str, str]:
    text, meaningful = normalize(content)
    if not meaningful:
        return "mood", "standalone_mood"

    lowered = text.lower()
    lang = detect_latin_language(lowered)

    activity_verbs = IT_ACTIVITY_VERBS if lang == "it" else EN_ACTIVITY_VERBS
    mood_words = IT_MOOD_WORDS if lang == "it" else EN_MOOD_WORDS
    mood_patterns = IT_MOOD_PATTERNS if lang == "it" else EN_MOOD_PATTERNS
    activity_patterns = IT_ACTIVITY_PATTERNS if lang == "it" else EN_ACTIVITY_PATTERNS
    completion_patterns = (
        IT_STRONG_COMPLETION_PATTERNS if lang == "it" else EN_STRONG_COMPLETION_PATTERNS
    )
    future_patterns = (
        IT_FUTURE_OR_PLAN_PATTERNS if lang == "it" else EN_FUTURE_OR_PLAN_PATTERNS
    )
    references = (
        IT_LAST_ACTIVITY_REFERENCES if lang == "it" else EN_LAST_ACTIVITY_REFERENCES
    )

    scores = {"activity": 0, "mood": 0}

    has_future_plan = any(pattern.search(lowered) for pattern in future_patterns)
    if has_future_plan:
        return "mood", "standalone_mood"

    has_activity = includes_any(lowered, activity_verbs) or any(
        pattern.search(lowered) for pattern in activity_patterns
    )
    has_mood = includes_any(lowered, mood_words) or any(
        pattern.search(lowered) for pattern in mood_patterns
    )
    has_strong_completion = any(
        pattern.search(lowered) for pattern in completion_patterns
    )

    if has_activity:
        scores["activity"] += 3
    if has_strong_completion:
        scores["activity"] += 2
    if has_mood:
        scores["mood"] += 2

    if last_activity_context:
        references_last = (
            has_strong_completion
            or includes_any(lowered, references)
            or has_latin_context_keyword_overlap(lowered, last_activity_context)
        )
        if references_last and has_mood and scores["activity"] <= scores["mood"] + 1:
            return "mood", "mood_about_last_activity"

    if has_activity and has_mood:
        return "activity", "activity_with_mood"
    if scores["activity"] > scores["mood"]:
        return "activity", "new_activity"
    return "mood", "standalone_mood"


def classify(content: str, last_activity_context: str | None) -> tuple[str, str]:
    if not has_cjk(content) and has_latin(content):
        return classify_latin(content, last_activity_context)

    text, meaningful = normalize(content)
    scores = {"activity": 0, "mood": 0}
    if not meaningful:
        return "mood", "standalone_mood"

    if re.fullmatch(r"finally\s+done", text, re.IGNORECASE):
        return "activity", "new_activity"

    has_activity = has_activity_signal(text)
    has_mood = has_mood_signal(text)
    has_non_activity = has_non_activity_signal(text)
    has_strong_completion = includes_any(text, ZH_FINISHING_PHRASES) or any(
        pattern.search(text) for pattern in ZH_STRONG_COMPLETION_PATTERNS
    )
    has_weak_completion = includes_any(text, ZH_WEAK_COMPLETION_WORDS)

    if has_non_activity and not contains_new_activity_signal(text):
        has_activity = False

    if has_activity:
        scores["activity"] += 3
    if has_strong_completion:
        scores["activity"] += 2
    if has_mood:
        scores["mood"] += 2
    if has_weak_completion:
        has_mood = True
        scores["mood"] += 1
    if has_non_activity:
        scores["activity"] = max(0, scores["activity"] - 3)
        scores["mood"] += 2
    if len(text) <= 3 and not has_activity:
        scores["mood"] += 1

    if not last_activity_context and re.search(
        r"workout\s+was\s+\w+", text, re.IGNORECASE
    ):
        return "mood", "mood_about_last_activity"

    if last_activity_context:
        references = includes_any(
            text, ZH_LAST_ACTIVITY_REFERENCES
        ) or has_context_keyword_overlap(text, last_activity_context)
        has_evaluation = includes_any(text, ZH_EVALUATION_WORDS) or has_mood
        has_strong_new_activity = contains_new_activity_signal(text)

        if references and has_evaluation and not has_strong_new_activity:
            return "mood", "mood_about_last_activity"

    if has_activity and has_mood:
        return "activity", "activity_with_mood"
    if scores["activity"] > scores["mood"]:
        return "activity", "new_activity"
    return "mood", "standalone_mood"


def load_samples(path: Path) -> list[dict[str, str | int | None]]:
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.active
    if ws is None:
        return []
    rows = list(ws.iter_rows(values_only=True))
    header = rows[0]
    samples = []
    for row in rows[1:]:
        if not any(cell is not None for cell in row):
            continue
        samples.append(dict(zip(header, row)))
    return samples


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Evaluate live input classifier with gold samples."
    )
    parser.add_argument("--lang", default="all", help="Filter by lang, for example: zh")
    parser.add_argument(
        "--top-errors", type=int, default=15, help="How many errors to show"
    )
    parser.add_argument(
        "--gold-path",
        default=str(
            Path(__file__).resolve().parent.parent.parent
            / "timeshine_gold_samples.xlsx"
        ),
        help="Path to timeshine_gold_samples.xlsx",
    )
    args = parser.parse_args()

    samples = load_samples(Path(args.gold_path))
    if args.lang != "all":
        samples = [sample for sample in samples if sample.get("lang") == args.lang]

    total = len(samples)
    if total == 0:
        print("No samples found for the selected filter.")
        return

    correct_kind = 0
    correct_internal = 0
    mismatch_pairs: Counter[tuple[str, str]] = Counter()
    error_rows = []

    per_expected = defaultdict(lambda: [0, 0])
    per_difficulty = defaultdict(lambda: [0, 0])

    for sample in samples:
        content = str(sample["input"])
        expected_kind = str(sample["expected_kind"])
        expected_internal = str(sample["expected_internal_kind"])
        context = sample.get("last_activity_context")
        context = str(context) if context is not None else None

        predicted_kind, predicted_internal = classify(content, context)

        if predicted_kind == expected_kind:
            correct_kind += 1
        if predicted_internal == expected_internal:
            correct_internal += 1

        per_expected[expected_internal][1] += 1
        per_expected[expected_internal][0] += int(
            predicted_internal == expected_internal
        )

        difficulty = str(sample.get("difficulty") or "unknown")
        per_difficulty[difficulty][1] += 1
        per_difficulty[difficulty][0] += int(predicted_internal == expected_internal)

        if predicted_internal != expected_internal:
            mismatch_pairs[(expected_internal, predicted_internal)] += 1
            error_rows.append(
                {
                    "id": sample.get("id"),
                    "input": content,
                    "ctx": context,
                    "expected": expected_internal,
                    "predicted": predicted_internal,
                    "difficulty": difficulty,
                }
            )

    print(f"samples={total}")
    print(f"kind_accuracy={correct_kind}/{total}={correct_kind / total:.2%}")
    print(
        f"internal_accuracy={correct_internal}/{total}={correct_internal / total:.2%}"
    )
    print("")
    print("top_mismatch_pairs:")
    for (expected, predicted), count in mismatch_pairs.most_common(8):
        print(f"  {expected} -> {predicted}: {count}")
    print("")
    print("recall_by_expected_internal:")
    for key, (hit, count) in sorted(per_expected.items()):
        print(f"  {key}: {hit}/{count}={hit / count:.2%}")
    print("")
    print("accuracy_by_difficulty:")
    for key, (hit, count) in sorted(per_difficulty.items()):
        print(f"  {key}: {hit}/{count}={hit / count:.2%}")

    if error_rows:
        print("")
        print(f"first_{args.top_errors}_errors:")
        for row in error_rows[: args.top_errors]:
            print(
                f"  id={row['id']} input={row['input']} ctx={row['ctx']} "
                f"expected={row['expected']} predicted={row['predicted']} difficulty={row['difficulty']}"
            )


if __name__ == "__main__":
    main()
