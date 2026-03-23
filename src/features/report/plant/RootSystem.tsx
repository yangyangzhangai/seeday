// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import React, { memo, useId, useMemo } from 'react';
import type { RootPathRenderItem } from '../../../lib/rootRenderer';
import { RootSegmentPath } from './RootSegmentPath';

interface RootSystemProps {
  items: RootPathRenderItem[];
  selectedRootId: string | null;
  onSelectRoot: (id: string) => void;
}

const RootSystemImpl: React.FC<RootSystemProps> = ({ items, selectedRootId, onSelectRoot }) => {
  const id = useId().replace(/:/g, '_');
  const noiseId = `${id}_root_noise`;
  const soilMaskId = `${id}_soil_mask`;

  const sortedItems = useMemo(() => {
    const selectedItems = items.filter(item => item.segment.id === selectedRootId);
    const sideRoots = items.filter(item => item.segment.id !== selectedRootId && !item.segment.isMainRoot);
    const mainRoots = items.filter(item => item.segment.id !== selectedRootId && item.segment.isMainRoot);
    return [...mainRoots, ...sideRoots, ...selectedItems];
  }, [items, selectedRootId]);

  return (
    <svg viewBox="0 0 360 520" className="w-full h-full">
      <defs>
        <filter id={noiseId} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="1" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <mask id={soilMaskId}>
          <linearGradient id={`${soilMaskId}_fade`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="black" stopOpacity="0" />
            <stop offset="18%" stopColor="black" stopOpacity="0" />
            <stop offset="22%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="1" />
          </linearGradient>
          <rect x="0" y="0" width="360" height="520" fill={`url(#${soilMaskId}_fade)`} />
        </mask>
      </defs>


      <g filter={`url(#${noiseId})`} mask={`url(#${soilMaskId})`}>
        {sortedItems.map(item => (
          <RootSegmentPath
            key={item.segment.id}
            item={item}
            selected={selectedRootId === item.segment.id}
            onSelect={onSelectRoot}
          />
        ))}
      </g>
    </svg>
  );
};

export const RootSystem = memo(RootSystemImpl);
