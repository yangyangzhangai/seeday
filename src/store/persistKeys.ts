// DOC-DEPS: LLM.md -> docs/DATA_STORAGE_AUDIT_REPORT.md -> src/store/README.md
const PERSIST_V1_PREFIX = 'seeday:v1';

const DOMAIN_KEY_SUFFIX = {
  chat: 'chat',
  todo: 'todo',
  growth: 'growth',
  mood: 'mood',
  report: 'report',
  annotation: 'annotation',
  focus: 'focus',
  plant: 'plant',
  timing: 'timing',
  stardust: 'stardust',
  reminder: 'reminder',
  outbox: 'outbox',
} as const;

export type PersistDomain = keyof typeof DOMAIN_KEY_SUFFIX;
export const PERSIST_DOMAINS = Object.keys(DOMAIN_KEY_SUFFIX) as PersistDomain[];

export function getV1PersistKey(domain: PersistDomain): string {
  return `${PERSIST_V1_PREFIX}:${DOMAIN_KEY_SUFFIX[domain]}`;
}

export const PERSIST_KEYS = {
  chat: getV1PersistKey('chat'),
  todo: getV1PersistKey('todo'),
  growth: getV1PersistKey('growth'),
  mood: getV1PersistKey('mood'),
  report: getV1PersistKey('report'),
  annotation: getV1PersistKey('annotation'),
  focus: getV1PersistKey('focus'),
  plant: getV1PersistKey('plant'),
  timing: getV1PersistKey('timing'),
  stardust: getV1PersistKey('stardust'),
  reminder: getV1PersistKey('reminder'),
  outbox: getV1PersistKey('outbox'),
} as const;

export const LEGACY_PERSIST_KEYS = {
  chat: ['chat-storage'],
  todo: ['growth-todo-store'],
  growth: ['growth-store'],
  mood: ['activity-mood-storage'],
  report: ['report-storage'],
  annotation: ['annotation-storage'],
  focus: ['focus-store'],
  plant: ['plant-storage'],
  timing: ['timing-store'],
  stardust: ['stardust-storage'],
  reminder: ['reminder_confirmed_today', 'reminder_confirmed_date'],
  outbox: [],
} as const;

export const DOMAIN_PERSIST_KEY_GROUPS = {
  chat: [PERSIST_KEYS.chat, ...LEGACY_PERSIST_KEYS.chat],
  todo: [PERSIST_KEYS.todo, ...LEGACY_PERSIST_KEYS.todo],
  growth: [PERSIST_KEYS.growth, ...LEGACY_PERSIST_KEYS.growth],
  mood: [PERSIST_KEYS.mood, ...LEGACY_PERSIST_KEYS.mood],
  report: [PERSIST_KEYS.report, ...LEGACY_PERSIST_KEYS.report],
  annotation: [PERSIST_KEYS.annotation, ...LEGACY_PERSIST_KEYS.annotation],
  focus: [PERSIST_KEYS.focus, ...LEGACY_PERSIST_KEYS.focus],
  plant: [PERSIST_KEYS.plant, ...LEGACY_PERSIST_KEYS.plant],
  timing: [PERSIST_KEYS.timing, ...LEGACY_PERSIST_KEYS.timing],
  stardust: [PERSIST_KEYS.stardust, ...LEGACY_PERSIST_KEYS.stardust],
  reminder: [PERSIST_KEYS.reminder, ...LEGACY_PERSIST_KEYS.reminder],
  outbox: [PERSIST_KEYS.outbox, ...LEGACY_PERSIST_KEYS.outbox],
} as const;

export const ALL_DOMAIN_PERSIST_KEYS = Object.values(DOMAIN_PERSIST_KEY_GROUPS).flat();
