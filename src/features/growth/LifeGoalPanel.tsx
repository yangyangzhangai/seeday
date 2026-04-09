// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/用户画像模块_需求与技术文档_v1.md
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Compass } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

export const LifeGoalPanel: React.FC = () => {
  const { t } = useTranslation();
  const lifeGoal = useAuthStore((s) => s.userProfileV2?.manual?.lifeGoal || '');
  const updateUserProfile = useAuthStore((s) => s.updateUserProfile);
  const [draft, setDraft] = React.useState(lifeGoal);
  const [saving, setSaving] = React.useState(false);
  const [statusText, setStatusText] = React.useState('');

  React.useEffect(() => {
    setDraft(lifeGoal);
  }, [lifeGoal]);

  const hasUnsavedChanges = draft.trim() !== lifeGoal.trim();

  const handleSave = async () => {
    if (!hasUnsavedChanges) {
      setStatusText(t('growth_life_goal_no_changes'));
      return;
    }
    setStatusText('');
    setSaving(true);
    const { error } = await updateUserProfile({
      manual: {
        lifeGoal: draft.trim() || undefined,
      },
    });
    setSaving(false);
    setStatusText(error ? t('growth_life_goal_save_failed') : t('growth_life_goal_saved'));
  };

  return (
    <section className="mx-4 mb-2 overflow-hidden rounded-2xl border border-white/70 bg-[#F8F9F6] px-3.5 py-3 [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.8),0_8px_20px_rgba(148,163,184,0.11)]">
      <div className="flex items-start gap-2.5">
        <Compass size={16} className="mt-0.5 text-[#5F7A63]" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-700">{t('growth_life_goal_title')}</p>
          <p className="mt-0.5 text-[10px] leading-tight text-slate-500">{t('growth_life_goal_desc')}</p>
        </div>
      </div>

      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={t('growth_life_goal_placeholder')}
        rows={2}
        className="mt-2.5 min-h-[64px] w-full resize-none rounded-xl border border-[#D4E5DA] bg-white/90 px-3 py-2 text-xs text-slate-700 outline-none"
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[10px] text-slate-500">{statusText || t('growth_life_goal_sync_hint')}</p>
        <button
          type="button"
          onClick={() => {
            void handleSave();
          }}
          disabled={saving || !hasUnsavedChanges}
          className="min-h-8 rounded-lg border border-transparent px-3 text-[11px] font-medium text-[#355643] disabled:opacity-55"
          style={{
            background: 'linear-gradient(135deg, rgba(236,248,241,0.96) 0%, rgba(213,236,222,0.92) 100%)',
            boxShadow: '0 4px 12px rgba(103,154,121,0.15)',
          }}
        >
          {saving ? t('growth_life_goal_saving') : t('growth_life_goal_save')}
        </button>
      </div>
    </section>
  );
};
