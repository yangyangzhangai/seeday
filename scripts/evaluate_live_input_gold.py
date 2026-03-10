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
]

ZH_ACTIVITY_SINGLE_VERB_PATTERNS = [
    re.compile(r"吃[了过]?(饭|早餐|午饭|晚饭)"),
    re.compile(r"写(代码|周报|作业|方案|文档|报告|论文)"),
    re.compile(r"做(作业|饭|题|计划|决定|项目)"),
    re.compile(r"开(会|晨会|例会)"),
    re.compile(r"学(习|英语|数学|单词)"),
    re.compile(r"背(单词|课文)"),
    re.compile(r"刷(题|视频)"),
    re.compile(r"跑(步|完步)"),
    re.compile(r"(在|刚在|正在)搞"),
    re.compile(r"搞定了?$"),
    re.compile(r"去健身房"),
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
]

ZH_MOOD_PATTERNS = [
    re.compile(r"^好.+"),
    re.compile(r"^很.+"),
    re.compile(r"^有点.+"),
    re.compile(r"^今天状态.+"),
    re.compile(r"真.+"),
    re.compile(r"心情.+"),
]

ZH_EVALUATION_WORDS = ["终于", "总算", "可算", "太难了", "好爽", "好充实", "后悔"]
ZH_LAST_ACTIVITY_REFERENCES = [
    "这件事",
    "这件事情",
    "这个",
    "刚才那个",
    "那个会",
    "刚才",
    "这种感觉",
]
ZH_FINISHING_PHRASES = ["做完了", "写完了", "结束了", "搞定了", "完成了"]
ZH_NEW_ACTIVITY_SWITCHES = ["然后", "接着", "后来去", "再去", "去"]

ZH_NON_ACTIVITY_PATTERNS = [
    re.compile(r"什么都不想做"),
    re.compile(r"什么都没做"),
    re.compile(r"不想(开会|学习|上课|上班|运动|跑步|做|写)"),
    re.compile(r"想去.+但没去"),
    re.compile(r"明天要.+"),
    re.compile(r"待会(儿)?(去|要)?"),
]


def includes_any(text: str, words: list[str]) -> bool:
    return any(word in text for word in words)


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


def classify(content: str, last_activity_context: str | None) -> tuple[str, str]:
    text, meaningful = normalize(content)
    scores = {"activity": 0, "mood": 0}
    if not meaningful:
        return "mood", "standalone_mood"

    has_activity = has_activity_signal(text)
    has_mood = has_mood_signal(text)
    has_non_activity = has_non_activity_signal(text)

    if has_activity:
        scores["activity"] += 3
    if has_mood:
        scores["mood"] += 2
    if has_non_activity:
        scores["activity"] = max(0, scores["activity"] - 3)
        scores["mood"] += 2
    if len(text) <= 3 and not has_activity:
        scores["mood"] += 1

    if last_activity_context:
        references = (
            includes_any(text, ZH_LAST_ACTIVITY_REFERENCES)
            or includes_any(text, ZH_FINISHING_PHRASES)
            or last_activity_context in text
        )
        has_evaluation = includes_any(text, ZH_EVALUATION_WORDS) or has_mood
        has_strong_new_activity = contains_new_activity_signal(text)

        if (references and has_evaluation and not has_strong_new_activity) or (
            not has_activity and has_evaluation and len(text) <= 5
        ):
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
