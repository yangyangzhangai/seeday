import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  Crown,
  Check,
  Rocket,
  FileText,
  CalendarDays,
  CalendarRange,
  History,
  Zap,
  Sparkles,
  TrendingUp,
  Brain,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';
import { isEligibleForMembershipTrial } from '../../features/profile/membershipTrialEligibility';

const PLANS = [
  {
    id: 'monthly',
    nameKey: 'membership_purchase_plan_monthly_name',
    price: '7.99',
    periodKey: 'membership_purchase_plan_period_month',
    descKey: 'membership_purchase_plan_monthly_desc',
    popular: false,
    tagKey: '',
  },
  {
    id: 'yearly',
    nameKey: 'membership_purchase_plan_yearly_name',
    price: '99.99',
    periodKey: 'membership_purchase_plan_period_year',
    descKey: 'membership_purchase_plan_yearly_desc',
    popular: true,
    tagKey: 'membership_purchase_plan_yearly_tag',
  },
] as const;

const PRO_FEATURES = [
  {
    icon: <Sparkles size={18} />,
    labelKey: 'membership_purchase_feat_all_roles_title',
    descKey: 'membership_purchase_feat_all_roles_desc',
  },
  {
    icon: <TrendingUp size={18} />,
    labelKey: 'membership_purchase_feat_growth_title',
    descKey: 'membership_purchase_feat_growth_desc',
  },
  {
    icon: <Brain size={18} />,
    labelKey: 'membership_purchase_feat_memory_title',
    descKey: 'membership_purchase_feat_memory_desc',
  },
  {
    icon: <FileText size={18} />,
    labelKey: 'membership_purchase_feat_daily_title',
    descKey: 'membership_purchase_feat_daily_desc',
  },
  {
    icon: <CalendarDays size={18} />,
    labelKey: 'membership_purchase_feat_weekly_title',
    descKey: 'membership_purchase_feat_weekly_desc',
  },
  {
    icon: <CalendarRange size={18} />,
    labelKey: 'membership_purchase_feat_monthly_title',
    descKey: 'membership_purchase_feat_monthly_desc',
  },
  {
    icon: <History size={18} />,
    labelKey: 'membership_purchase_feat_yearly_title',
    descKey: 'membership_purchase_feat_yearly_desc',
  },
];

interface MembershipPurchaseModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onPurchase?: (planId: 'monthly' | 'yearly') => void | Promise<void>;
  ctaLabel?: string;
}

export function MembershipPurchaseModal({
  isOpen = true,
  onClose,
  onPurchase,
  ctaLabel,
}: MembershipPurchaseModalProps) {
  const [selectedPlan, setSelectedPlan] = useState('yearly');
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isPlus } = useAuthStore((state) => ({
    user: state.user,
    isPlus: state.isPlus,
  }));
  const trialEligible = isEligibleForMembershipTrial(user, isPlus);

  const handlePurchase = () => {
    if (onPurchase) {
      void onPurchase(selectedPlan as 'monthly' | 'yearly');
      return;
    }
    onClose();
    if (window.location.pathname !== '/upgrade') {
      navigate('/upgrade');
    }
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          style={{ isolation: 'isolate' }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-md"
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="relative w-full max-w-lg overflow-hidden rounded-t-[40px] border border-white/20 bg-white/90 shadow-2xl backdrop-blur-2xl sm:rounded-[32px] dark:bg-zinc-900/90"
            style={{
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute left-0 top-0 -z-10 h-40 w-full overflow-hidden">
              <div className="absolute -left-20 -top-20 h-60 w-60 rounded-full bg-purple-500/20 blur-[80px]" />
              <div className="absolute -right-20 -top-10 h-40 w-40 rounded-full bg-pink-500/20 blur-[60px]" />
              <div className="absolute left-1/2 top-20 h-40 w-80 -translate-x-1/2 rounded-full bg-green-500/10 blur-[100px]" />
            </div>

            <div className="relative px-6 pb-6 pt-10 text-center">
              <button
                onClick={onClose}
                className="absolute right-6 top-6 rounded-full bg-black/5 p-2 transition-colors hover:bg-black/10"
                aria-label={t('auth_close')}
              >
                <X size={20} className="text-zinc-500" />
              </button>

              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-purple-600 to-pink-500 shadow-lg shadow-purple-500/30"
              >
                <Crown size={32} className="fill-white/20 text-white" />
              </motion.div>

              <h2 className="mb-2 text-2xl font-black tracking-tighter text-zinc-900 dark:text-white">
                {t('membership_purchase_title')}
              </h2>
              <p className="text-sm font-medium text-zinc-500">{t('membership_purchase_subtitle')}</p>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-2">
              <div className="grid gap-3">
                {PLANS.map((plan) => {
                  const isSelected = selectedPlan === plan.id;
                  const isTrialPlan = trialEligible && plan.id === 'monthly';
                  return (
                    <motion.button
                      key={plan.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`group relative w-full overflow-hidden rounded-3xl border-2 p-4 text-left transition-all duration-300 ${
                        isSelected
                          ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-900/20'
                          : 'border-zinc-100 bg-white dark:border-zinc-800 dark:bg-zinc-800/50'
                      }`}
                    >
                      {isSelected ? (
                        <motion.div
                          layoutId="selected-bg"
                          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-purple-500/5 to-transparent"
                        />
                      ) : null}

                      <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div
                            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
                              isSelected ? 'border-purple-500 bg-purple-500' : 'border-zinc-200'
                            }`}
                          >
                            {isSelected ? <Check size={14} className="text-white" strokeWidth={3} /> : null}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-base font-bold ${
                                  isSelected ? 'text-purple-700 dark:text-purple-300' : 'text-zinc-800 dark:text-zinc-200'
                                }`}
                              >
                                {isTrialPlan ? t('membership_purchase_trial_name') : t(plan.nameKey)}
                              </span>
                              {plan.tagKey ? (
                                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-purple-600 dark:bg-purple-900/50">
                                  {t(plan.tagKey)}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-0.5 text-xs font-medium text-zinc-400">
                              {isTrialPlan ? t('membership_purchase_trial_desc') : t(plan.descKey)}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          {isTrialPlan ? (
                            <>
                              <div className="mb-0.5 flex items-baseline justify-end gap-1">
                                <span className="text-[10px] font-semibold text-zinc-400 line-through">$7.99</span>
                              </div>
                              <div className="flex items-baseline justify-end gap-0.5">
                                <span className="text-[10px] font-bold text-zinc-400">$</span>
                                <span
                                  className={`text-2xl font-black ${
                                    isSelected ? 'text-purple-600 dark:text-purple-400' : 'text-zinc-900 dark:text-zinc-100'
                                  }`}
                                >
                                  0
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-zinc-400">/{t('membership_purchase_trial_period')}</p>
                            </>
                          ) : (
                            <>
                              <div className="flex items-baseline justify-end gap-0.5">
                                <span className="text-[10px] font-bold text-zinc-400">$</span>
                                <span
                                  className={`text-2xl font-black ${
                                    isSelected ? 'text-purple-600 dark:text-purple-400' : 'text-zinc-900 dark:text-zinc-100'
                                  }`}
                                >
                                  {plan.price}
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-zinc-400">/{t(plan.periodKey)}</p>
                            </>
                          )}
                        </div>
                      </div>

                      {plan.popular ? (
                        <div className="absolute right-0 top-0 rounded-bl-xl bg-purple-500 px-3 py-1 text-[9px] font-black uppercase tracking-tighter text-white">
                          {t('membership_purchase_popular_badge')}
                        </div>
                      ) : null}
                    </motion.button>
                  );
                })}
              </div>

              <div className="space-y-5 py-4">
                <div className="flex items-center gap-2 px-1">
                  <Zap size={16} className="fill-purple-500 text-purple-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">
                    {t('membership_purchase_features_title')}
                  </h3>
                </div>

                <div className="grid gap-4">
                  {PRO_FEATURES.map((feature, idx) => (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + idx * 0.05 }}
                      key={feature.labelKey}
                      className="flex items-start gap-4"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-50 text-purple-600 dark:bg-zinc-800">
                        {feature.icon}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{t(feature.labelKey)}</h4>
                        <p className="text-[11px] font-medium leading-relaxed text-zinc-400">{t(feature.descKey)}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-100 bg-white/50 p-6 pt-2 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/50">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handlePurchase}
                className="flex w-full items-center justify-center gap-3 rounded-3xl bg-zinc-900 py-4 text-base font-black text-white shadow-xl shadow-zinc-900/10 transition-transform dark:bg-white dark:text-zinc-900"
              >
                <Rocket size={20} />
                {ctaLabel ?? t('membership_purchase_cta')}
              </motion.button>

              <div className="mt-4 flex items-center justify-center gap-4">
                <span className="flex items-center gap-1 text-[10px] text-zinc-400">
                  <Check size={12} /> {t('membership_purchase_footer_cancel_anytime')}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-zinc-400">
                  <Check size={12} /> {t('membership_purchase_footer_secure_pay')}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
