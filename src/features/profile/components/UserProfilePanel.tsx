// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/types/userProfile.ts
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/useAuthStore';
import { buildAIMemoryManualPayload } from './userProfilePanelHelpers';
import { triggerLightHaptic } from '../../../lib/haptics';

interface Props {
  plain?: boolean;
  showHeader?: boolean;
  page?: boolean;
}

export const UserProfilePanel: React.FC<Props> = ({
  plain = false,
  showHeader = true,
  page = false,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    longTermProfileEnabled,
    updateLongTermProfileEnabled,
    userProfileV2,
    updateUserProfile,
  } = useAuthStore();
  const [expanded, setExpanded] = React.useState(!showHeader || page);
  const [saveText, setSaveText] = React.useState('');
  const [toggleText, setToggleText] = React.useState('');

  const initialFreeText = userProfileV2?.manual?.freeText ?? '';
  const [freeText, setFreeText] = React.useState(initialFreeText);

  React.useEffect(() => {
    if (!showHeader || page) setExpanded(true);
  }, [showHeader, page]);

  React.useEffect(() => {
    setFreeText(userProfileV2?.manual?.freeText ?? '');
  }, [userProfileV2]);

  const hasUnsavedChanges = freeText !== (userProfileV2?.manual?.freeText ?? '');

  React.useEffect(() => {
    setToggleText('');
  }, [longTermProfileEnabled]);

  const handleSave = async () => {
    if (!hasUnsavedChanges) {
      setSaveText(t('profile_user_profile_no_changes'));
      return;
    }
    setSaveText('');
    const nextManual = buildAIMemoryManualPayload(userProfileV2?.manual, { freeText });
    const { error } = await updateUserProfile({ manual: nextManual });
    setSaveText(error ? t('profile_user_profile_save_failed') : t('profile_user_profile_saved'));
  };

  const handleToggleMemory = () => {
    triggerLightHaptic();
    setToggleText('');
    void updateLongTermProfileEnabled(!longTermProfileEnabled)
      .then(({ error }) => {
        setToggleText(
          error
            ? t('profile_long_term_profile_save_failed')
            : t('profile_long_term_profile_saved'),
        );
      });
  };

  const enabledSwitchStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #D8EEDE 0%, #B8DEC7 100%)',
    boxShadow: '0 5px 12px rgba(103,154,121,0.22), inset 0 1px 0 rgba(255,255,255,0.68)',
    border: 'none',
  };

  const memoryToggle = (
    <div className="rounded-2xl border border-white/70 bg-white/75 px-4 py-3 shadow-[0_6px_20px_rgba(148,163,184,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="profile-fn-title">{t('profile_long_term_profile')}</p>
          <p className="mt-1 text-[12px] font-medium leading-relaxed text-[#6b7f70]">
            {t('profile_long_term_profile_desc')}
          </p>
        </div>
        <button
          onClick={handleToggleMemory}
          type="button"
          role="switch"
          aria-checked={longTermProfileEnabled}
          aria-label={t('profile_long_term_profile')}
          className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full border transition-colors ${
            longTermProfileEnabled ? 'border-transparent' : 'border-transparent bg-slate-300'
          }`}
          style={longTermProfileEnabled ? enabledSwitchStyle : undefined}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              longTermProfileEnabled ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
      {toggleText ? <p className="mt-2 text-xs text-slate-500">{toggleText}</p> : null}
    </div>
  );

  const editorContent = (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-xs text-slate-600">{t('profile_user_profile_tab_personalization')}</span>
        <textarea
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder={t('profile_user_profile_personalization_placeholder')}
          rows={page ? 10 : 4}
          className="w-full rounded-2xl border border-[#CBE7D7] bg-white/85 px-3 py-2 text-xs text-slate-700 outline-none"
        />
      </label>
    </div>
  );

  const saveButton = (
    <>
      <button
        type="button"
        onClick={() => { void handleSave(); }}
        disabled={!hasUnsavedChanges}
        className="min-h-11 w-full rounded-2xl border border-transparent px-4 text-sm font-semibold text-[#355643] disabled:opacity-60"
        style={{
          background: 'linear-gradient(135deg, rgba(236,248,241,0.96) 0%, rgba(213,236,222,0.92) 100%)',
          boxShadow: '0 4px 12px rgba(103,154,121,0.15)',
        }}
      >
        {t('profile_user_profile_save')}
      </button>
      {saveText ? <p className="mt-2 text-center text-xs text-slate-500">{saveText}</p> : null}
    </>
  );

  if (page) {
    return (
      <div className="relative flex h-full items-center justify-center bg-transparent px-0 md:px-8">
        <div className="pointer-events-none fixed right-0 top-0 h-[280px] w-[280px] rounded-full bg-[#B2EEDA]/10 blur-[90px]" />
        <div className="pointer-events-none fixed bottom-[120px] left-0 h-[200px] w-[200px] rounded-full bg-rose-200/20 blur-[70px]" />
        <div className="app-mobile-page-frame profile-page-typography relative flex h-full w-full max-w-[430px] flex-col overflow-hidden text-slate-900 [box-shadow:0_0_0_1px_rgba(0,0,0,0.06),0_24px_64px_rgba(0,0,0,0.1)] md:h-[calc(100%-24px)] md:max-w-[980px] md:rounded-[30px] md:border md:border-white/70 md:bg-[#fcfaf7]/85 md:[box-shadow:0_0_0_1px_rgba(255,255,255,0.45),0_24px_64px_rgba(15,23,42,0.12)]">
          <header
            className="app-mobile-page-header sticky top-0 z-20 flex shrink-0 items-center gap-3 px-5 pb-4"
            style={{
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(14px) saturate(150%)',
              WebkitBackdropFilter: 'blur(14px) saturate(150%)',
            }}
          >
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white text-[#1e293b] shadow-[0_6px_18px_rgba(15,23,42,0.08)] active:scale-95"
              aria-label="Back"
            >
              <ArrowLeft size={18} strokeWidth={2} />
            </button>
            <h1 className="text-xl font-extrabold text-[#1e293b]">{t('profile_user_profile_title')}</h1>
          </header>

          <div className="app-modal-scroll min-h-0 flex-1 px-5 py-4 pb-6 sm:px-7">
            <div className="mb-4">{memoryToggle}</div>
            {editorContent}
          </div>

          <div
            className="shrink-0 border-t border-black/5 bg-white/95 px-5 pt-3.5 sm:px-7"
            style={{ paddingBottom: 'max(20px, calc(env(safe-area-inset-bottom, 0px) + 12px))' }}
          >
            {saveButton}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={plain ? 'overflow-hidden' : 'overflow-hidden rounded-2xl border border-white/65 bg-[#F7F9F8] [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.75),0_8px_24px_rgba(148,163,184,0.12)]'}>
      {showHeader ? (
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between px-4 py-3 transition hover:bg-white/70"
        >
          <div className="flex items-start gap-2.5 text-left">
            <Sparkles size={16} strokeWidth={1.5} className="mt-0.5 text-[#000000]" />
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
          <div className="space-y-4">
            {editorContent}
            <div className="pt-1">
              {saveButton}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
