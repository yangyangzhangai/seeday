import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useGrowthStore, MAX_BOTTLES, type Bottle } from '../../store/useGrowthStore';
import { BottleCard } from './BottleCard';
import { AddBottleModal } from './AddBottleModal';
import { AddGrowthTodoModal } from './AddGrowthTodoModal';
import { useTodoStore, type Recurrence } from '../../store/useTodoStore';
import { computeBottleCheckinStats } from '../../lib/bottleStats';
import { BottleDetailSheet } from './BottleDetailSheet';
import { cn } from '../../lib/utils';
import {
  APP_MODAL_CARD_CLASS,
  APP_GREEN_GLASS_BUTTON_STYLE,
  APP_MODAL_OVERLAY_CLASS,
  APP_MODAL_PRIMARY_BUTTON_CLASS,
  APP_MODAL_SECONDARY_BUTTON_CLASS,
} from '../../lib/modalTheme';

export const BottleList = () => {
  const { t, i18n } = useTranslation();
  const {
    bottles,
    addBottle,
    removeBottle,
    markBottleIrrigated,
    continueBottle,
    fetchBottles,
    isLoading,
    hasHydrated,
    lastSyncError,
  } = useGrowthStore();
  const addTodo = useTodoStore((s) => s.addTodo);
  const [showAdd, setShowAdd] = useState(false);
  const [addError, setAddError] = useState('');
  const [showSectionHint, setShowSectionHint] = useState(false);
  const hintTimerRef = useRef<number | null>(null);
  const hintAnchorRef = useRef<HTMLDivElement>(null);
  const bottleScrollRef = useRef<HTMLDivElement>(null);
  const scrollFadeTimerRef = useRef<number | null>(null);
  const [scrollIndicator, setScrollIndicator] = useState({ visible: false, left: 0, width: 100 });

  // Prompt shown after creating a new habit bottle
  const [habitPromptBottle, setHabitPromptBottle] = useState<Bottle | null>(null);
  // Unified bottle detail sheet shown on click
  const [selectedBottle, setSelectedBottle] = useState<Bottle | null>(null);

  const [showTodoModal, setShowTodoModal] = useState(false);
  const [todoDefaultBottle, setTodoDefaultBottle] = useState<{ title?: string; bottleId?: string; recurrence?: Recurrence } | undefined>();

  const activeBottles = bottles.filter((b) => b.status === 'active' || b.status === 'achieved');
  const isMaxReached = activeBottles.length >= MAX_BOTTLES;

  const handleRetrySync = () => {
    void fetchBottles();
  };

  const handleAddBottle = (name: string, type: 'habit' | 'goal') => {
    const bottle = addBottle(name, type);
    if (!bottle) {
      setAddError(t('growth_bottle_name_duplicate'));
      return;
    }
    setAddError('');
    setShowAdd(false);
    if (type === 'habit') {
      setHabitPromptBottle(bottle);
    }
  };

  // After new-habit auto-prompt confirms
  const handleHabitConfirm = () => {
    if (!habitPromptBottle) return;
    setTodoDefaultBottle({ title: habitPromptBottle.name, bottleId: habitPromptBottle.id, recurrence: 'daily' });
    setHabitPromptBottle(null);
    setShowTodoModal(true);
  };

  const handleCreateTodo = (targetBottle: Bottle, recurrence: Recurrence) => {
    setTodoDefaultBottle({
      title: targetBottle.name,
      bottleId: targetBottle.id,
      recurrence,
    });
    setSelectedBottle(null);
    setShowTodoModal(true);
  };

  const handleIrrigate = (id: string) => {
    setSelectedBottle(null);
    markBottleIrrigated(id);
  };

  const handleContinueGoal = (id: string) => {
    setSelectedBottle(null);
    continueBottle(id);
  };

  const handleDeleteBottle = (id: string) => {
    setSelectedBottle(null);
    removeBottle(id);
  };

  const selectedBottleStats = computeBottleCheckinStats(selectedBottle?.checkinDates);

  const updateScrollIndicator = useCallback((visible: boolean) => {
    const el = bottleScrollRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const width = Math.min(100, Math.max(32, (el.clientWidth / el.scrollWidth) * 100));
    const left = maxScroll > 0 ? (el.scrollLeft / maxScroll) * (100 - width) : 0;
    setScrollIndicator({ visible: visible && maxScroll > 0, left, width });
  }, []);

  const handleBottleScroll = () => {
    updateScrollIndicator(true);
    if (scrollFadeTimerRef.current !== null) window.clearTimeout(scrollFadeTimerRef.current);
    scrollFadeTimerRef.current = window.setTimeout(() => {
      setScrollIndicator((current) => ({ ...current, visible: false }));
      scrollFadeTimerRef.current = null;
    }, 650);
  };

  useEffect(() => {
    const sync = () => updateScrollIndicator(false);
    sync();
    window.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('resize', sync);
      if (scrollFadeTimerRef.current !== null) window.clearTimeout(scrollFadeTimerRef.current);
    };
  }, [activeBottles.length, updateScrollIndicator]);

  useEffect(() => {
    if (!showSectionHint) return;

    const clearHint = () => {
      setShowSectionHint(false);
    };

    hintTimerRef.current = window.setTimeout(clearHint, 3000);

    const handlePointerDown = (event: MouseEvent | PointerEvent | TouchEvent) => {
      if (hintAnchorRef.current?.contains(event.target as Node)) return;
      clearHint();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      if (hintTimerRef.current !== null) {
        window.clearTimeout(hintTimerRef.current);
        hintTimerRef.current = null;
      }
    };
  }, [showSectionHint]);

  const handleSectionTitleClick = () => {
    if (hintTimerRef.current !== null) {
      window.clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
    setShowSectionHint(true);
  };

  const hintTextStyle = i18n.language.startsWith('en')
    ? { fontFamily: '"Comic Sans MS", "Bradley Hand", "Marker Felt", "Segoe Print", cursive' }
    : undefined;

  return (
    <section className="mb-4">
      <div className="px-4 mb-3">
        <div className="flex items-center justify-between">
          <div ref={hintAnchorRef} className="relative">
            <button
              type="button"
              onClick={handleSectionTitleClick}
              className="text-left"
            >
              <h2 className="text-sm font-extrabold text-[#1e293b]">{t('growth_bottle_section')}</h2>
            </button>
            {showSectionHint ? (
              <div
                className="absolute left-[calc(100%+12px)] top-1/2 z-10 -translate-y-1/2 px-3.5 py-2.5 text-xs text-[#6B8FB8]"
                style={{
                  background: 'linear-gradient(135deg, rgba(239,246,255,0.94) 0%, rgba(219,234,254,0.82) 52%, rgba(191,219,254,0.74) 100%)',
                  backdropFilter: 'blur(24px) saturate(175%) brightness(1.03)',
                  WebkitBackdropFilter: 'blur(24px) saturate(175%) brightness(1.03)',
                  borderRadius: '999px',
                  boxShadow: '0 16px 36px -20px rgba(59,130,246,0.45), 0 10px 18px -16px rgba(148,163,184,0.32), inset 0 1px 0 rgba(255,255,255,0.95)',
                  border: '1px solid rgba(255,255,255,0.72)',
                }}
              >
                <span
                  aria-hidden="true"
                  className="absolute bottom-[5px] left-[10px] h-4 w-5 rounded-bl-[18px] rounded-br-[4px] rounded-tl-[6px] rounded-tr-[14px] -rotate-[28deg]"
                  style={{
                    background: 'linear-gradient(135deg, rgba(239,246,255,0.94) 0%, rgba(219,234,254,0.82) 52%, rgba(191,219,254,0.74) 100%)',
                    borderLeft: '1px solid rgba(255,255,255,0.72)',
                    borderBottom: '1px solid rgba(255,255,255,0.72)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.92)',
                  }}
                />
                <span className="relative z-[1] whitespace-nowrap font-medium tracking-[0.01em]" style={hintTextStyle}>
                  {t('growth_bottle_section_hint')}
                </span>
              </div>
            ) : null}
          </div>
          <button
            onClick={() => !isMaxReached && setShowAdd(true)}
            disabled={isMaxReached}
            className="flex h-9 w-9 items-center justify-center rounded-full p-0 text-[#8FAA42] transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              ...APP_GREEN_GLASS_BUTTON_STYLE,
            }}
            title={isMaxReached ? t('growth_bottle_max_reached') : t('growth_add_bottle')}
          >
            <Plus size={20} strokeWidth={2.1} />
          </button>
        </div>
      </div>

      {isMaxReached && (
        <p className="mb-2 px-4 text-xs text-orange-500">{t('growth_bottle_max_reached')}</p>
      )}

      {isLoading && !hasHydrated ? (
        <div className="py-6 text-center text-sm text-gray-400">{t('loading')}</div>
      ) : lastSyncError && activeBottles.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6">
          <p className="text-center text-xs text-orange-500">{lastSyncError}</p>
          <button
            onClick={handleRetrySync}
            className="rounded-lg bg-[#A86B2B] px-3 py-1.5 text-xs font-medium text-white"
          >
            {t('retry')}
          </button>
        </div>
      ) : activeBottles.length === 0 ? (
        <div className="text-center text-gray-400 py-6 text-sm">{t('no_data')}</div>
      ) : (
        <div className="relative mt-2">
          <div
            ref={bottleScrollRef}
            onScroll={handleBottleScroll}
            className="scrollbar-none flex gap-7 overflow-x-auto px-4 pb-3"
          >
            {activeBottles.map((bottle) => (
              <BottleCard
                key={bottle.id}
                bottle={bottle}
                onSelect={setSelectedBottle}
              />
            ))}
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-1/2 h-[3px] w-14 -translate-x-1/2 transition-opacity duration-300"
            style={{ opacity: scrollIndicator.visible ? 1 : 0 }}
          >
            <span
              className="absolute inset-y-0 rounded-full"
              style={{
                left: `${scrollIndicator.left}%`,
                width: `${scrollIndicator.width}%`,
                background: 'rgba(66, 109, 86, 0.28)',
                boxShadow: '0 1px 4px rgba(66, 109, 86, 0.12)',
              }}
            />
          </div>
        </div>
      )}

      <AddBottleModal
        isOpen={showAdd}
        onClose={() => { setShowAdd(false); setAddError(''); }}
        onAdd={handleAddBottle}
        error={addError}
      />

      {/* ── Fixed modals (not clipped by overflow) ── */}

      {/* 1. New habit auto-prompt */}
      {habitPromptBottle && (
        <div className={cn('fixed inset-0 z-50 flex items-center justify-center', APP_MODAL_OVERLAY_CLASS)}>
          <div className={cn(APP_MODAL_CARD_CLASS, 'mx-8 w-full max-w-sm rounded-2xl p-6')}>
            <p className="text-slate-800 text-center mb-2 font-medium">{t('growth_habit_todo_prompt')}</p>
            <p className="text-slate-500 text-sm text-center mb-4">
              {t('growth_habit_todo_confirm', { name: habitPromptBottle.name })}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setHabitPromptBottle(null)}
                className={cn(APP_MODAL_SECONDARY_BUTTON_CLASS, 'flex-1 py-2')}>
                {t('growth_habit_todo_dismiss')}
              </button>
              <button
                onClick={handleHabitConfirm}
                className="flex-1 rounded-2xl py-2 font-medium transition-opacity"
                style={{
                  ...APP_GREEN_GLASS_BUTTON_STYLE,
                  color: '#426D56',
                }}
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottleDetailSheet
        bottle={selectedBottle}
        stats={selectedBottleStats}
        onClose={() => setSelectedBottle(null)}
        onCreateTodo={handleCreateTodo}
        onDelete={handleDeleteBottle}
        onIrrigate={handleIrrigate}
        onContinue={handleContinueGoal}
      />

      {/* Todo form modal */}
      <AddGrowthTodoModal
        isOpen={showTodoModal}
        onClose={() => { setShowTodoModal(false); setTodoDefaultBottle(undefined); }}
        onAdd={addTodo}
        defaultValues={todoDefaultBottle}
      />
    </section>
  );
};
