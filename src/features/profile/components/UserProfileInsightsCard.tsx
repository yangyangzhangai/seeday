// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/lib/buildUserProfileSnapshot.ts
import React from 'react';
import { useTranslation } from 'react-i18next';
import { BookHeart, CalendarClock, UtensilsCrossed } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import { buildUserProfileSnapshot } from '../../../lib/buildUserProfileSnapshot';

interface Props {
  plain?: boolean;
}

function toMealLabel(meals: number[]): string {
  if (!meals.length) return '';
  return meals.map((hour) => `${String(hour).padStart(2, '0')}:00`).join(' | ');
}

export const UserProfileInsightsCard: React.FC<Props> = ({ plain = false }) => {
  const { t } = useTranslation();
  const { longTermProfileEnabled, userProfileV2 } = useAuthStore();
  const snapshot = React.useMemo(
    () => buildUserProfileSnapshot({ profile: userProfileV2 || undefined, now: new Date() }),
    [userProfileV2],
  );

  const mealText = toMealLabel(snapshot.mealTimesForSuggestion || []);
  const anniversaries = (snapshot.visibleUpcomingAnniversaries || []).slice(0, 2);
  const latestRecall = snapshot.hiddenRecallMoments?.[0];

  return (
    <div className={plain ? 'overflow-hidden' : 'overflow-hidden rounded-[1.5rem] border border-white/65 bg-[#F7F9F8] [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.75),0_8px_24px_rgba(148,163,184,0.12)]'}>
      <div className="px-4 py-3">
        <div className="flex items-start gap-2.5">
          <BookHeart size={16} className="mt-0.5 text-[#5F7A63]" />
          <div>
            <p className="text-xs text-slate-700">{t('profile_snapshot_title')}</p>
            <p className="mt-0.5 text-[10px] leading-tight text-slate-500">
              {longTermProfileEnabled ? t('profile_snapshot_desc_enabled') : t('profile_snapshot_desc_disabled')}
            </p>
          </div>
        </div>

        <div className="mt-3 space-y-2.5 border-t border-slate-200/60 pt-2.5">
          <div className="flex items-start gap-2">
            <UtensilsCrossed size={13} className="mt-0.5 text-slate-500" />
            <div>
              <p className="text-[11px] text-slate-600">{t('profile_snapshot_meal_title')}</p>
              <p className="text-[11px] text-slate-500">{mealText || t('profile_snapshot_empty')}</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <CalendarClock size={13} className="mt-0.5 text-slate-500" />
            <div>
              <p className="text-[11px] text-slate-600">{t('profile_snapshot_anniversary_title')}</p>
              <p className="text-[11px] text-slate-500">
                {anniversaries.length > 0
                  ? anniversaries.map((item) => `${item.label} (${item.daysUntil}d)`).join(' | ')
                  : t('profile_snapshot_empty')}
              </p>
            </div>
          </div>

          <div>
            <p className="text-[11px] text-slate-600">{t('profile_snapshot_recall_title')}</p>
            <p className="text-[11px] text-slate-500">
              {latestRecall ? `${latestRecall.title} (${latestRecall.date})` : t('profile_snapshot_empty')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
