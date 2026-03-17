import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useGrowthStore, MAX_BOTTLES } from '../../store/useGrowthStore';
import { BottleCard } from './BottleCard';
import { AddBottleModal } from './AddBottleModal';

export const BottleList = () => {
  const { t } = useTranslation();
  const { bottles, addBottle, markBottleIrrigated, continueBottle, markBottleAchieved } = useGrowthStore();
  const [showAdd, setShowAdd] = useState(false);

  const activeBottles = bottles.filter((b) => b.status === 'active' || b.status === 'achieved');
  const isMaxReached = activeBottles.length >= MAX_BOTTLES;

  return (
    <section className="mb-4">
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-base font-bold text-gray-800">{t('growth_bottle_section')}</h2>
        <button
          onClick={() => !isMaxReached && setShowAdd(true)}
          disabled={isMaxReached}
          className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed"
          title={isMaxReached ? t('growth_bottle_max_reached') : t('growth_add_bottle')}
        >
          <Plus size={18} />
        </button>
      </div>

      {isMaxReached && (
        <p className="text-xs text-orange-500 px-4 mb-2">{t('growth_bottle_max_reached')}</p>
      )}

      {activeBottles.length === 0 ? (
        <div className="text-center text-gray-400 py-6 text-sm">{t('no_data')}</div>
      ) : (
        <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
          {activeBottles.map((bottle) => (
            <BottleCard
              key={bottle.id}
              bottle={bottle}
              onIrrigate={markBottleIrrigated}
              onContinue={continueBottle}
              onAchieve={markBottleAchieved}
            />
          ))}
        </div>
      )}

      <AddBottleModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={addBottle}
      />
    </section>
  );
};
