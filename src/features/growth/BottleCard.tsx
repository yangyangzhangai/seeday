import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { type Bottle } from '../../store/useGrowthStore';
import { cn } from '../../lib/utils';
import glassBottleImage from '../../assets/growth/glass-bottle.png';
import growthStarImage from '../../assets/growth/growth-star.png';

interface Props {
  bottle: Bottle;
  onSelect: (bottle: Bottle) => void;
}

export const BottleCard = ({ bottle, onSelect }: Props) => {
  const { t } = useTranslation();

  const isAchieved = bottle.status === 'achieved';
  const syncState = bottle.syncState ?? 'synced';

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
    <button
      type="button"
      className="group relative w-20 flex-shrink-0"
      onClick={() => onSelect(bottle)}
      aria-label={t('growth_bottle_open_detail', { name: bottle.name })}
    >
      <div
        className={cn(
          'flex cursor-pointer select-none flex-col items-center transition-all',
          'group-active:scale-95'
        )}
      >
        {/* Bottle visual */}
        <div className="relative mb-1.5 h-14 w-10">
          {/* Stars scattered inside jar (no liquid layer) */}
          <div className="absolute left-[20%] right-[20%] top-[35%] bottom-[12%] z-[1] overflow-hidden">
            {starLayout.map((star, i) => (
              <img
                key={i}
                src={growthStarImage}
                alt=""
                className="pointer-events-none absolute h-2 w-2 select-none object-contain transition-transform duration-300"
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

          {syncState !== 'synced' && (
            <div
              className={cn(
                'absolute -right-0.5 top-0 z-[4] h-2.5 w-2.5 rounded-full border border-white/90',
                syncState === 'pending' ? 'bg-amber-400 animate-pulse' : 'bg-red-500'
              )}
              title={syncState === 'pending' ? t('growth_bottle_sync_pending') : t('growth_bottle_sync_failed')}
            />
          )}

          <img
            src={glassBottleImage}
            alt="glass bottle"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none z-[2]"
            draggable={false}
          />

          {isAchieved && (
            <div className="absolute inset-0 z-[3] rounded-xl bg-yellow-300/20 animate-pulse" />
          )}
        </div>

        <p className="w-full truncate text-center text-xs font-medium text-gray-700">
          {bottle.name}
        </p>
        <p className="mt-0.5 text-xs text-gray-400">
          {t('growth_bottle_stars', { stars: bottle.stars })}
        </p>
        {bottle.type === 'goal' && bottle.round > 1 && (
          <span className="mt-0.5 text-xs text-blue-500">
            {t('growth_bottle_round', { round: bottle.round })}
          </span>
        )}
        {isAchieved && (
          <span className="mt-1 rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-medium text-white">
            {t('growth_bottle_achieved')}
          </span>
        )}
      </div>
    </button>
  );
};
