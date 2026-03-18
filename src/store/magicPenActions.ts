// DOC-DEPS: LLM.md -> docs/MAGIC_PEN_CAPTURE_SPEC.md -> src/features/chat/README.md -> src/features/growth/GrowthPage.tsx
import { validateDrafts } from '../services/input/magicPenDraftBuilder';
import type { MagicPenDraftItem } from '../services/input/magicPenTypes';
import { useChatStore } from './useChatStore';
import { useTodoStore } from './useTodoStore';

export interface MagicPenCommitResult {
  successActivityCount: number;
  successTodoCount: number;
  failedDraftIds: string[];
}

function sortActivityDrafts(drafts: MagicPenDraftItem[]): MagicPenDraftItem[] {
  return [...drafts].sort((a, b) => (a.activity?.startAt ?? 0) - (b.activity?.startAt ?? 0));
}

export async function commitMagicPenDrafts(drafts: MagicPenDraftItem[]): Promise<MagicPenCommitResult> {
  const chatStore = useChatStore.getState();
  const validatedDrafts = validateDrafts(drafts, chatStore.messages);
  const hasErrors = validatedDrafts.some((draft) => draft.errors.length > 0 || !draft.content.trim());
  if (hasErrors) {
    return {
      successActivityCount: 0,
      successTodoCount: 0,
      failedDraftIds: validatedDrafts.map((draft) => draft.id),
    };
  }

  const activityDrafts = sortActivityDrafts(validatedDrafts.filter((draft) => draft.kind === 'activity_backfill'));
  const todoDrafts = validatedDrafts.filter((draft) => draft.kind === 'todo_add');
  const failedDraftIds: string[] = [];
  let successActivityCount = 0;
  let successTodoCount = 0;

  for (const draft of activityDrafts) {
    try {
      await useChatStore.getState().insertActivity(
        null,
        null,
        draft.content,
        draft.activity!.startAt!,
        draft.activity!.endAt!,
      );
      successActivityCount += 1;
    } catch {
      failedDraftIds.push(draft.id);
    }
  }

  for (const draft of todoDrafts) {
    try {
      useTodoStore.getState().addTodo({
        title: draft.content,
        priority: draft.todo!.priority,
        category: draft.todo!.category,
        scope: draft.todo!.scope,
        dueAt: draft.todo!.dueDate,
        recurrence: 'none',
      });
      successTodoCount += 1;
    } catch {
      failedDraftIds.push(draft.id);
    }
  }

  return { successActivityCount, successTodoCount, failedDraftIds };
}
