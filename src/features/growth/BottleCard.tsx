import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Bottle } from '../../store/useGrowthStore';
import { cn } from '../../lib/utils';

interface Props {
  bottle: Bottle;
  onIrrigate: (id: string) => void;
  onContinue: (id: string) => void;
  onAchieve: (id: string) => void;
}

export const BottleCard = ({ bottle, onIrrigate, onContinue, onAchieve }: Props) => {
  const { t } = useTranslation();
  const [showPopup, setShowPopup] = useState(false);
  const [irrigating, setIrrigating] = useState(false);

  const starPercentage = (bottle.stars / 21) * 100;
  const isAchieved = bottle.status === 'achieved';

  const handleClick = () => {
    if (isAchieved) setShowPopup(true);
  };

  const handleIrrigate = () => {
    setIrrigating(true);
    setTimeout(() => {
      onIrrigate(bottle.id);
    }, 800);
  };

  const handleGoalConfirm = (achieved: boolean) => {
    setShowPopup(false);
    if (achieved) {
      onAchieve(bottle.id);
      // After achieving, user can click again to irrigate
    } else {
      onContinue(bottle.id);
    }
  };

  return (
    <div className="relative flex-shrink-0 w-28">
      <div
        onClick={handleClick}
        className={cn(
          "flex flex-col items-center p-3 rounded-2xl border-2 transition-all cursor-pointer",
          isAchieved
            ? "border-yellow-400 bg-yellow-50 shadow-md"
            : "border-gray-200 bg-white",
          irrigating && "animate-pulse opacity-0 scale-110 transition-all duration-700"
        )}
      >
        {/* Bottle visual */}
        <div className="relative w-14 h-20 mb-2">
          {/* Bottle outline */}
          <div className="absolute inset-0 rounded-b-xl rounded-t-lg border-2 border-blue-200 overflow-hidden">
            {/* Fill level */}
            <div
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-400 to-blue-300 transition-all duration-500"
              style={{ height: `${starPercentage}%` }}
            />
            {/* Stars dots */}
            <div className="absolute inset-0 flex flex-wrap content-end justify-center gap-0.5 p-1">
              {Array.from({ length: bottle.stars }).map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-yellow-300 opacity-80" />
              ))}
            </div>
          </div>
          {/* Bottle cap */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-blue-300 rounded-t-md" />
          {/* Glow effect for achieved */}
          {isAchieved && (
            <div className="absolute inset-0 rounded-b-xl rounded-t-lg bg-yellow-300/20 animate-pulse" />
          )}
        </div>

        {/* Name */}
        <p className="text-xs font-medium text-gray-700 text-center truncate w-full">
          {bottle.name}
        </p>

        {/* Stars count */}
        <p className="text-[10px] text-gray-400 mt-0.5">
          {t('growth_bottle_stars', { stars: bottle.stars })}
        </p>

        {/* Round badge for goal bottles */}
        {bottle.type === 'goal' && bottle.round > 1 && (
          <span className="text-[10px] text-blue-500 mt-0.5">
            {t('growth_bottle_round', { round: bottle.round })}
          </span>
        )}

        {/* Achieved badge */}
        {isAchieved && (
          <span className="mt-1 px-2 py-0.5 bg-yellow-400 text-white text-[10px] rounded-full font-medium">
            {t('growth_bottle_achieved')}
          </span>
        )}
      </div>

      {/* Popup for achieved bottles */}
      {showPopup && isAchieved && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-20 bg-white rounded-xl shadow-lg border border-gray-200 p-3 min-w-[180px]">
          {bottle.type === 'habit' ? (
            <>
              <p className="text-xs text-gray-600 mb-2">{t('growth_bottle_irrigate_hint')}</p>
              <button
                onClick={handleIrrigate}
                className="w-full bg-green-500 text-white text-sm py-1.5 rounded-lg hover:bg-green-600"
              >
                {t('growth_bottle_irrigate')}
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-600 mb-2">{t('growth_bottle_goal_confirm')}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { handleGoalConfirm(true); setTimeout(handleIrrigate, 100); }}
                  className="flex-1 bg-green-500 text-white text-sm py-1.5 rounded-lg hover:bg-green-600"
                >
                  {t('growth_bottle_goal_yes')}
                </button>
                <button
                  onClick={() => handleGoalConfirm(false)}
                  className="flex-1 bg-gray-200 text-gray-700 text-sm py-1.5 rounded-lg hover:bg-gray-300"
                >
                  {t('growth_bottle_goal_no')}
                </button>
              </div>
            </>
          )}
          <button
            onClick={() => setShowPopup(false)}
            className="absolute top-1 right-2 text-gray-400 text-xs"
          >
            x
          </button>
        </div>
      )}
    </div>
  );
};
