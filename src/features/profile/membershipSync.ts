import { supabase } from '../../api/supabase';
import { resolveMembershipState, type MembershipPlan } from '../../store/useAuthStore';
import { useAuthStore } from '../../store/useAuthStore';

const PLUS_MEMBERSHIP_KEYS = {
  membership_plan: 'plus',
  plan: 'plus',
  subscription_plan: 'plus',
  is_plus: true,
  plus_member: true,
  vip: true,
};

function applyMembershipState(plan: MembershipPlan, source: ReturnType<typeof resolveMembershipState>['source']): void {
  const isPlus = plan === 'plus';
  const currentState = useAuthStore.getState();
  const currentUser = currentState.user;

  const nextUser = currentUser
    ? {
      ...currentUser,
      user_metadata: {
        ...(currentUser.user_metadata || {}),
        ...(isPlus ? PLUS_MEMBERSHIP_KEYS : { membership_plan: 'free', plan: 'free', subscription_plan: 'free', is_plus: false, plus_member: false, vip: false }),
        membership_updated_at: new Date().toISOString(),
      },
    }
    : currentUser;

  useAuthStore.setState({
    user: nextUser,
    membershipPlan: plan,
    membershipSource: source,
    isPlus,
  });

  // Recalculate feature gates (e.g. AI annotation quota) against latest membership.
  void useAuthStore.getState().updatePreferences({});
}

export function applyMembershipOptimistic(plan?: MembershipPlan): void {
  applyMembershipState(plan === 'free' ? 'free' : 'plus', 'metadata');
}

export async function refreshMembershipFromServer(): Promise<void> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      return;
    }

    const membership = resolveMembershipState(data.user);
    applyMembershipState(membership.plan, membership.source);
  } catch {
    // Keep optimistic state; next auth/session refresh will reconcile.
  }
}

export function syncMembershipAfterPayment(plan?: MembershipPlan): void {
  applyMembershipOptimistic(plan);
  void refreshMembershipFromServer();
}
