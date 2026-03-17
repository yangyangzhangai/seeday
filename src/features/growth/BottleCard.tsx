import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { type Bottle } from '../../store/useGrowthStore';
import { cn } from '../../lib/utils';

interface Props {
  bottle: Bottle;
  onTodoPrompt: (bottle: Bottle) => void;   // click (desktop) / long-press (mobile)
  onAchievedClick: (bottle: Bottle) => void; // click when achieved
  onDelete?: (id: string) => void;
}

export const BottleCard = ({ bottle, onTodoPrompt, onAchievedClick, onDelete }: Props) => {
  const { t } = useTranslation();
  const [irrigating, setIrrigating] = useState(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchMovedRef = useRef(false);

  const starPercentage = (bottle.stars / 21) * 100;
  const isAchieved = bottle.status === 'achieved';

  const handleClick = () => {
    if (isAchieved) {
      onAchievedClick(bottle);
    } else {
      onTodoPrompt(bottle);
    }
  };

  const handleTouchStart = () => {
    touchMovedRef.current = false;
    longPressRef.current = setTimeout(() => {
      if (!touchMovedRef.current) {
        onTodoPrompt(bottle);
      }
    }, 600);
  };

  const handleTouchMove = () => {
    touchMovedRef.current = true;
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  // Irrigate animation (triggered by parent via a separate mechanism if needed)
  const triggerIrrigate = () => {
    setIrrigating(true);
  };
  void triggerIrrigate; // unused but kept for future use

  return (
    <div className="group relative flex-shrink-0 w-28">
      {/* Delete button — appears on hover */}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(bottle.id); }}
          className="absolute -top-1.5 -right-1.5 z-10 w-5 h-5 bg-gray-400 hover:bg-red-500 text-white rounded-full items-center justify-center transition-colors hidden group-hover:flex"
          title={t('delete')}
        >
          <X size={10} />
        </button>
      )}

      <div
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className={cn(
          "flex flex-col items-center p-3 rounded-2xl border-2 transition-all cursor-pointer select-none",
          isAchieved
            ? "border-yellow-400 bg-yellow-50 shadow-md"
            : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm",
          irrigating && "animate-pulse opacity-0 scale-110 transition-all duration-700"
        )}
      >
        {/* Bottle visual */}
        <div className="relative w-14 h-20 mb-2">
          <div className="absolute inset-0 rounded-b-xl rounded-t-lg border-2 border-blue-200 overflow-hidden">
            <div
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-400 to-blue-300 transition-all duration-500"
              style={{ height: `${starPercentage}%` }}
            />
            <div className="absolute inset-0 flex flex-wrap content-end justify-center gap-0.5 p-1">
              {Array.from({ length: bottle.stars }).map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-yellow-300 opacity-80" />
              ))}
            </div>
          </div>
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-blue-300 rounded-t-md" />
          {isAchieved && (
            <div className="absolute inset-0 rounded-b-xl rounded-t-lg bg-yellow-300/20 animate-pulse" />
          )}
        </div>

        <p className="text-xs font-medium text-gray-700 text-center truncate w-full">
          {bottle.name}
        </p>
        <p className="text-[10px] text-gray-400 mt-0.5">
          {t('growth_bottle_stars', { stars: bottle.stars })}
        </p>
        {bottle.type === 'goal' && bottle.round > 1 && (
          <span className="text-[10px] text-blue-500 mt-0.5">
            {t('growth_bottle_round', { round: bottle.round })}
          </span>
        )}
        {isAchieved && (
          <span className="mt-1 px-2 py-0.5 bg-yellow-400 text-white text-[10px] rounded-full font-medium">
            {t('growth_bottle_achieved')}
          </span>
        )}
      </div>
    </div>
  );
};
