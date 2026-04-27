// DOC-DEPS: src/features/report/README.md, docs/PROJECT_MAP.md
import { getDaysInMonth, isSameDay } from 'date-fns';
import type { Report } from '../../store/useReportStore';

export type PageData = {
  type: 'cover' | 'day-left' | 'day-right' | 'blank' | 'back';
  dayNum?: number;
  date?: Date;
  report?: Report;
};

export type DiaryLang = 'zh' | 'en' | 'it';

export const DIARY_COPY: Record<DiaryLang, {
  pageTitle: string;
  sectionActivity: string;
  sectionMood: string;
  sectionTodo: string;
  sectionHabits: string;
  sectionObservation: string;
  sectionMyDiary: string;
  activityFallback: string;
  moodFallback: string;
  todoFallback: string;
  habitsFallback: string;
  observationFallback: string;
  diaryPlaceholder: string;
}> = {
  zh: {
    pageTitle: '日记',
    sectionActivity: '活动',
    sectionMood: '情绪',
    sectionTodo: '待办',
    sectionHabits: '习惯',
    sectionObservation: '观察日记',
    sectionMyDiary: '我的日记',
    activityFallback: '今天主要精力投入在工作上',
    moodFallback: '整体情绪比较轻松愉快',
    todoFallback: '你今天做得很好',
    habitsFallback: '继续保持，进度很稳',
    observationFallback: '今天也在慢慢生长。',
    diaryPlaceholder: '今天还没有写下内容。',
  },
  en: {
    pageTitle: 'diary',
    sectionActivity: 'activity',
    sectionMood: 'mood',
    sectionTodo: 'to-do',
    sectionHabits: 'habits',
    sectionObservation: 'observation',
    sectionMyDiary: 'my diary',
    activityFallback: 'Mostly working today',
    moodFallback: 'Feeling joyful most of the day',
    todoFallback: 'You did great today',
    habitsFallback: 'Nice rhythm, keep going',
    observationFallback: 'Growing slowly and steadily today.',
    diaryPlaceholder: 'No diary content yet.',
  },
  it: {
    pageTitle: 'diario',
    sectionActivity: 'attivita',
    sectionMood: 'umore',
    sectionTodo: 'to-do',
    sectionHabits: 'abitudini',
    sectionObservation: 'osservazione',
    sectionMyDiary: 'il mio diario',
    activityFallback: 'Oggi soprattutto lavoro',
    moodFallback: 'Umore positivo per gran parte della giornata',
    todoFallback: 'Hai fatto un ottimo lavoro oggi',
    habitsFallback: 'Continua cosi, ottimo passo',
    observationFallback: 'Anche oggi stai crescendo con calma.',
    diaryPlaceholder: 'Nessun contenuto del diario per ora.',
  },
};

export function buildPages(month: Date, reports: Report[]): PageData[] {
  const days = getDaysInMonth(month);
  const pages: PageData[] = [];
  pages.push({ type: 'cover' });
  for (let d = 1; d <= days; d++) {
    const date = new Date(month.getFullYear(), month.getMonth(), d);
    const report = reports.find(r => r.type === 'daily' && isSameDay(new Date(r.date), date));
    pages.push({ type: 'day-left', dayNum: d, date, report });
    pages.push({ type: 'day-right', dayNum: d, date, report });
  }
  if (pages.length % 2 === 0) pages.push({ type: 'blank' });
  pages.push({ type: 'back' });
  return pages;
}
