import React from 'react';
import { playSound } from '../../services/sound/soundService';

const STAR_ANIMATION_MS = 2200;

export const StarAnimationOverlay: React.FC = () => {
  const [visible, setVisible] = React.useState(false);
  const [runKey, setRunKey] = React.useState(0);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    let timerId: number | undefined;
    let failSafeHideTimerId: number | undefined;
    let sparkleTimerId: number | undefined;

    const handleEarned = () => {
      setRunKey((prev) => prev + 1);
      setLoaded(false);
      setVisible(true);
      if (timerId) window.clearTimeout(timerId);
      if (failSafeHideTimerId) window.clearTimeout(failSafeHideTimerId);
      if (sparkleTimerId) window.clearTimeout(sparkleTimerId);
      sparkleTimerId = window.setTimeout(() => {
        playSound('star');
      }, 180);
      // 防止 iframe 异常未加载时常驻屏幕
      failSafeHideTimerId = window.setTimeout(() => setVisible(false), 7000);
    };

    window.addEventListener('growth-star-earned', handleEarned as EventListener);
    return () => {
      if (timerId) window.clearTimeout(timerId);
      if (failSafeHideTimerId) window.clearTimeout(failSafeHideTimerId);
      if (sparkleTimerId) window.clearTimeout(sparkleTimerId);
      window.removeEventListener('growth-star-earned', handleEarned as EventListener);
    };
  }, []);

  React.useEffect(() => {
    if (!visible || !loaded) return;
    const id = window.setTimeout(() => setVisible(false), STAR_ANIMATION_MS + 120);
    return () => window.clearTimeout(id);
  }, [visible, loaded]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[95]">
      <div className="absolute left-[66%] top-[54%] -translate-x-1/2 -translate-y-1/2">
        <iframe
          key={runKey}
          src="/animations/star-animation.html"
          title="star-animation"
          className="h-[300px] w-[600px] border-0 bg-transparent"
          style={{ maxWidth: '88vw', maxHeight: '42vh' }}
          onLoad={() => setLoaded(true)}
        />
      </div>
    </div>
  );
};

export default StarAnimationOverlay;
