// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/用户画像模块_需求与技术文档_v1.md
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import {
  buildAIMemoryManualPayload,
} from './userProfilePanelHelpers';

interface Props {
  plain?: boolean;
  showHeader?: boolean;
}

function signature(input: {
  freeText: string;
}): string {
  return JSON.stringify({
    ...input,
    freeText: input.freeText.trim(),
  });
}

export const UserProfilePanel: React.FC<Props> = ({
  plain = false,
  showHeader = true,
}) => {
  const { t } = useTranslation();
  const { userProfileV2, updateUserProfile } = useAuthStore();
  const [expanded, setExpanded] = React.useState(!showHeader);
  const [saving, setSaving] = React.useState(false);
  const [saveText, setSaveText] = React.useState('');

  const [freeText, setFreeText] = React.useState('');

  const baselineSignature = React.useMemo(() => {
    const manual = userProfileV2?.manual;
    return signature({
      freeText: manual?.freeText || '',
    });
  }, [userProfileV2]);

  React.useEffect(() => {
    if (!showHeader) {
      setExpanded(true);
    }
  }, [showHeader]);

  React.useEffect(() => {
    const manual = userProfileV2?.manual;
    setFreeText(manual?.freeText || '');
  }, [userProfileV2]);

  const currentSignature = React.useMemo(
    () => signature({
      freeText,
    }),
    [freeText],
  );

  const hasUnsavedChanges = currentSignature !== baselineSignature;

  const handleSave = async () => {
    if (!hasUnsavedChanges) {
      setSaveText(t('profile_user_profile_no_changes'));
      return;
    }
    setSaveText('');
    setSaving(true);

    const nextManual = buildAIMemoryManualPayload(userProfileV2?.manual, {
      freeText,
    });

    const { error } = await updateUserProfile({
      manual: nextManual,
    });

    setSaving(false);
    setSaveText(error ? t('profile_user_profile_save_failed') : t('profile_user_profile_saved'));
  };

  return (
    <div className={plain ? 'overflow-hidden' : 'overflow-hidden rounded-2xl border border-white/65 bg-[#F7F9F8] [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.75),0_8px_24px_rgba(148,163,184,0.12)]'}>
      {showHeader ? (
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between px-4 py-3 transition hover:bg-white/70"
        >
          <div className="flex items-start gap-2.5 text-left">
            <Sparkles size={16} strokeWidth={1.5} className="mt-0.5 text-[#5F7A63]" />
            <div>
              <p className="profile-fn-title">{t('profile_user_profile_title')}</p>
              <p className="mt-0.5 text-[10px] font-light leading-tight text-slate-500">{t('profile_user_profile_desc')}</p>
            </div>
          </div>
          {expanded ? <ChevronUp size={16} strokeWidth={1.5} className="text-slate-400" /> : <ChevronDown size={16} strokeWidth={1.5} className="text-slate-400" />}
        </button>
      ) : null}

      {expanded ? (
        <div className={showHeader ? 'border-t border-slate-200/60 px-4 pb-4 pt-3' : 'px-4 pb-4 pt-3'}>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-600">{t('profile_user_profile_tab_personalization')}</span>
              <textarea
                value={freeText}
                onChange={(event) => setFreeText(event.target.value)}
                placeholder={t('profile_user_profile_personalization_placeholder')}
                rows={6}
                className="w-full rounded-lg border border-[#CBE7D7] bg-white/85 px-3 py-2 text-xs text-slate-700 outline-none"
              />
            </label>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => { void handleSave(); }}
                disabled={saving || !hasUnsavedChanges}
                className="min-h-9 rounded-lg border border-transparent px-4 text-xs font-medium text-[#355643] disabled:opacity-60"
                style={{
                  background: 'linear-gradient(135deg, rgba(236,248,241,0.96) 0%, rgba(213,236,222,0.92) 100%)',
                  boxShadow: '0 4px 12px rgba(103,154,121,0.15)',
                }}
              >
                {saving ? t('profile_user_profile_saving') : t('profile_user_profile_save')}
              </button>
              {saveText ? <p className="mt-2 text-xs text-slate-500">{saveText}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
