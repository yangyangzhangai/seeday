// DOC-DEPS: LLM.md -> docs/DATA_STORAGE_AUDIT_REPORT.md -> src/store/README.md
export const PERSIST_KEYS = {
  chat: 'seeday:v1:chat',
  todo: 'seeday:v1:todo',
  growth: 'seeday:v1:growth',
  mood: 'seeday:v1:mood',
  report: 'seeday:v1:report',
  annotation: 'seeday:v1:annotation',
  focus: 'seeday:v1:focus',
  plant: 'seeday:v1:plant',
  timing: 'seeday:v1:timing',
  stardust: 'seeday:v1:stardust',
  reminder: 'seeday:v1:reminder',
  outbox: 'seeday:v1:outbox',
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
