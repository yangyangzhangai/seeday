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
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.25 }}
          className="fixed left-4 right-4 z-30 pointer-events-auto"
          style={{ top: 'max(12px, calc(env(safe-area-inset-top, 0px) + 8px))' }}
          onPointerDown={() => setUserInteracted(true)}
        >
          <div
            className={cn(APP_MODAL_CARD_CLASS, 'rounded-2xl px-4 py-3 flex items-start gap-3')}
            style={{
              background:
                'linear-gradient(140deg, rgba(168,85,247,0.38) 0%, rgba(139,92,246,0.30) 45%, rgba(217,70,239,0.24) 100%)',
              border: '1px solid rgba(255,255,255,0.38)',
              backdropFilter: 'blur(18px) saturate(155%)',
              WebkitBackdropFilter: 'blur(18px) saturate(155%)',
              boxShadow: '0 10px 30px rgba(88,28,135,0.26), inset 0 1px 1px rgba(255,255,255,0.35)',
            }}
          >
            <div className="text-2xl mt-0.5">🌙</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-violet-50/95 mb-0.5">{t('yesterday_popup')}</p>
              <p className="text-sm text-white/95 truncate font-medium">{event.content}</p>
              {event.duration != null && (
                <p className="text-[10px] text-violet-100/80 mt-0.5">
                  {Math.round(event.duration)} min
                </p>
              )}
            </div>
            <button
              onClick={() => setEvent(null)}
              className="mt-0.5 rounded-full p-1 text-violet-50/85 transition-colors hover:text-white"
              style={{ background: 'rgba(255,255,255,0.12)' }}
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
