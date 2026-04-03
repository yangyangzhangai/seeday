// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { supabase } from '../../../api/supabase';
import { getSupabaseSession } from '../../../lib/supabase-utils';
import { toLocalDateStr, getYesterdayStr } from '../../../lib/dateUtils';
import { isLegacyChatActivityType } from '../../../lib/activityType';
import { cn } from '../../../lib/utils';
import { APP_MODAL_CARD_CLASS } from '../../../lib/modalTheme';
import type { Message } from '../../../store/useChatStore';
import { mapDbRowToMessage } from '../../../store/chatHelpers';

const STORAGE_KEY = 'yesterday_popup_date';

export const YesterdaySummaryPopup: React.FC = () => {
  const { t } = useTranslation();
  const [event, setEvent] = useState<Message | null>(null);
  const [userInteracted, setUserInteracted] = useState(false);

  useEffect(() => {
    const today = toLocalDateStr(new Date());
    if (localStorage.getItem(STORAGE_KEY) === today) return;

    (async () => {
      const session = await getSupabaseSession();
      if (!session) return;

      const yesterdayStr = getYesterdayStr();
      const dayStart = new Date(yesterdayStr + 'T00:00:00').getTime();
      const dayEnd = new Date(yesterdayStr + 'T23:59:59.999').getTime();

      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_mood', false)
        .gte('timestamp', dayStart)
        .lte('timestamp', dayEnd)
        .order('timestamp', { ascending: false })
        .limit(1);

      const latestRuntimeRow = data?.find((row) => !isLegacyChatActivityType(row.activity_type));
      if (latestRuntimeRow) {
        setEvent(mapDbRowToMessage(latestRuntimeRow));
        // 成功后才写，失败不记录，下次还会弹
        localStorage.setItem(STORAGE_KEY, today);
      }
    })();
  }, []);

  // 5 秒自动关闭（用户点击保持）
  useEffect(() => {
    if (!event || userInteracted) return;
    const timer = setTimeout(() => setEvent(null), 5000);
    return () => clearTimeout(timer);
  }, [event, userInteracted]);

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-auto fixed left-4 right-4 z-10"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 136px)' }}
          onPointerDown={() => setUserInteracted(true)}
        >
          <div className={cn(APP_MODAL_CARD_CLASS, 'rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5')}>
            <div className="text-lg leading-none flex-shrink-0">🌙</div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-slate-500 leading-none mb-1">{t('yesterday_popup')}</p>
              <p className="text-sm text-slate-800 font-medium leading-snug line-clamp-2">{event.content}</p>
              {event.duration != null && (
                <p className="text-[10px] text-slate-400 mt-0.5 leading-none">
                  {Math.round(event.duration)} min
                </p>
              )}
            </div>
            <button
              onClick={() => setEvent(null)}
              className="flex-shrink-0 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100/60 transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
