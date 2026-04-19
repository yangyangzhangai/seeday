// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/store/useAuthStore.ts -> src/types/userProfile.ts
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Sparkles, Mail, Lock, ChevronRight, Crown, Plus, Trash2, Check, TrendingUp, Brain, Zap, Rocket } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/useAuthStore';
import { useTodoStore } from '../../store/useTodoStore';
import { useChatStore } from '../../store/useChatStore';
import { OnboardingStepRoutine, type RoutineState } from './OnboardingStepRoutine';
import {
  DEFAULT_WAKE_TIME, DEFAULT_SLEEP_TIME,
  DEFAULT_BREAKFAST, DEFAULT_LUNCH, DEFAULT_DINNER,
  toHour,
} from '../profile/components/userProfilePanelHelpers';
import type { UserProfileManualV2, ClassSchedule } from '../../types/userProfile';

function buildClassSchedule(ms: string, me: string, as_: string, ae: string, es: string, ee: string): ClassSchedule | undefined {
  const morning = ms && me ? { start: ms, end: me } : undefined;
  const afternoon = as_ && ae ? { start: as_, end: ae } : undefined;
  const evening = es && ee ? { start: es, end: ee } : undefined;
  if (!morning && !afternoon && !evening) return undefined;
  return { weekdays: [1, 2, 3, 4, 5], morning, afternoon, evening };
}
import profileVanAvatar from '../../assets/profile-ai-companions/van.png';
import profileAgnesAvatar from '../../assets/profile-ai-companions/agnes.png';

const TOTAL_STEPS = 6;
const ONBOARDED_KEY = 'seeday_onboarded';

const ProgressBar: React.FC<{ step: number }> = ({ step }) => (
  <div className="flex gap-1.5 px-8 pt-safe pt-6 pb-2 shrink-0">
    {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
      <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < step ? 'bg-[#4a5d4c]' : 'bg-[#4a5d4c]/15'}`} />
    ))}
  </div>
);

// ── StepAuth ──────────────────────────────────────────────────
const StepAuth: React.FC<{ onNext: () => void }> = ({ onNext }) => {
  const { t } = useTranslation();
  const { signIn, signUp, signInWithApple, signInWithGoogle } = useAuthStore();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim() || loading) return;
    setLoading(true); setError('');
    const { error: upErr } = await signUp(email.trim(), password);
    if (!upErr) { onNext(); return; }
    if (upErr.message?.toLowerCase().includes('already') || upErr.message?.toLowerCase().includes('registered')) {
      const { error: inErr } = await signIn(email.trim(), password);
      if (!inErr) { onNext(); return; }
    }
    setError(t('onboarding2_auth_error'));
    setLoading(false);
  };

  const handleOAuth = async (provider: 'apple' | 'google') => {
    setLoading(true);
    const { error: err } = provider === 'apple' ? await signInWithApple() : await signInWithGoogle();
    if (!err) { onNext(); return; }
    setError(t('onboarding2_auth_error'));
    setLoading(false);
  };

  return (
    <div className="flex-1 flex flex-col px-8 pt-10 pb-12">
      <div className="mb-10">
        <div className="w-16 h-16 bg-[#8fae91]/20 rounded-[24px] flex items-center justify-center mb-6">
          <Sparkles className="text-[#4a5d4c]" size={32} />
        </div>
        <h2 className="text-3xl font-black text-[#4a5d4c] leading-tight whitespace-pre-line">{t('onboarding2_auth_title')}</h2>
        <p className="text-[#4a5d4c]/60 mt-4 text-sm leading-relaxed whitespace-pre-line">{t('onboarding2_auth_desc')}</p>
      </div>

      <div className="space-y-3">
        <div className="bg-white/60 backdrop-blur-xl border border-white p-4 rounded-[24px] shadow-sm flex items-center gap-3 group focus-within:border-[#8fae91] transition-all">
          <Mail size={18} className="text-[#4a5d4c]/30 group-focus-within:text-[#4a5d4c] shrink-0" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('onboarding2_auth_placeholder')}
            className="flex-1 bg-transparent border-none outline-none text-[#4a5d4c] font-bold placeholder:text-[#4a5d4c]/20 text-sm" />
        </div>
        <div className="bg-white/60 backdrop-blur-xl border border-white p-4 rounded-[24px] shadow-sm flex items-center gap-3 group focus-within:border-[#8fae91] transition-all">
          <Lock size={18} className="text-[#4a5d4c]/30 group-focus-within:text-[#4a5d4c] shrink-0" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('onboarding2_auth_password')}
            onKeyDown={(e) => { if (e.key === 'Enter') { void handleSubmit(); } }}
            className="flex-1 bg-transparent border-none outline-none text-[#4a5d4c] font-bold placeholder:text-[#4a5d4c]/20 text-sm" />
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={() => { void handleOAuth('apple'); }} disabled={loading}
            className="flex-1 bg-white/60 backdrop-blur-xl border border-white py-3.5 rounded-[20px] flex items-center justify-center gap-2 text-sm font-bold text-[#4a5d4c] shadow-sm hover:bg-white/80 transition-all">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
            Apple
          </button>
          <button onClick={() => { void handleOAuth('google'); }} disabled={loading}
            className="flex-1 bg-white/60 backdrop-blur-xl border border-white py-3.5 rounded-[20px] flex items-center justify-center gap-2 text-sm font-bold text-[#4a5d4c] shadow-sm hover:bg-white/80 transition-all">
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Google
          </button>
        </div>
        {error && <p className="text-red-500 text-xs text-center font-bold pt-1">{error}</p>}
      </div>

      <div className="mt-auto pt-6">
        <button onClick={() => { void handleSubmit(); }} disabled={!email.trim() || !password.trim() || loading}
          className={`w-full py-5 rounded-[28px] font-bold text-lg shadow-xl transition-all flex items-center justify-center gap-2 ${
            email.trim() && password.trim() && !loading ? 'bg-[#4a5d4c] text-white shadow-[#4a5d4c]/20' : 'bg-[#4a5d4c]/10 text-[#4a5d4c]/20 shadow-none'
          }`}>
          {t('onboarding2_auth_cta')} <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
};

// ── StepAI ────────────────────────────────────────────────────
const StepAI: React.FC<{ onNext: () => void }> = ({ onNext }) => {
  const { t } = useTranslation();
  const { updatePreferences } = useAuthStore();

  const handleSelect = () => {
    void updatePreferences({ aiMode: 'van', aiModeEnabled: true });
    onNext();
  };

  return (
    <div className="flex-1 flex flex-col px-8 pt-10 pb-12">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-black text-[#4a5d4c]">{t('onboarding2_ai_title')}</h2>
      </div>

      <div className="space-y-4">
        <div className="p-6 bg-[#4a5d4c] rounded-[32px] shadow-2xl">
          <div className="flex items-start justify-between">
            <div className="w-14 h-14 bg-white/10 rounded-[20px] overflow-hidden">
              <img src={profileVanAvatar} className="w-full h-full object-cover opacity-80" alt="Van" />
            </div>
            <span className="bg-[#8fae91] text-white text-[10px] px-3 py-1 rounded-full font-black">{t('onboarding2_ai_van_badge')}</span>
          </div>
          <div className="mt-5">
            <h4 className="text-xl font-black text-white">Van (喇叭花)</h4>
            <p className="text-white/60 text-xs mt-2 leading-relaxed">{t('onboarding2_ai_van_desc')}</p>
          </div>
        </div>

        <div className="p-6 bg-white/60 backdrop-blur-xl border border-white rounded-[32px] opacity-70">
          <div className="flex items-start justify-between">
            <div className="w-14 h-14 bg-[#4a5d4c]/5 rounded-[20px] overflow-hidden">
              <img src={profileAgnesAvatar} className="w-full h-full object-cover opacity-50" alt="Agnes" />
            </div>
            <span className="bg-[#4a5d4c]/10 text-[#4a5d4c]/40 text-[10px] px-3 py-1 rounded-full font-black">{t('onboarding2_ai_agnes_badge')}</span>
          </div>
          <div className="mt-5">
            <h4 className="text-xl font-black text-[#4a5d4c]/60">Agnes (龙血树)</h4>
            <p className="text-[#4a5d4c]/40 text-xs mt-2 leading-relaxed">{t('onboarding2_ai_agnes_desc')}</p>
          </div>
        </div>
      </div>

      <button onClick={handleSelect} className="mt-auto pt-6 w-full bg-[#4a5d4c] text-white py-5 rounded-[28px] font-bold text-lg shadow-xl shadow-[#4a5d4c]/20">
        {t('onboarding2_ai_cta')}
      </button>
    </div>
  );
};

// ── StepJournal ───────────────────────────────────────────────
const StepJournal: React.FC<{ onNext: () => void }> = ({ onNext }) => {
  const { t } = useTranslation();
  const sendMessage = useChatStore((s) => s.sendMessage);
  const [content, setContent] = React.useState('');
  const [sending, setSending] = React.useState(false);

  const handleSend = async () => {
    if (!content.trim() || sending) return;
    setSending(true);
    await sendMessage(content.trim());
    onNext();
  };

  return (
    <div className="flex-1 flex flex-col px-6 pt-10 pb-10">
      <div className="mb-6 px-2">
        <h2 className="text-2xl font-black text-[#4a5d4c]">{t('onboarding2_journal_title')}</h2>
      </div>
      <div className="flex-1 flex flex-col bg-white/70 backdrop-blur-xl rounded-[32px] shadow-sm border border-white overflow-hidden">
        <textarea value={content} onChange={(e) => setContent(e.target.value)}
          className="flex-1 p-6 bg-transparent border-none outline-none resize-none text-base text-[#4a5d4c] font-medium placeholder:text-[#4a5d4c]/25"
          placeholder={t('onboarding2_journal_placeholder')} />
        <div className="p-5 border-t border-[#4a5d4c]/5">
          <button onClick={() => { void handleSend(); }} disabled={!content.trim() || sending}
            className={`w-full py-4 rounded-[24px] font-black text-base transition-all ${
              content.trim() && !sending ? 'bg-[#4a5d4c] text-white shadow-lg shadow-[#4a5d4c]/20' : 'bg-[#4a5d4c]/10 text-[#4a5d4c]/25'
            }`}>
            {t('onboarding2_journal_cta')}
          </button>
        </div>
      </div>
      <p className="mt-5 text-center text-[10px] text-[#4a5d4c]/30 font-bold uppercase tracking-widest">Powered by Van AI Engine</p>
    </div>
  );
};

// ── StepTodo ──────────────────────────────────────────────────
const StepTodo: React.FC<{ onNext: () => void }> = ({ onNext }) => {
  const { t } = useTranslation();
  const addTodo = useTodoStore((s) => s.addTodo);
  const [input, setInput] = React.useState('');
  const [items, setItems] = React.useState<string[]>([]);

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    addTodo({ title: trimmed, priority: 'medium' });
    setItems((prev) => [...prev, trimmed]);
    setInput('');
  };

  return (
    <div className="flex-1 flex flex-col px-8 pt-16 pb-12 overflow-y-auto">
      <h2 className="text-2xl font-black text-[#4a5d4c] mb-8">{t('onboarding2_todo_title')}</h2>

      {/* 待办列表 */}
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3 bg-white/60 backdrop-blur-xl border border-white px-4 py-3.5 rounded-[20px]">
            <div className="w-4 h-4 rounded-full border-2 border-[#8fae91] shrink-0" />
            <span className="flex-1 text-sm font-bold text-[#4a5d4c]">{item}</span>
            <button
              onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
              className="text-[#4a5d4c]/20 hover:text-red-400 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}

        {/* 输入区域 */}
        <div className="bg-white/60 backdrop-blur-xl border border-white p-3 rounded-[24px] flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            placeholder={t('onboarding2_todo_add_placeholder')}
            className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-[#4a5d4c] placeholder:text-[#4a5d4c]/20 px-2"
          />
          <button
            onClick={handleAdd}
            disabled={!input.trim()}
            className={`p-2.5 rounded-[16px] transition-all ${input.trim() ? 'bg-[#4a5d4c] text-white' : 'bg-[#4a5d4c]/10 text-[#4a5d4c]/20'}`}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="mt-auto pt-8">
        {items.length > 0 ? (
          <button
            onClick={onNext}
            className="w-full bg-[#4a5d4c] text-white py-5 rounded-[28px] font-bold text-lg shadow-xl shadow-[#4a5d4c]/20 flex items-center justify-center gap-2"
          >
            {t('onboarding2_todo_cta')} <ChevronRight size={20} />
          </button>
        ) : (
          <div className="py-5 text-center text-[11px] text-[#4a5d4c]/30 font-bold">
            {t('onboarding2_todo_hint')}
          </div>
        )}
      </div>
    </div>
  );
};

// ── StepSubscription ──────────────────────────────────────────
const StepSubscription: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  const { t } = useTranslation();
  const [selectedPlan, setSelectedPlan] = React.useState('trial');

  const PLANS = [
    { id: 'trial',  name: t('onboarding2_sub_plan_trial_name'),  price: '0.00',  period: t('onboarding2_sub_plan_trial_period_unit'),  desc: t('onboarding2_sub_plan_trial_desc'),  popular: true,  tag: t('onboarding2_sub_plan_trial_tag') },
    { id: 'yearly', name: t('onboarding2_sub_plan_yearly_name'), price: '99.99', period: t('onboarding2_sub_plan_yearly_period_unit'), desc: t('onboarding2_sub_plan_yearly_desc'), popular: false, tag: t('onboarding2_sub_plan_yearly_tag') },
  ];

  const PRO_FEATURES = [
    { icon: <Sparkles size={16} />, label: t('onboarding2_sub_feat_ai_label'),     desc: t('onboarding2_sub_feat_ai_desc') },
    { icon: <TrendingUp size={16} />, label: t('onboarding2_sub_feat_growth_label'), desc: t('onboarding2_sub_feat_growth_desc') },
    { icon: <Brain size={16} />,     label: t('onboarding2_sub_feat_memory_label'), desc: t('onboarding2_sub_feat_memory_desc') },
  ];

  return (
    <div className="flex-1 flex flex-col px-6 pt-10 pb-6 overflow-y-auto no-scrollbar">
      {/* 头部标题区 */}
      <div className="text-center mb-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30 mb-4"
        >
          <Crown size={28} className="text-white fill-white/20" />
        </motion.div>
        <h2 className="text-2xl font-black text-[#4a5d4c] tracking-tight">{t('onboarding2_sub_title')}</h2>
        <p className="text-[#4a5d4c]/50 text-xs mt-1 font-medium">{t('onboarding2_sub_tagline')}</p>
      </div>

      {/* 订阅方案选择 */}
      <div className="space-y-3 mb-8">
        {PLANS.map((plan) => {
          const isSelected = selectedPlan === plan.id;
          return (
            <motion.button
              key={plan.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedPlan(plan.id)}
              className={`relative w-full p-4 rounded-[28px] border-2 transition-all duration-300 text-left overflow-hidden ${
                isSelected ? 'border-purple-500 bg-purple-50/50' : 'border-white bg-white/40'
              }`}
            >
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    isSelected ? 'bg-purple-500 border-purple-500' : 'border-[#4a5d4c]/10'
                  }`}>
                    {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${isSelected ? 'text-purple-700' : 'text-[#4a5d4c]'}`}>
                        {plan.name}
                      </span>
                      {plan.tag && (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          isSelected ? 'bg-purple-100 text-purple-600' : 'bg-[#4a5d4c]/10 text-[#4a5d4c]/50'
                        }`}>
                          {plan.tag}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[#4a5d4c]/40 font-medium mt-0.5">{plan.desc}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-baseline justify-end gap-0.5">
                    <span className="text-[10px] font-bold text-[#4a5d4c]/30">¥</span>
                    <span className={`text-lg font-black ${isSelected ? 'text-purple-600' : 'text-[#4a5d4c]'}`}>
                      {plan.price}
                    </span>
                  </div>
                  <p className="text-[9px] text-[#4a5d4c]/30 font-bold">/{plan.period}</p>
                </div>
              </div>
              {plan.popular && (
                <div className="absolute top-0 right-0 p-1 px-3 rounded-bl-xl bg-purple-500 text-[8px] font-black text-white uppercase tracking-tighter">
                  {t('onboarding2_sub_popular_badge')}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Pro 专属功能卡片 */}
      <div className="bg-white/30 backdrop-blur-md rounded-[32px] p-5 border border-white/60 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={14} className="text-purple-500 fill-purple-500" />
          <h3 className="text-[10px] font-black text-[#4a5d4c]/40 uppercase tracking-widest">
            {t('onboarding2_sub_features_title')}
          </h3>
        </div>
        <div className="space-y-4">
          {PRO_FEATURES.map((feature, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/60 flex items-center justify-center shrink-0 text-purple-600 shadow-sm">
                {feature.icon}
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-[#4a5d4c]">{feature.label}</h4>
                <p className="text-[9px] text-[#4a5d4c]/40 font-medium">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 底部操作区 */}
      <div className="mt-auto space-y-4">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onFinish}
          className="w-full py-5 rounded-[28px] bg-[#4a5d4c] text-white font-black text-lg shadow-xl shadow-[#4a5d4c]/20 flex items-center justify-center gap-3 transition-transform"
        >
          <Rocket size={20} />
          {selectedPlan === 'trial' ? t('onboarding2_sub_cta_trial') : t('onboarding2_sub_cta_upgrade')}
        </motion.button>

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onFinish}
            className="w-full py-4 rounded-[24px] border border-[#4a5d4c]/10 text-[#4a5d4c]/50 font-black text-xs uppercase tracking-[0.2em] hover:bg-[#4a5d4c]/5 transition-all"
          >
            {t('onboarding2_sub_skip_v2')}
          </button>
          <div className="flex items-center justify-center gap-6">
            <span className="text-[9px] text-[#4a5d4c]/30 font-bold flex items-center gap-1">
              <Check size={10} /> {t('onboarding2_sub_badge_cancel')}
            </span>
            <span className="text-[9px] text-[#4a5d4c]/30 font-bold flex items-center gap-1">
              <Check size={10} /> {t('onboarding2_sub_badge_secure')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main OnboardingFlow ───────────────────────────────────────
export const OnboardingFlow: React.FC = () => {
  const { user, updateUserProfile, userProfileV2 } = useAuthStore();
  const navigate = useNavigate();

  const [step, setStep] = React.useState(user ? 2 : 1);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (user && step === 1) setStep(2);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const [routine, setRoutine] = React.useState<RoutineState>({
    region: '北京',
    identity: 'none',
    wakeTime: DEFAULT_WAKE_TIME,
    sleepTime: DEFAULT_SLEEP_TIME,
    breakfastTime: DEFAULT_BREAKFAST,
    lunchTime: DEFAULT_LUNCH,
    dinnerTime: DEFAULT_DINNER,
    workStart: '09:00', workLunchStart: '12:00', workLunchEnd: '13:30', workEnd: '18:00',
    classMorningStart: '08:30', classMorningEnd: '11:45',
    classAfternoonStart: '14:00', classAfternoonEnd: '17:30',
    classEveningStart: '19:00', classEveningEnd: '21:00',
  });

  const handleRoutineChange = <K extends keyof RoutineState>(key: K, val: RoutineState[K]) =>
    setRoutine((prev) => ({ ...prev, [key]: val }));

  const requestNotificationPermission = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        await LocalNotifications.requestPermissions();
      } catch { /* web fallback */ }
    }
  };

  const saveRoutineAndProceed = async () => {
    setSaving(true);
    const mealHours = [routine.breakfastTime, routine.lunchTime, routine.dinnerTime]
      .map(toHour).filter((h): h is number => h !== null);
    const hasWork = routine.identity === 'work';
    const hasClass = routine.identity === 'class';
    const manual: UserProfileManualV2 = {
      ...(userProfileV2?.manual || {}),
      wakeTime: routine.wakeTime || undefined,
      sleepTime: routine.sleepTime || undefined,
      mealTimes: mealHours.length ? mealHours : undefined,
      mealTimesText: [routine.breakfastTime, routine.lunchTime, routine.dinnerTime],
      lunchTime: routine.lunchTime || undefined,
      dinnerTime: routine.dinnerTime || undefined,
      hasWorkSchedule: hasWork,
      hasClassSchedule: hasClass,
      workStart: hasWork ? (routine.workStart || undefined) : undefined,
      workEnd: hasWork ? (routine.workEnd || undefined) : undefined,
      lunchStart: hasWork ? (routine.workLunchStart || undefined) : undefined,
      lunchEnd: hasWork ? (routine.workLunchEnd || undefined) : undefined,
      classSchedule: hasClass ? buildClassSchedule(
        routine.classMorningStart, routine.classMorningEnd,
        routine.classAfternoonStart, routine.classAfternoonEnd,
        routine.classEveningStart, routine.classEveningEnd,
      ) : undefined,
      reminderEnabled: true,
    };
    void updateUserProfile({ manual });
    await requestNotificationPermission();
    setSaving(false);
    setStep((s) => s + 1);
  };

  const handleComplete = () => {
    localStorage.setItem(ONBOARDED_KEY, 'true');
    void updateUserProfile({ onboardingCompleted: true });
    navigate('/chat', { replace: true });
  };

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'linear-gradient(160deg, #eef3ef 0%, #e6ede7 100%)' }}>
      <ProgressBar step={step} />
      <div className="flex-1 overflow-hidden flex flex-col">
        {step === 1 && <StepAuth onNext={next} />}
        {step === 2 && (
          <OnboardingStepRoutine
            state={routine}
            onChange={handleRoutineChange}
            onNext={() => { void saveRoutineAndProceed(); }}
            saving={saving}
          />
        )}
        {step === 3 && <StepAI onNext={next} />}
        {step === 4 && <StepJournal onNext={next} />}
        {step === 5 && <StepTodo onNext={next} />}
        {step === 6 && <StepSubscription onFinish={handleComplete} />}
      </div>
    </div>
  );
};
