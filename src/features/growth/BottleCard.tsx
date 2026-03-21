import { useMemo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { type Bottle } from '../../store/useGrowthStore';
import { cn } from '../../lib/utils';
import glassBottleImage from '../../assets/growth/glass-bottle.png';
import growthStarImage from '../../assets/growth/growth-star.png';

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

  const starLayout = useMemo(() => {
    const hash = (input: string) => {
      let h = 2166136261;
      for (let i = 0; i < input.length; i += 1) {
        h ^= input.charCodeAt(i);
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
      }
      return h >>> 0;
    };
    const rand = (seed: number) => {
      let t = seed + 0x6d2b79f5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const columns = 5;
    const columnGap = 80 / (columns - 1);

    const getRowOrder = (row: number) => {
      const arr = Array.from({ length: columns }, (_, idx) => idx);
      let state = hash(`${bottle.id}-row-${row}-order`);
      for (let j = arr.length - 1; j > 0; j -= 1) {
        state = hash(`${state}-${j}`);
        const k = Math.floor(rand(state) * (j + 1));
        [arr[j], arr[k]] = [arr[k], arr[j]];
      }
      return arr;
    };

    return Array.from({ length: bottle.stars }).map((_, i) => {
      const row = Math.floor(i / columns);
      const indexInRow = i % columns;
      const rowOrder = getRowOrder(row);
      const slot = rowOrder[indexInRow];

      const sx = hash(`${bottle.id}-${i}-x`);
      const sy = hash(`${bottle.id}-${i}-y`);
      const sr = hash(`${bottle.id}-${i}-r`);
      const ss = hash(`${bottle.id}-${i}-s`);

      const xBase = 10 + slot * columnGap;
      const x = Math.max(8, Math.min(92, xBase + (rand(sx) * 5 - 2.5)));

      // Stack from bottom to top so stars never appear floating mid-air.
      const yBase = 92 - row * 13;
      const y = Math.max(10, Math.min(94, yBase - rand(sy) * 2.6));

      const rotate = rand(sr) * 80 - 40;
      const scale = 0.82 + rand(ss) * 0.3;

      return { x, y, rotate, scale, z: i + 1 };
    });
  }, [bottle.id, bottle.stars]);

  return (
    <div className="group relative flex-shrink-0 w-32">
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
          'flex flex-col items-center p-3 rounded-2xl border-2 transition-all cursor-pointer select-none',
          isAchieved
            ? 'border-yellow-400 bg-yellow-50 shadow-md'
            : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm',
          irrigating && 'animate-pulse opacity-0 scale-110 transition-all duration-700'
        )}
      >
        {/* Bottle visual */}
        <div className="relative w-20 h-28 mb-2">
          {/* Stars scattered inside jar (no liquid layer) */}
          <div className="absolute left-[20%] right-[20%] top-[35%] bottom-[12%] z-[1] overflow-hidden">
            {starLayout.map((star, i) => (
              <img
                key={i}
                src={growthStarImage}
                alt=""
                className="absolute w-3.5 h-3.5 object-contain pointer-events-none select-none transition-transform duration-300"
                style={{
                  left: `${star.x}%`,
                  top: `${star.y}%`,
                  transform: `translate(-50%, -50%) rotate(${star.rotate}deg) scale(${star.scale})`,
                  zIndex: star.z,
                }}
                draggable={false}
              />
            ))}
          </div>

          <img
            src={glassBottleImage}
            alt="glass bottle"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[2]"
            draggable={false}
          />

          {isAchieved && (
            <div className="absolute inset-0 rounded-2xl bg-yellow-300/20 animate-pulse z-[3]" />
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
