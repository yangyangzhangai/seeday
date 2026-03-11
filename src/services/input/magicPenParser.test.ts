import { describe, expect, it } from 'vitest';
import { parseMagicPenInput } from './magicPenParser';

const fixedNow = new Date(2026, 2, 11, 18, 0, 0, 0);

function getOnlyDraft(input: string) {
  return parseMagicPenInput(input, { now: fixedNow }).then((result) => {
    expect(result.drafts.length).toBe(1);
    return result.drafts[0];
  });
}

async function expectPeriodRange(input: string, startHour: number, endHour: number) {
  const draft = await getOnlyDraft(input);
  expect(draft.kind).toBe('activity_backfill');
  expect(draft.activity?.timeResolution).toBe('period');
  expect(new Date(draft.activity!.startAt!).getHours()).toBe(startHour);
  expect(new Date(draft.activity!.endAt!).getHours()).toBe(endHour);
}

function extractYmd(epoch?: number): string {
  if (!epoch) return '';
  const date = new Date(epoch);
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

describe('parseMagicPenInput basic parsing', () => {
  it('parses activity with exact time', async () => {
    const draft = await getOnlyDraft('今天10点开会');
    expect(draft.kind).toBe('activity_backfill');
    expect(draft.activity?.timeResolution).toBe('exact');
  });

  it('parses activity with exact colon time', async () => {
    const draft = await getOnlyDraft('今天10:30买菜');
    expect(draft.kind).toBe('activity_backfill');
    expect(new Date(draft.activity!.startAt!).getMinutes()).toBe(30);
  });

  it('parses todo from duty word', async () => {
    const draft = await getOnlyDraft('记得整理发票');
    expect(draft.kind).toBe('todo_add');
  });

  it('parses todo from future word', async () => {
    const draft = await getOnlyDraft('晚点给妈妈回电话');
    expect(draft.kind).toBe('todo_add');
  });

  it('sends vague sentence to unparsed', async () => {
    const result = await parseMagicPenInput('今天做了很多事', { now: fixedNow });
    expect(result.drafts.length).toBe(0);
    expect(result.unparsedSegments.length).toBe(1);
  });

  it('rejects cross-day sentence to unparsed', async () => {
    const result = await parseMagicPenInput('昨天开会', { now: fixedNow });
    expect(result.drafts.length).toBe(0);
    expect(result.unparsedSegments[0]).toBe('昨天开会');
  });
});

describe('parseMagicPenInput mixed segments', () => {
  it('splits by punctuation and parses activity + todo', async () => {
    const result = await parseMagicPenInput('今天上午改方案，晚上记得整理发票', { now: fixedNow });
    expect(result.drafts.length).toBe(2);
    expect(result.drafts.some((draft) => draft.kind === 'activity_backfill')).toBe(true);
    expect(result.drafts.some((draft) => draft.kind === 'todo_add')).toBe(true);
  });

  it('keeps connector signal for todo segment', async () => {
    const result = await parseMagicPenInput('今天上午改方案然后记得整理发票', { now: fixedNow });
    expect(result.drafts.length).toBe(2);
    expect(result.drafts[1].sourceText.includes('记得')).toBe(true);
  });

  it('supports multiline segments', async () => {
    const result = await parseMagicPenInput('今天上午开会\n晚点回消息', { now: fixedNow });
    expect(result.drafts.length).toBe(2);
  });

  it('assigns missing_time when activity lacks explicit time', async () => {
    const draft = await getOnlyDraft('今天开会');
    expect(draft.errors).toContain('missing_time');
    expect(draft.activity?.timeResolution).toBe('missing');
  });
});

describe('parseMagicPenInput period windows', () => {
  it('maps 上午 to 09:00-11:00', async () => {
    await expectPeriodRange('上午改方案', 9, 11);
  });

  it('maps 下午 to 15:00-17:00', async () => {
    await expectPeriodRange('下午买菜', 15, 17);
  });

  it('maps 晚上 to 20:00-21:00', async () => {
    await expectPeriodRange('晚上散步', 20, 21);
  });

  it('maps 中午 to 12:00-13:00', async () => {
    await expectPeriodRange('中午吃饭', 12, 13);
  });
});

describe('parseMagicPenInput explicit time ranges', () => {
  it('parses 从10点到12点 as exact range', async () => {
    const draft = await getOnlyDraft('今天从10点到12点开会');
    expect(draft.kind).toBe('activity_backfill');
    expect(draft.activity?.timeResolution).toBe('exact');
    expect(new Date(draft.activity!.startAt!).getHours()).toBe(10);
    expect(new Date(draft.activity!.endAt!).getHours()).toBe(12);
    expect(draft.needsUserConfirmation).toBe(false);
  });

  it('parses 下午3点到4:30 with period label normalization', async () => {
    const draft = await getOnlyDraft('今天下午3点到4:30写方案');
    expect(draft.kind).toBe('activity_backfill');
    expect(new Date(draft.activity!.startAt!).getHours()).toBe(15);
    expect(new Date(draft.activity!.endAt!).getHours()).toBe(16);
    expect(new Date(draft.activity!.endAt!).getMinutes()).toBe(30);
  });

  it('parses hyphen time range', async () => {
    const draft = await getOnlyDraft('今天10:30-11:45学习');
    expect(draft.kind).toBe('activity_backfill');
    expect(new Date(draft.activity!.startAt!).getMinutes()).toBe(30);
    expect(new Date(draft.activity!.endAt!).getMinutes()).toBe(45);
  });

  it('marks invalid range when end is earlier than start', async () => {
    const draft = await getOnlyDraft('今天从10点到9点开会');
    expect(draft.errors).toContain('invalid_time_range');
  });
});

describe('parseMagicPenInput todo-focused cases', () => {
  const todoInputs = [
    '记得交电费',
    '还要给团队发周报',
    '稍后回电话',
    '本周要买咖啡豆',
    '需要补一张发票',
    '别忘了取快递',
  ];

  for (const input of todoInputs) {
    it(`parses todo: ${input}`, async () => {
      const draft = await getOnlyDraft(input);
      expect(draft.kind).toBe('todo_add');
    });
  }

  it('extracts tomorrow dueDate and strips date word from content', async () => {
    const draft = await getOnlyDraft('明天考试');
    expect(draft.kind).toBe('todo_add');
    expect(draft.content).toBe('考试');
    expect(extractYmd(draft.todo?.dueDate)).toBe('2026-03-12');
  });

  it('extracts next weekday dueDate and strips signals from content', async () => {
    const draft = await getOnlyDraft('下周二记得交材料');
    expect(draft.kind).toBe('todo_add');
    expect(draft.content).toBe('交材料');
    expect(extractYmd(draft.todo?.dueDate)).toBe('2026-03-17');
  });

  it('supports numeric month-day dueDate', async () => {
    const draft = await getOnlyDraft('3.18旅游');
    expect(draft.kind).toBe('todo_add');
    expect(draft.content).toBe('旅游');
    expect(extractYmd(draft.todo?.dueDate)).toBe('2026-03-18');
  });

  it('supports chinese month-day dueDate', async () => {
    const draft = await getOnlyDraft('3月18号旅行');
    expect(draft.kind).toBe('todo_add');
    expect(draft.content).toBe('旅行');
    expect(extractYmd(draft.todo?.dueDate)).toBe('2026-03-18');
  });

  it('rolls yearless explicit date to next year when already past', async () => {
    const draft = await getOnlyDraft('2.10复查');
    expect(draft.kind).toBe('todo_add');
    expect(extractYmd(draft.todo?.dueDate)).toBe('2027-02-10');
  });

  it('splits compact multi-date todo input into multiple drafts', async () => {
    const result = await parseMagicPenInput('明天考试3月18旅游', { now: fixedNow });
    expect(result.drafts.length).toBe(2);
    expect(result.drafts[0].kind).toBe('todo_add');
    expect(result.drafts[1].kind).toBe('todo_add');
    expect(result.drafts[0].content).toBe('考试');
    expect(result.drafts[1].content).toBe('旅游');
  });
});

describe('parseMagicPenInput activity-focused cases', () => {
  const activityInputs = [
    '今天早上开会',
    '今天下午买菜',
    '刚刚通勤',
    '今天晚上做家务',
    '今天10点学习',
    '上午写方案',
  ];

  for (const input of activityInputs) {
    it(`parses activity: ${input}`, async () => {
      const draft = await getOnlyDraft(input);
      expect(draft.kind).toBe('activity_backfill');
    });
  }
});
