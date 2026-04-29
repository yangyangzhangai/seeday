import openpyxl
import random


def generate_samples():
    new_activities = [
        "working on the report",
        "just had a meeting",
        "went for a run",
        "grabbing coffee",
        "sending emails",
        "preparing the presentation",
        "in a 1:1",
        "doing the laundry",
        "cramming for the exam",
        "taking a shower",
        "got ready for bed",
        "played soccer",
        "swimming",
        "leg day",
        "watching a movie",
        "hanging out with friends",
        "called my mom",
        "went to a museum",
        "chatting with friends",
        "grabbing dinner",
        "back-to-back meetings",
        "reading a novel",
        "journaling",
        "doctor appointment",
        "paying the bills",
        "playing games",
        "on my way to the office",
        "video call",
        "pulled an all-nighter",
        "got promoted",
        "wrapped the sprint",
        "meal prepped",
        "hit the gym",
        "took a nap",
        "hopped on a call",
        "got a haircut",
        "ran errands",
        "knocked out the workout",
        "binge watching anime",
        "ordered takeout",
        "went for a hike",
        "did my night routine",
        "did some lifting",
        "hit a new pr",
        "did some sketching",
        "played the guitar",
        "just landed at the airport",
        "packed my bag",
        "went to therapy",
        "did some breathwork",
        "volunteered",
        "went to the pharmacy",
        "picked up prescription",
        "writing code",
        "debugging the system",
        "deploying to production",
        "reading articles",
        "cooking dinner",
        "doing dishes",
        "cleaning the house",
        "vacuuming",
        "mop the floor",
        "driving to work",
        "taking the subway",
        "biking to school",
        "studying for midterm",
        "doing flashcards",
        "meditating",
        "stretching",
        "doing yoga",
        "lifting weights",
        "bouldering",
        "climbing",
        "boxing",
        "martial arts",
        "playing tennis",
        "golfing",
        "attending a lecture",
        "office hours",
        "meeting with advisor",
        "working on assignment",
    ]

    activity_with_mood = [
        "working on the report, it's so stressful",
        "just had a great meeting",
        "went for a run, feeling exhausted",
        "grabbing a coffee, much needed",
        "sending annoying emails",
        "preparing the presentation, feeling overwhelmed",
        "in a 1:1, went really well",
        "doing the laundry, so boring",
        "cramming for the exam, freaking out",
        "taking a nice shower",
        "got ready for bed, dead tired",
        "played soccer, feeling pumped",
        "swimming was so peaceful",
        "leg day crushed it",
        "watching a terrible movie",
        "hanging out with friends, super happy",
        "called my mom, feeling better",
        "went to a museum, very inspiring",
        "chatting with friends, so chill",
        "grabbing dinner, starving",
        "back-to-back meetings, brain is fried",
        "reading a novel, so relaxing",
        "journaling to feel grounded",
        "doctor appointment making me anxious",
        "paying the bills, feeling relieved",
        "playing games, feeling hyped",
        "on my way to the office, dreading it",
        "video call was awful",
        "pulled an all-nighter, totally wrecked",
        "got promoted! over the moon!",
        "wrapped the sprint, satisfied",
        "meal prepped, feeling productive",
        "hit the gym, feeling strong",
    ]

    standalone_mood = [
        "feeling very tired",
        "so stressed out right now",
        "I'm incredibly happy",
        "anxious about everything",
        "just feeling numb",
        "I feel so calm",
        "feeling completely exhausted",
        "so overwhelmed",
        "feeling relieved",
        "I'm feeling a bit blue",
        "I am doing fine",
        "this is so draining",
        "I'm dead on my feet",
        "feeling pretty restless",
        "feel really great",
        "feels so good",
        "I feel so blue",
        "kinda down today",
        "I am so over it",
        "weight off my shoulders",
        "dreading this",
        "running on fumes",
        "brain is totally fried",
        "feeling guilty",
        "so sore today",
        "made my day",
        "crushed it",
        "feeling kinda great",
        "I'm feeling good",
        "feeling content",
        "what a rough day",
        "such a tough week",
        "feeling a bit low",
        "I feel sharp",
        "what a day",
        "can't be bothered",
        "had enough",
        "barely surviving",
        "need a coffee",
        "haven't slept",
        "hit a wall",
        "so motivated",
        "fired up today",
        "in the zone today",
        "can't stop thinking about it",
        "losing my mind",
        "can't focus",
        "feeling super proud",
        "not feeling great",
        "just not my day",
    ]

    mood_about_last = [
        "that went surprisingly well",
        "it was a waste of time",
        "made me cry",
        "left me feeling centered",
        "such a good time",
        "way harder than expected",
        "sore from that",
        "it was rough",
        "that meeting was so long",
        "the workout killed me",
        "the presentation went smoothly",
        "that call was annoying",
        "the commute was terrible",
        "that class was boring",
        "the dinner was amazing",
        "the movie was awful",
        "that was exhausting",
        "that really stressed me out",
        "the run felt great",
        "the exam was brutal",
        "that test was easy",
        "it felt pointless",
        "the whole thing was a mess",
        "that was super fun",
    ]

    contexts = [
        "just had a meeting",
        "went for a run",
        "coding",
        "studying",
        "cooking",
        "watching a movie",
        "driving",
    ]

    samples = []

    # Generate 150 new_activity
    for i in range(150):
        samples.append(
            {
                "id": i + 1,
                "input": random.choice(new_activities),
                "lang": "en",
                "last_activity_context": None,
                "expected_kind": "activity",
                "expected_internal_kind": "new_activity",
                "difficulty": "easy",
            }
        )

    # Generate 60 activity_with_mood
    for i in range(60):
        samples.append(
            {
                "id": i + 151,
                "input": random.choice(activity_with_mood),
                "lang": "en",
                "last_activity_context": None,
                "expected_kind": "activity",
                "expected_internal_kind": "activity_with_mood",
                "difficulty": "medium",
            }
        )

    # Generate 60 standalone_mood
    for i in range(60):
        samples.append(
            {
                "id": i + 211,
                "input": random.choice(standalone_mood),
                "lang": "en",
                "last_activity_context": None,
                "expected_kind": "mood",
                "expected_internal_kind": "standalone_mood",
                "difficulty": "easy",
            }
        )

    # Generate 30 mood_about_last_activity
    for i in range(30):
        samples.append(
            {
                "id": i + 271,
                "input": random.choice(mood_about_last),
                "lang": "en",
                "last_activity_context": random.choice(contexts),
                "expected_kind": "mood",
                "expected_internal_kind": "mood_about_last_activity",
                "difficulty": "hard",
            }
        )

    random.shuffle(samples)

    # Reassign IDs just to be clean
    for idx, s in enumerate(samples):
        s["id"] = idx + 1

    wb = openpyxl.Workbook()
    ws = wb.active

    headers = [
        "id",
        "input",
        "lang",
        "last_activity_context",
        "expected_kind",
        "expected_internal_kind",
        "difficulty",
    ]
    ws.append(headers)

    for s in samples:
        ws.append(
            [
                s["id"],
                s["input"],
                s["lang"],
                s["last_activity_context"],
                s["expected_kind"],
                s["expected_internal_kind"],
                s["difficulty"],
            ]
        )

    wb.save("seeday_en_samples.xlsx")
    print("Created seeday_en_samples.xlsx with 300 test cases.")


if __name__ == "__main__":
    generate_samples()
