// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import React from 'react';

interface RootDetailBubbleProps {
  title: string;
  category: string;
  timeRange: string;
  duration: string;
  focus: string;
  activity: string;
  onClose: () => void;
  className?: string;
}

export const RootDetailBubble: React.FC<RootDetailBubbleProps> = ({
  title,
  category,
  timeRange,
  duration,
  focus,
  activity,
  onClose,
  className,
}) => {
  return (
    <div className={className ?? 'rounded-xl border border-amber-200/80 bg-amber-50/95 p-3 shadow-md'}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-amber-900">{title}</p>
          <p className="mt-1 text-xs leading-5 text-amber-800">{activity}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-8 w-8 rounded-md border border-amber-300 bg-white text-amber-700"
          aria-label="Close detail"
        >
          ×
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-amber-900">
        <div className="rounded-lg bg-white/70 p-2">{category}</div>
        <div className="rounded-lg bg-white/70 p-2">{timeRange}</div>
        <div className="rounded-lg bg-white/70 p-2">{duration}</div>
        <div className="rounded-lg bg-white/70 p-2">{focus}</div>
      </div>
    </div>
  );
};
