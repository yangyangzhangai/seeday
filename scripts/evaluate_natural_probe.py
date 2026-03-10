#!/usr/bin/env python3
"""Evaluate classifier on newly written natural-speech probe samples."""

from __future__ import annotations

from collections import Counter, defaultdict

from evaluate_live_input_gold import classify


SAMPLES = [
    {"input": "我刚吃完晚饭", "ctx": None, "expected": "new_activity"},
    {"input": "在开晨会，等会回你", "ctx": None, "expected": "new_activity"},
    {"input": "刚到公司", "ctx": None, "expected": "new_activity"},
    {"input": "我在写周报", "ctx": None, "expected": "new_activity"},
    {"input": "去洗个澡先", "ctx": None, "expected": "new_activity"},
    {"input": "下课了", "ctx": None, "expected": "new_activity"},
    {"input": "午休睡了二十分钟", "ctx": None, "expected": "new_activity"},
    {"input": "晚上和朋友聚餐", "ctx": None, "expected": "new_activity"},
    {"input": "刚通完电话", "ctx": None, "expected": "new_activity"},
    {"input": "在健身房练腿", "ctx": None, "expected": "new_activity"},
    {"input": "刚跑完步", "ctx": None, "expected": "new_activity"},
    {"input": "我在背单词", "ctx": None, "expected": "new_activity"},
    {"input": "今天下午一直在改代码", "ctx": None, "expected": "new_activity"},
    {"input": "出门了，一会聊", "ctx": None, "expected": "new_activity"},
    {"input": "刚把作业交了", "ctx": None, "expected": "new_activity"},
    {"input": "吃", "ctx": None, "expected": "new_activity"},
    {"input": "跑", "ctx": None, "expected": "new_activity"},
    {"input": "学", "ctx": None, "expected": "new_activity"},
    {"input": "in a meeting now", "ctx": None, "expected": "new_activity"},
    {"input": "just had lunch", "ctx": None, "expected": "new_activity"},
    {"input": "working on slides", "ctx": None, "expected": "new_activity"},
    {"input": "finally done", "ctx": None, "expected": "new_activity"},
    {"input": "sto studiando", "ctx": None, "expected": "new_activity"},
    {"input": "ho finito di lavorare", "ctx": None, "expected": "new_activity"},
    {
        "input": "开了两个小时会，头都大了",
        "ctx": None,
        "expected": "activity_with_mood",
    },
    {"input": "背了一晚单词，好烦", "ctx": None, "expected": "activity_with_mood"},
    {"input": "跑了5公里，感觉不错", "ctx": None, "expected": "activity_with_mood"},
    {"input": "和客户会开得很顺利", "ctx": None, "expected": "activity_with_mood"},
    {"input": "看了电影但挺失望", "ctx": None, "expected": "activity_with_mood"},
    {"input": "做了决定，但心里还是慌", "ctx": None, "expected": "activity_with_mood"},
    {"input": "刚打完球，好爽", "ctx": None, "expected": "activity_with_mood"},
    {"input": "写完报告了，终于松口气", "ctx": None, "expected": "activity_with_mood"},
    {"input": "午休睡得很好", "ctx": None, "expected": "activity_with_mood"},
    {
        "input": "刷了一下午短视频，什么正事没干",
        "ctx": None,
        "expected": "activity_with_mood",
    },
    {"input": "和室友吵架了，心情很差", "ctx": None, "expected": "activity_with_mood"},
    {"input": "买到想要的东西，开心", "ctx": None, "expected": "activity_with_mood"},
    {"input": "做了但不满意", "ctx": None, "expected": "activity_with_mood"},
    {"input": "撑过去了，太累了", "ctx": None, "expected": "activity_with_mood"},
    {
        "input": "finished the report finally",
        "ctx": None,
        "expected": "activity_with_mood",
    },
    {"input": "workout was great", "ctx": None, "expected": "mood_about_last_activity"},
    {"input": "这个会真离谱", "ctx": "开会", "expected": "mood_about_last_activity"},
    {
        "input": "这件事搞得我很焦虑",
        "ctx": "和客户沟通",
        "expected": "mood_about_last_activity",
    },
    {
        "input": "刚才那个感觉不太对",
        "ctx": "做决定",
        "expected": "mood_about_last_activity",
    },
    {
        "input": "这种感觉好久没有了",
        "ctx": "跑步",
        "expected": "mood_about_last_activity",
    },
    {
        "input": "终于搞定了，心里踏实了",
        "ctx": "修Bug",
        "expected": "mood_about_last_activity",
    },
    {
        "input": "后悔刚才说重话了",
        "ctx": "和同事沟通",
        "expected": "mood_about_last_activity",
    },
    {
        "input": "那个会开得我好累",
        "ctx": "开会",
        "expected": "mood_about_last_activity",
    },
    {
        "input": "这件事情让我有点烦",
        "ctx": "做作业",
        "expected": "mood_about_last_activity",
    },
    {"input": "心情挺平静的", "ctx": "散步", "expected": "mood_about_last_activity"},
    {
        "input": "那个电话打完后整个人都放松了",
        "ctx": "给客户打电话",
        "expected": "mood_about_last_activity",
    },
    {
        "input": "刚才那节课让我有点挫败",
        "ctx": "上课",
        "expected": "mood_about_last_activity",
    },
    {
        "input": "that meeting drained me",
        "ctx": "meeting",
        "expected": "mood_about_last_activity",
    },
    {
        "input": "quella riunione mi ha stressato",
        "ctx": "riunione",
        "expected": "mood_about_last_activity",
    },
    {"input": "我现在有点焦虑", "ctx": None, "expected": "standalone_mood"},
    {"input": "今天状态不太好", "ctx": None, "expected": "standalone_mood"},
    {"input": "好烦啊", "ctx": None, "expected": "standalone_mood"},
    {"input": "很开心", "ctx": None, "expected": "standalone_mood"},
    {"input": "没精神", "ctx": None, "expected": "standalone_mood"},
    {"input": "压力大到想哭", "ctx": None, "expected": "standalone_mood"},
    {"input": "累到不想说话", "ctx": None, "expected": "standalone_mood"},
    {"input": "睡眠不好", "ctx": None, "expected": "standalone_mood"},
    {"input": "没有心情工作", "ctx": None, "expected": "standalone_mood"},
    {"input": "等下去吃饭", "ctx": None, "expected": "standalone_mood"},
    {"input": "待会要开会", "ctx": None, "expected": "standalone_mood"},
    {"input": "明天要写报告", "ctx": None, "expected": "standalone_mood"},
    {"input": "想去跑步但没去", "ctx": None, "expected": "standalone_mood"},
    {"input": "准备去健身但现在懒得动", "ctx": None, "expected": "standalone_mood"},
    {"input": "later I will go for a run", "ctx": None, "expected": "standalone_mood"},
    {"input": "domani vado a correre", "ctx": None, "expected": "standalone_mood"},
    {"input": "什么都不想做", "ctx": None, "expected": "standalone_mood"},
    {"input": "什么都没做", "ctx": None, "expected": "standalone_mood"},
    {"input": "心情一般", "ctx": None, "expected": "standalone_mood"},
    {"input": "刚把总结发出去了", "ctx": None, "expected": "new_activity"},
    {"input": "ho appena inviato il report", "ctx": None, "expected": "new_activity"},
    {"input": "写完文档了，心里踏实了", "ctx": None, "expected": "activity_with_mood"},
    {
        "input": "just wrapped up the task, feeling relieved",
        "ctx": None,
        "expected": "activity_with_mood",
    },
    {"input": "刚开完复盘会", "ctx": None, "expected": "new_activity"},
    {"input": "在地铁上去公司", "ctx": None, "expected": "new_activity"},
    {"input": "刚把邮件回完", "ctx": None, "expected": "new_activity"},
    {"input": "下午一直在写测试", "ctx": None, "expected": "new_activity"},
    {"input": "正在整理会议纪要", "ctx": None, "expected": "new_activity"},
    {"input": "和同事在讨论方案", "ctx": None, "expected": "new_activity"},
    {"input": "刚到健身房准备热身", "ctx": None, "expected": "new_activity"},
    {"input": "午饭吃完了", "ctx": None, "expected": "new_activity"},
    {"input": "刚回到家", "ctx": None, "expected": "new_activity"},
    {"input": "reviewing the PR now", "ctx": None, "expected": "new_activity"},
    {"input": "just sent the update", "ctx": None, "expected": "new_activity"},
    {"input": "in the middle of debugging", "ctx": None, "expected": "new_activity"},
    {"input": "ho appena chiuso il ticket", "ctx": None, "expected": "new_activity"},
    {
        "input": "sto preparando la presentazione",
        "ctx": None,
        "expected": "new_activity",
    },
    {"input": "开会开得头疼", "ctx": None, "expected": "activity_with_mood"},
    {"input": "跑完步整个人都轻松了", "ctx": None, "expected": "activity_with_mood"},
    {"input": "改了一下午bug，人麻了", "ctx": None, "expected": "activity_with_mood"},
    {"input": "和客户沟通完有点焦虑", "ctx": None, "expected": "activity_with_mood"},
    {"input": "写完计划表感觉踏实", "ctx": None, "expected": "activity_with_mood"},
    {"input": "打完电话更烦了", "ctx": None, "expected": "activity_with_mood"},
    {"input": "上完课有点困", "ctx": None, "expected": "activity_with_mood"},
    {
        "input": "meeting was productive and I feel good",
        "ctx": None,
        "expected": "activity_with_mood",
    },
    {
        "input": "finished coding, totally drained",
        "ctx": None,
        "expected": "activity_with_mood",
    },
    {
        "input": "ho finito di correre, mi sento bene",
        "ctx": None,
        "expected": "activity_with_mood",
    },
    {
        "input": "la chiamata mi ha stancato",
        "ctx": None,
        "expected": "activity_with_mood",
    },
    {
        "input": "那个任务做完后轻松多了",
        "ctx": "写测试",
        "expected": "mood_about_last_activity",
    },
    {
        "input": "刚才那通电话让我很烦",
        "ctx": "给客户打电话",
        "expected": "mood_about_last_activity",
    },
    {
        "input": "这个会开得我有点崩",
        "ctx": "开会",
        "expected": "mood_about_last_activity",
    },
    {
        "input": "这次训练后状态不错",
        "ctx": "跑步",
        "expected": "mood_about_last_activity",
    },
    {
        "input": "那份作业做完挺有成就感",
        "ctx": "做作业",
        "expected": "mood_about_last_activity",
    },
    {
        "input": "that task made me anxious",
        "ctx": "task",
        "expected": "mood_about_last_activity",
    },
    {
        "input": "the meeting earlier felt pointless",
        "ctx": "meeting",
        "expected": "mood_about_last_activity",
    },
    {
        "input": "quella lezione mi ha confuso",
        "ctx": "lezione",
        "expected": "mood_about_last_activity",
    },
    {
        "input": "quel lavoro mi ha dato sollievo",
        "ctx": "lavoro",
        "expected": "mood_about_last_activity",
    },
    {"input": "今天心里很乱", "ctx": None, "expected": "standalone_mood"},
    {"input": "有点提不起劲", "ctx": None, "expected": "standalone_mood"},
    {"input": "状态一般般", "ctx": None, "expected": "standalone_mood"},
    {"input": "情绪低到谷底", "ctx": None, "expected": "standalone_mood"},
    {"input": "现在特别放松", "ctx": None, "expected": "standalone_mood"},
    {"input": "我不想说话", "ctx": None, "expected": "standalone_mood"},
    {
        "input": "later maybe I will work out",
        "ctx": None,
        "expected": "standalone_mood",
    },
    {"input": "tomorrow I plan to study", "ctx": None, "expected": "standalone_mood"},
    {"input": "mi sento un po' giu", "ctx": None, "expected": "standalone_mood"},
    {"input": "domani voglio allenarmi", "ctx": None, "expected": "standalone_mood"},
]


ITALIAN_HINTS = {
    " sto ",
    " ho ",
    " appena ",
    " riunione",
    "domani",
    "vado",
    "correre",
    "quella",
    " stressato",
    " inviato ",
}


def detect_lang_bucket(text: str) -> str:
    if any("\u4e00" <= ch <= "\u9fff" for ch in text):
        return "zh"

    lowered = f" {text.lower()} "
    if any(token in lowered for token in ITALIAN_HINTS):
        return "it"

    return "en"


def main() -> None:
    total = len(SAMPLES)
    correct_kind = 0
    correct_internal = 0
    mismatch_pairs: Counter[tuple[str, str]] = Counter()
    per_expected = defaultdict(lambda: [0, 0])
    per_lang = defaultdict(lambda: [0, 0])
    per_lang_internal = defaultdict(lambda: [0, 0])

    error_rows = []
    for i, sample in enumerate(SAMPLES, start=1):
        expected_internal = sample["expected"]
        expected_kind = "activity" if expected_internal != "standalone_mood" else "mood"
        predicted_kind, predicted_internal = classify(sample["input"], sample["ctx"])
        lang = detect_lang_bucket(sample["input"])

        if predicted_kind == expected_kind:
            correct_kind += 1
        if predicted_internal == expected_internal:
            correct_internal += 1

        per_lang[lang][1] += 1
        per_lang[lang][0] += int(predicted_internal == expected_internal)

        lang_internal_key = f"{lang}:{expected_internal}"
        per_lang_internal[lang_internal_key][1] += 1
        per_lang_internal[lang_internal_key][0] += int(
            predicted_internal == expected_internal
        )

        per_expected[expected_internal][1] += 1
        per_expected[expected_internal][0] += int(
            predicted_internal == expected_internal
        )

        if predicted_internal != expected_internal:
            mismatch_pairs[(expected_internal, predicted_internal)] += 1
            error_rows.append(
                {
                    "id": i,
                    "input": sample["input"],
                    "ctx": sample["ctx"],
                    "expected": expected_internal,
                    "predicted": predicted_internal,
                }
            )

    print(f"samples={total}")
    print(f"kind_accuracy={correct_kind}/{total}={correct_kind / total:.2%}")
    print(
        f"internal_accuracy={correct_internal}/{total}={correct_internal / total:.2%}"
    )
    print("")
    print("mismatch_pairs:")
    for (expected, predicted), count in mismatch_pairs.most_common():
        print(f"  {expected} -> {predicted}: {count}")
    print("")
    print("recall_by_expected_internal:")
    for key, (hit, count) in sorted(per_expected.items()):
        print(f"  {key}: {hit}/{count}={hit / count:.2%}")

    print("")
    print("accuracy_by_lang:")
    for key, (hit, count) in sorted(per_lang.items()):
        print(f"  {key}: {hit}/{count}={hit / count:.2%}")

    print("")
    print("recall_by_lang_expected_internal:")
    for key, (hit, count) in sorted(per_lang_internal.items()):
        print(f"  {key}: {hit}/{count}={hit / count:.2%}")

    if error_rows:
        print("")
        print("errors:")
        for row in error_rows:
            print(
                f"  id={row['id']} input={row['input']} ctx={row['ctx']} "
                f"expected={row['expected']} predicted={row['predicted']}"
            )


if __name__ == "__main__":
    main()
