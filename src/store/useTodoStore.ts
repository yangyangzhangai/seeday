// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/growth/GrowthPage.tsx
// Unified Todo Store — merges old useTodoStore + useGrowthTodoStore
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../api/supabase';
import {
  normalizeTodoCategory,
} from '../lib/activityType';
import type { ActivityRecordType } from '../lib/activityType';
import { getSupabaseSession } from '../lib/supabase-utils';
import { fromDbTodo, toDbTodo, toDbTodoUpdates } from '../lib/dbMappers';
import { useGrowthStore } from './useGrowthStore';
import { useAuthStore } from './useAuthStore';
import { useOutboxStore } from './useOutboxStore';
import type { Recurrence, Todo, TodoPriority, TodoScope, TodoState } from './todoStoreTypes';
export type { GrowthPriority, GrowthTodo, Priority, Recurrence, Todo, TodoPriority, TodoScope } from './todoStoreTypes';
import { resolveCurrentLang, resolveLangForText } from './storeLangHelpers';
import {
  getLocalDayRange,
  getTodoFreshness,
  isTodoParentForeignKeyError,
  migrateOldTodoStorage,
  sanitizeSortOrder,
  todayDateStr,
  todayDayOfMonth,
  todayDayOfWeek,
} from './todoStoreHelpers';
import { PERSIST_KEYS, LEGACY_PERSIST_KEYS } from './persistKeys';
import { readLegacyPersistedState } from './persistMigrationHelpers';
import { createScopedJSONStorage } from './scopedPersistStorage';
import {
  bgSyncDelete,
  bgSyncInsert,
  bgSyncUpdate,
  collectTodoCascadeIds,
  ensureTodoDeleteQueued,
  isNonRecurring,
  mapCloudTodos,
  normalizeCloudTodoCategory,
  refineTodoCategoryWithAI,
  shouldRetainPendingDelete,
  stripDeletedTodoArtifacts,
} from './todoStoreSync';

// ── Unified Store ───────────────────────────────────────────
export const useTodoStore = create<TodoState>()(
  persist(
    (set, get) => {
      const updateTodos = (updater: (todos: Todo[]) => Todo[]) => {
        set((state) => ({ todos: updater(state.todos) }));
      };

      return ({
      todos: [],
      categories: ['study', 'work', 'social', 'life', 'entertainment', 'health'],
      isLoading: false,
      hasHydrated: false,
      lastFetchedAt: null,
      lastSyncError: null,
      activeTodoId: null,
      lastGeneratedDate: '',
      suppressedTemplateDateMap: {},
      pendingDeletedTodoIds: {},
      activeMessageMap: {},
      todoCompletionMessageMap: {},
      todoBottleStarRewardMap: {},
      messageBottleStarRewardMap: {},

      // ── Fetch from Supabase ──────────────────────────────────────────────
      // 策略：推 pending/failed → 收集仍然失败的 → 拉云端（软删除过滤）→ 合并失败的进去
      // syncState='synced' 但云端没有的条目 = 已在其他设备删除，本地也移除（防复活）
      fetchTodos: async () => {
        set({ isLoading: true, lastSyncError: null });
        try {
          const session = await getSupabaseSession();
          if (!session) {
            set({ isLoading: false, hasHydrated: true });
            return;
          }
          const now = Date.now();
          const queuedDeleteIds = new Set(
            useOutboxStore
              .getState()
              .entries
              .filter((entry) => entry.kind === 'todo.delete')
              .map((entry) => entry.payload.todoId)
          );
          const pendingDeleteEntries = Object.entries(get().pendingDeletedTodoIds)
            .filter(([todoId, at]) => shouldRetainPendingDelete(todoId, at, now, queuedDeleteIds));
          const pendingDeletedIds = new Set(pendingDeleteEntries.map(([id]) => id));
          if (pendingDeleteEntries.length !== Object.keys(get().pendingDeletedTodoIds).length) {
            set({ pendingDeletedTodoIds: Object.fromEntries(pendingDeleteEntries) });
          }
          await useOutboxStore.getState().flush(session.user.id);
          if (pendingDeletedIds.size > 0) {
            await Promise.all(Array.from(pendingDeletedIds).map((todoId) => bgSyncDelete(todoId)));
          }

          // ① 找出本地所有未同步的条目（pending / failed / 无 syncState 的旧数据）
          const localTodos = get().todos.filter((todo) => !pendingDeletedIds.has(todo.id));
          const needsPush = localTodos.filter(
            (t) => !t.syncState || t.syncState === 'pending' || t.syncState === 'failed'
          );
          const pushTodoById = new Map(needsPush.map((todo) => [todo.id, todo]));

          async function upsertTodo(todo: Todo): Promise<void> {
            const { error } = await supabase
              .from('todos')
              .upsert([toDbTodo(todo, session.user.id)], { onConflict: 'id' });
            if (error) throw error;
          }

          async function upsertTodoWithParentRecovery(todo: Todo): Promise<void> {
            try {
              await upsertTodo(todo);
              return;
            } catch (error) {
              if (!isTodoParentForeignKeyError(error)) throw error;
            }

            const parentId = todo.parentId;
            if (parentId) {
              const parentTodo = pushTodoById.get(parentId);
              if (parentTodo) {
                await upsertTodo(parentTodo);
                await upsertTodo(todo);
                return;
              }
            }

            const detachedTodo: Todo = { ...todo, parentId: undefined };
            await upsertTodo(detachedTodo);
          }

          // ② 尝试推送，收集仍然失败的
          const failedById = new Map<string, Todo>();
          const markFailed = (todo: Todo) => {
            failedById.set(todo.id, { ...todo, syncState: 'failed' as const });
          };

          const parentTodos = needsPush.filter((todo) => !todo.parentId);
          const childTodos = needsPush.filter((todo) => !!todo.parentId);

          await Promise.all(
            parentTodos.map(async (todo) => {
              try {
                await upsertTodo(todo);
              } catch {
                markFailed(todo);
              }
            })
          );

          await Promise.all(
            childTodos.map(async (todo) => {
              try {
                await upsertTodoWithParentRecovery(todo);
              } catch {
                markFailed(todo);
              }
            })
          );

          const stillFailed = Array.from(failedById.values());

          // ③ 拉云端（只拉未软删除的）
          const { data, error } = await supabase
            .from('todos')
            .select('*')
            .eq('user_id', session.user.id)
            .is('deleted_at', null);

          if (error) {
            if (import.meta.env.DEV) console.error('Error fetching todos:', error);
            set({ isLoading: false, hasHydrated: true, lastSyncError: error.message });
            return;
          }

          const cloudTodosRaw = mapCloudTodos(data); // syncState: 'synced'
          const cloudIdsRaw = new Set(cloudTodosRaw.map((t) => t.id));
          const cloudTodos = cloudTodosRaw.filter((todo) => !pendingDeletedIds.has(todo.id));

          // 顺手修正 category（历史数据标准化）
          data.forEach((row) => {
            normalizeCloudTodoCategory(row);
          });

          // ④ 合并：云端数据 + 仍然失败的本地条目（云端没有的才保留）
          const cloudIds = new Set(cloudTodos.map((t) => t.id));
          const survivingFailed = stillFailed
            .filter((t) => !cloudIds.has(t.id) && !pendingDeletedIds.has(t.id))
            .map((t) => ({ ...t, syncState: 'failed' as const }));

          // ⑤ 一次性迁移旧 todo-storage（历史兼容）
          const migrated = migrateOldTodoStorage(cloudIdsRaw, {
            normalizeTodoCategory,
            resolveLangForText,
          }) as Todo[];
          migrated.forEach((t) => bgSyncInsert(t, updateTodos).catch((error) => import.meta.env.DEV && console.error('[todo] migrate bgSyncInsert failed', error)));

          const nextPendingDeleted = Object.fromEntries(
            pendingDeleteEntries.filter(([id]) => cloudIdsRaw.has(id))
          );

          const mergedTodos = [...cloudTodos, ...survivingFailed, ...migrated];
          const mergedTodoIds = new Set(mergedTodos.map((todo) => todo.id));
          const orphanRootIds = mergedTodos
            .filter((todo) => todo.parentId && !mergedTodoIds.has(todo.parentId))
            .map((todo) => todo.id);
          const orphanCascadeIds = collectTodoCascadeIds(mergedTodos, orphanRootIds);
          const orphanDeletedAt = Date.now();
          const orphanDeletedIdSet = new Set(orphanCascadeIds);

          if (orphanCascadeIds.length > 0) {
            orphanCascadeIds.forEach((todoId) => {
              void bgSyncDelete(todoId).then((ok) => {
                if (ok) return;
                ensureTodoDeleteQueued(todoId);
              });
            });
          }

          const nextPendingDeletedWithOrphans = {
            ...nextPendingDeleted,
            ...Object.fromEntries(orphanCascadeIds.map((todoId) => [todoId, orphanDeletedAt])),
          };
          const sanitizedMergedTodos = orphanDeletedIdSet.size > 0
            ? mergedTodos.filter((todo) => !orphanDeletedIdSet.has(todo.id))
            : mergedTodos;

          set((state) => {
            const latestPendingDeleted = Object.fromEntries(
              Object.entries(state.pendingDeletedTodoIds).filter(([todoId, at]) => shouldRetainPendingDelete(todoId, at, now, queuedDeleteIds))
            );
            const mergedPendingDeleted = {
              ...nextPendingDeletedWithOrphans,
              ...latestPendingDeleted,
            };
            const mergedPendingDeletedIds = new Set(Object.keys(mergedPendingDeleted));
            return {
              ...stripDeletedTodoArtifacts({
                ...state,
                todos: sanitizedMergedTodos.filter((todo) => !mergedPendingDeletedIds.has(todo.id)),
              }, mergedPendingDeletedIds),
              pendingDeletedTodoIds: mergedPendingDeleted,
              isLoading: false,
              hasHydrated: true,
              lastFetchedAt: Date.now(),
              lastSyncError: stillFailed.length > 0
                ? `${stillFailed.length} 条待办同步失败，将在下次重试`
                : null,
            };
          });
        } catch (err) {
          set({
            isLoading: false,
            hasHydrated: true,
            lastSyncError: err instanceof Error ? err.message : 'todo_sync_failed',
          });
        }
      },

      // ── Add todo (unified: supports growth + legacy fields) ──
      addTodo: (input) => {
        const { todos } = get();
        const minOrder = todos
          .filter((t) => !t.isTemplate)
          .reduce((min, t) => Math.min(min, sanitizeSortOrder(t.sortOrder, Date.now())), Infinity);
        const defaultSortOrder = minOrder === Infinity
          ? 0
          : sanitizeSortOrder(minOrder - 1, Date.now());
        const recurrence = input.recurrence ?? 'once';
        const isRecurring = !isNonRecurring(recurrence);
        const lang = resolveLangForText(input.title);
        const normalizedCategory = normalizeTodoCategory(input.category, input.title, lang);
        const shouldRefineByAI = useAuthStore.getState().isPlus;

        if (isRecurring) {
          const templateId = uuidv4();
          const template: Todo = {
            id: templateId,
            title: input.title,
            priority: input.priority,
            bottleId: input.bottleId,
            completed: false,
            createdAt: Date.now(),
            dueAt: input.dueAt,
            recurrence,
            recurrenceDays: input.recurrenceDays,
            isTemplate: true,
            sortOrder: defaultSortOrder,
            category: normalizedCategory,
            scope: input.scope,
            syncState: 'pending',
          };

          const shouldGenerate =
            recurrence === 'daily' ||
            (recurrence === 'monthly' && todayDayOfMonth() === 1) ||
            (recurrence === 'weekly' && (input.recurrenceDays ?? []).includes(todayDayOfWeek()));

          const newTodos: Todo[] = [template];
          if (shouldGenerate) {
            const instance: Todo = {
              id: uuidv4(),
              title: input.title,
              priority: input.priority,
              bottleId: input.bottleId,
              completed: false,
              createdAt: Date.now(),
              recurrence: 'once',
              isTemplate: false,
              templateId,
              sortOrder: defaultSortOrder,
              category: normalizedCategory,
              scope: input.scope,
              syncState: 'pending',
            };
            newTodos.push(instance);
            bgSyncInsert(instance, updateTodos).catch((error) => import.meta.env.DEV && console.error('[todo] recurrence bgSyncInsert failed', error));
            if (shouldRefineByAI) {
              void refineTodoCategoryWithAI(instance.id, instance.title, updateTodos);
            }
          }
          set((s) => ({ todos: [...s.todos, ...newTodos] }));
          bgSyncInsert(template, updateTodos).catch((error) => import.meta.env.DEV && console.error('[todo] add template bgSyncInsert failed', error));
          if (shouldRefineByAI) {
            void refineTodoCategoryWithAI(template.id, template.title, updateTodos);
          }
        } else {
          const todo: Todo = {
            id: uuidv4(),
            title: input.title,
            priority: input.priority,
            bottleId: input.bottleId,
            completed: false,
            createdAt: Date.now(),
            dueAt: input.dueAt,
            recurrence: 'once',
            isTemplate: false,
            sortOrder: defaultSortOrder,
            category: normalizedCategory,
            scope: input.scope,
            syncState: 'pending',
          };
          set((s) => ({ todos: [...s.todos, todo] }));
          bgSyncInsert(todo, updateTodos).catch((error) => import.meta.env.DEV && console.error('[todo] add todo bgSyncInsert failed', error));
          if (shouldRefineByAI) {
            void refineTodoCategoryWithAI(todo.id, todo.title, updateTodos);
          }
        }
      },

      // ── Update todo (optimistic + Supabase sync) ──
      updateTodo: async (id, updates) => {
        set((state) => ({
          todos: state.todos.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        }));
        await bgSyncUpdate(id, updates);
      },

      // ── Toggle completion ──
      toggleTodo: (id) => {
        const todo = get().todos.find((t) => t.id === id);
        if (!todo) return;
        const completed = !todo.completed;
        const completedAt = completed ? Date.now() : undefined;
        set((state) => {
          const nextTodos = state.todos.map((t) =>
            t.id === id ? { ...t, completed, completedAt } : t
          );
          // Auto-complete parent when all its sub-todos are completed
          if (completed && todo.parentId) {
            const siblings = nextTodos.filter((t) => t.parentId === todo.parentId);
            const allDone = siblings.every((t) => t.completed);
            if (allDone) {
              const now = Date.now();
              bgSyncUpdate(todo.parentId, { completed: true, completedAt: now }).catch((error) => import.meta.env.DEV && console.error('[todo] complete parent bgSyncUpdate failed', error));
              return {
                todos: nextTodos.map((t) =>
                  t.id === todo.parentId ? { ...t, completed: true, completedAt: now } : t
                ),
              };
            }
          }
          return { todos: nextTodos };
        });
        bgSyncUpdate(id, { completed, completedAt }).catch((error) => import.meta.env.DEV && console.error('[todo] toggle complete bgSyncUpdate failed', error));
      },

      // ── Toggle pin ──
      togglePin: (id) => {
        const todo = get().todos.find((t) => t.id === id);
        if (!todo) return;
        const isPinned = !todo.isPinned;
        set((state) => ({
          todos: state.todos.map((t) => (t.id === id ? { ...t, isPinned } : t)),
        }));
        bgSyncUpdate(id, { isPinned }).catch((error) => import.meta.env.DEV && console.error('[todo] pin bgSyncUpdate failed', error));
      },

      // ── Delete todo (template cascade + annotation + Supabase) ──
      deleteTodo: (id) => {
        const todo = get().todos.find((t) => t.id === id);
        if (!todo) return;
        const allTodos = get().todos;
        const markPendingDeletion = (ids: string[]) => {
          const deletedAt = Date.now();
          set((state) => ({
            pendingDeletedTodoIds: {
              ...state.pendingDeletedTodoIds,
              ...Object.fromEntries(ids.map((todoId) => [todoId, deletedAt])),
            },
          }));
        };
        const clearPendingDeletion = (todoId: string) => {
          set((state) => {
            if (!(todoId in state.pendingDeletedTodoIds)) return state;
            const nextPending = { ...state.pendingDeletedTodoIds };
            delete nextPending[todoId];
            return { pendingDeletedTodoIds: nextPending };
          });
        };
        if (todo.isTemplate) {
          const instanceIds = allTodos.filter((t) => t.templateId === id && !t.completed)
            .map((t) => t.id);
          const idsToDelete = collectTodoCascadeIds(allTodos, [id, ...instanceIds]);
          const deletedIdSet = new Set(idsToDelete);
          markPendingDeletion(idsToDelete);
          idsToDelete.forEach((todoId) => {
            const reward = get().consumeBottleStarRewardByTodo(todoId);
            if (reward) {
              useGrowthStore.getState().decrementBottleStars(reward.bottleId, reward.stars);
            }
          });
          set((s) => ({
            ...stripDeletedTodoArtifacts(s, deletedIdSet),
            suppressedTemplateDateMap: Object.fromEntries(
              Object.entries(s.suppressedTemplateDateMap).filter(([templateId]) => templateId !== id)
            ),
          }));
          idsToDelete.forEach((todoId) => {
            void bgSyncDelete(todoId).then((ok) => {
              if (ok) {
                clearPendingDeletion(todoId);
                return;
              }
              ensureTodoDeleteQueued(todoId);
            });
          });
        } else {
          const reward = get().consumeBottleStarRewardByTodo(id);
          if (reward) {
            useGrowthStore.getState().decrementBottleStars(reward.bottleId, reward.stars);
          }
          const idsToDelete = collectTodoCascadeIds(allTodos, [id]);
          const deletedIdSet = new Set(idsToDelete);
          markPendingDeletion(idsToDelete);
          set((s) => ({
            ...stripDeletedTodoArtifacts(s, deletedIdSet),
            suppressedTemplateDateMap: todo.templateId
              ? { ...s.suppressedTemplateDateMap, [todo.templateId]: todayDateStr() }
              : s.suppressedTemplateDateMap,
          }));
          idsToDelete.forEach((todoId) => {
            void bgSyncDelete(todoId).then((ok) => {
              if (ok) {
                clearPendingDeletion(todoId);
                return;
              }
              ensureTodoDeleteQueued(todoId);
            });
          });
        }

      },

      addCategory: (category) =>
        set((state) => (
          state.categories.includes(category)
            ? { categories: state.categories }
            : { categories: [...state.categories, category] }
        )),

      // ── Start working on a todo ──
      startTodo: (id) => {
        const now = Date.now();
        set((s) => ({
          todos: s.todos.map((t) =>
            t.id === id ? { ...t, startedAt: now } : t
          ),
          activeTodoId: id,
        }));
        bgSyncUpdate(id, { startedAt: now, completed: false, completedAt: undefined }).catch((error) => import.meta.env.DEV && console.error('[todo] start focus bgSyncUpdate failed', error));
      },

      // ── Complete the currently active todo (for ChatPage) ──
      completeActiveTodo: async () => {
        const { activeTodoId, todos } = get();
        if (!activeTodoId) return;

        const todo = todos.find((t) => t.id === activeTodoId);
        if (!todo || !todo.startedAt) return;

        const now = Date.now();
        const duration = Math.round((now - todo.startedAt) / (1000 * 60));

        set((state) => ({
          todos: state.todos.map((t) =>
            t.id === activeTodoId
              ? { ...t, completed: true, completedAt: now, duration }
              : t
          ),
          activeTodoId: null,
        }));

        await bgSyncUpdate(activeTodoId, {
          completed: true,
          completedAt: now,
          duration,
        });
      },

      // ── Complete with explicit duration ──
      completeTodoWithDuration: async (id, duration) => {
        const now = Date.now();
        set((state) => ({
          todos: state.todos.map((t) =>
            t.id === id ? { ...t, completed: true, completedAt: now, duration } : t
          ),
        }));
        await bgSyncUpdate(id, { completed: true, completedAt: now, duration });
      },

      setActiveTodoId: (id) => set({ activeTodoId: id }),

      // ── Add AI-decomposed sub-todos under a parent ──
      addSubTodos: (parentId, steps, options) => {
        const parent = get().todos.find((t) => t.id === parentId);
        if (!parent) return;
        const now = Date.now();
        const shouldReplace = options?.replaceExisting === true;
        const existingSubTodos = shouldReplace
          ? get().todos.filter((t) => t.parentId === parentId)
          : [];
        const subTodos: Todo[] = steps.map((step, i) => ({
          id: uuidv4(),
          title: step.title,
          completed: false,
          createdAt: now + i,
          priority: parent.priority,
          bottleId: parent.bottleId,
          recurrence: 'once' as Recurrence,
          isTemplate: false,
          sortOrder: now + i,
          parentId,
          suggestedDuration: step.suggestedDuration,
          category: parent.category,
          syncState: 'pending' as const,
        }));
        set((s) => ({
          todos: [
            ...s.todos.filter((t) => !(shouldReplace && t.parentId === parentId)),
            ...subTodos,
          ],
        }));
        existingSubTodos.forEach((t) => bgSyncDelete(t.id).catch((error) => import.meta.env.DEV && console.error('[todo] sync subtodo bgSyncDelete failed', error)));
        subTodos.forEach((t) => bgSyncInsert(t, updateTodos).catch((error) => import.meta.env.DEV && console.error('[todo] sync subtodo bgSyncInsert failed', error)));
      },

      // ── Reorder todos ──
      reorderTodos: (id, direction) => {
        const { todos } = get();
        const visible = todos
          .filter((t) => !t.isTemplate)
          .sort((a, b) => a.sortOrder - b.sortOrder);

        const idx = visible.findIndex((t) => t.id === id);
        if (idx < 0) return;

        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= visible.length) return;

        const thisOrder = visible[idx].sortOrder;
        const thatOrder = visible[swapIdx].sortOrder;
        const currentTodoId = visible[idx].id;
        const swapTodoId = visible[swapIdx].id;

        set((s) => ({
          todos: s.todos.map((t) => {
            if (t.id === currentTodoId) return { ...t, sortOrder: thatOrder };
            if (t.id === swapTodoId) return { ...t, sortOrder: thisOrder };
            return t;
          }),
        }));

        void Promise.all([
          bgSyncUpdate(currentTodoId, { sortOrder: thatOrder }),
          bgSyncUpdate(swapTodoId, { sortOrder: thisOrder }),
        ]).catch((error) => import.meta.env.DEV && console.error('[todo] deleteTodo sync failed', error));
      },

      reorderTodosByIds: (orderedIds) => {
        if (orderedIds.length <= 1) return;
        const orderMap = new Map(orderedIds.map((todoId, index) => [todoId, index]));
        const changed: Array<{ id: string; sortOrder: number }> = [];

        set((state) => ({
          todos: state.todos.map((todo) => {
            const nextOrder = orderMap.get(todo.id);
            if (nextOrder === undefined || todo.sortOrder === nextOrder) return todo;
            changed.push({ id: todo.id, sortOrder: nextOrder });
            return { ...todo, sortOrder: nextOrder };
          }),
        }));

        if (changed.length === 0) return;
        void Promise.all(changed.map((item) => bgSyncUpdate(item.id, { sortOrder: item.sortOrder }))).catch((error) => import.meta.env.DEV && console.error('[todo] reorder bgSyncUpdate failed', error));
      },

      // ── Generate recurring todos for today ──
      generateRecurringTodos: () => {
        const { todos, lastGeneratedDate, suppressedTemplateDateMap } = get();
        const today = todayDateStr();
        const templates = todos.filter((t) => t.isTemplate);
        const templateIdSet = new Set(templates.map((tpl) => tpl.id));
        const nextSuppressedTemplateDateMap = Object.fromEntries(
          Object.entries(suppressedTemplateDateMap).filter(
            ([templateId, dateKey]) => dateKey === today && templateIdSet.has(templateId)
          )
        );
        if (lastGeneratedDate === today) {
          if (Object.keys(nextSuppressedTemplateDateMap).length !== Object.keys(suppressedTemplateDateMap).length) {
            set({ suppressedTemplateDateMap: nextSuppressedTemplateDateMap });
          }
          return;
        }

        const dayOfWeek = todayDayOfWeek();
        const dayOfMonth = todayDayOfMonth();
        const { start: todayStart, end: todayEnd } = getLocalDayRange(today);
        const newInstances: Todo[] = [];

        for (const tpl of templates) {
          if (tpl.recurrence === 'daily') {
            // always generate
          } else if (tpl.recurrence === 'weekly') {
            if (!(tpl.recurrenceDays ?? []).includes(dayOfWeek)) continue;
          } else if (tpl.recurrence === 'monthly') {
            if (dayOfMonth !== 1) continue;
          } else {
            continue;
          }

          if (nextSuppressedTemplateDateMap[tpl.id] === today) continue;

          const hasUnfinishedInstance = todos.some(
            (t) => t.templateId === tpl.id && !t.completed
          );
          if (hasUnfinishedInstance) continue;

          const exists = todos.some(
            (t) =>
              t.templateId === tpl.id &&
              t.createdAt >= todayStart &&
              t.createdAt < todayEnd
          );
          if (exists) continue;

          const instance: Todo = {
            id: uuidv4(),
            title: tpl.title,
            priority: tpl.priority,
            bottleId: tpl.bottleId,
            completed: false,
            createdAt: Date.now(),
            recurrence: 'once',
            isTemplate: false,
            templateId: tpl.id,
            sortOrder: tpl.sortOrder,
            category: tpl.category,
            scope: tpl.scope,
          };
          newInstances.push(instance);
          bgSyncInsert(instance, updateTodos).catch((error) => import.meta.env.DEV && console.error('[todo] rollover bgSyncInsert failed', error));
        }

        set((s) => ({
          todos: [...s.todos, ...newInstances],
          lastGeneratedDate: today,
          suppressedTemplateDateMap: nextSuppressedTemplateDateMap,
        }));
      },

      // ── Link a chat message to a todo ──
      linkMessageToTodo: (messageId, todoId) => {
        set((s) => ({
          activeMessageMap: { ...s.activeMessageMap, [messageId]: todoId },
        }));
      },

      // ── Complete a todo when its linked message ends ──
      completeTodoByMessage: (messageId) => {
        const { activeMessageMap, todos } = get();
        const todoId = activeMessageMap[messageId];
        if (!todoId) return null;
        const todo = todos.find((t) => t.id === todoId);
        if (todo && !todo.completed) {
          const now = Date.now();
          const completedAt = now;
          const duration = todo.startedAt
            ? Math.round((now - todo.startedAt) / 60000)
            : undefined;
          const completedTodo: Todo = {
            ...todo,
            completed: true,
            completedAt,
            duration,
          };
          set((s) => ({
            todos: s.todos.map((t) =>
              t.id === todoId ? completedTodo : t
            ),
            activeMessageMap: Object.fromEntries(
              Object.entries(s.activeMessageMap).filter(([k]) => k !== messageId)
            ),
          }));
          bgSyncUpdate(todoId, { completed: true, completedAt, duration }).catch((error) => import.meta.env.DEV && console.error('[todo] completeFocusTodo bgSyncUpdate failed', error));
          return completedTodo;
        }
        return null;
      },

      setTodoCompletionMessage: (todoId, messageId) => {
        set((s) => ({
          todoCompletionMessageMap: {
            ...s.todoCompletionMessageMap,
            [todoId]: messageId,
          },
          messageBottleStarRewardMap: s.todoBottleStarRewardMap[todoId]
            ? {
              ...s.messageBottleStarRewardMap,
              [messageId]: {
                bottleId: s.todoBottleStarRewardMap[todoId].bottleId,
                stars: s.todoBottleStarRewardMap[todoId].stars,
                todoId,
              },
            }
            : s.messageBottleStarRewardMap,
        }));
      },

      getTodoCompletionMessage: (todoId) => get().todoCompletionMessageMap[todoId],
      clearTodoCompletionMessage: (todoId) => {
        set((s) => ({
          todoCompletionMessageMap: Object.fromEntries(
            Object.entries(s.todoCompletionMessageMap).filter(([key]) => key !== todoId)
          ),
        }));
      },

      registerBottleStarReward: ({ todoId, messageId, bottleId, stars }) => {
        const safeStars = Math.max(1, Math.floor(stars || 1));
        set((s) => {
          const nextTodoRewards = todoId
            ? {
              ...s.todoBottleStarRewardMap,
              [todoId]: { bottleId, stars: safeStars },
            }
            : s.todoBottleStarRewardMap;
          const linkedMessageId = messageId || (todoId ? s.todoCompletionMessageMap[todoId] : undefined);
          const nextMessageRewards = linkedMessageId
            ? {
              ...s.messageBottleStarRewardMap,
              [linkedMessageId]: { bottleId, stars: safeStars, ...(todoId ? { todoId } : {}) },
            }
            : s.messageBottleStarRewardMap;
          return {
            todoBottleStarRewardMap: nextTodoRewards,
            messageBottleStarRewardMap: nextMessageRewards,
          };
        });
      },

      consumeBottleStarRewardByTodo: (todoId) => {
        const state = get();
        const reward = state.todoBottleStarRewardMap[todoId];
        if (!reward) return null;
        const linkedMessageId = state.todoCompletionMessageMap[todoId];
        set((s) => ({
          todoBottleStarRewardMap: Object.fromEntries(
            Object.entries(s.todoBottleStarRewardMap).filter(([key]) => key !== todoId)
          ),
          messageBottleStarRewardMap: linkedMessageId
            ? Object.fromEntries(
              Object.entries(s.messageBottleStarRewardMap).filter(([key]) => key !== linkedMessageId)
            )
            : s.messageBottleStarRewardMap,
        }));
        return reward;
      },

      consumeBottleStarRewardByMessage: (messageId) => {
        const state = get();
        const reward = state.messageBottleStarRewardMap[messageId];
        if (!reward) return null;
        set((s) => ({
          messageBottleStarRewardMap: Object.fromEntries(
            Object.entries(s.messageBottleStarRewardMap).filter(([key]) => key !== messageId)
          ),
          todoBottleStarRewardMap: reward.todoId
            ? Object.fromEntries(
              Object.entries(s.todoBottleStarRewardMap).filter(([key]) => key !== reward.todoId)
            )
            : s.todoBottleStarRewardMap,
        }));
        return { bottleId: reward.bottleId, stars: reward.stars };
      },
      });
    },
    {
      name: PERSIST_KEYS.todo,
      storage: createScopedJSONStorage<Partial<TodoState>>('todo'),
      skipHydration: true,
      partialize: (state) => ({
        todos: state.todos,
        categories: state.categories,
        activeTodoId: state.activeTodoId,
        lastFetchedAt: state.lastFetchedAt,
        lastGeneratedDate: state.lastGeneratedDate,
        suppressedTemplateDateMap: state.suppressedTemplateDateMap,
        pendingDeletedTodoIds: state.pendingDeletedTodoIds,
        activeMessageMap: state.activeMessageMap,
        todoCompletionMessageMap: state.todoCompletionMessageMap,
        todoBottleStarRewardMap: state.todoBottleStarRewardMap,
        messageBottleStarRewardMap: state.messageBottleStarRewardMap,
      }),
      merge: (persistedState, currentState) => {
        const legacyState = readLegacyPersistedState<TodoState>(LEGACY_PERSIST_KEYS.todo) || {};
        return {
          ...(currentState as TodoState),
          ...legacyState,
          ...((persistedState as Partial<TodoState>) || {}),
          lastFetchedAt: (persistedState as Partial<TodoState>)?.lastFetchedAt
            ?? legacyState.lastFetchedAt
            ?? (currentState as TodoState).lastFetchedAt,
        };
      },
    }
  )
);
