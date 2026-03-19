// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import React, { memo, useEffect, useRef } from 'react';
import type { RootPathRenderItem } from '../../../lib/rootRenderer';
import { createLongPressController, resolveRootHitStrokeWidth } from './rootInteractionHelpers';

interface RootSegmentPathProps {
  item: RootPathRenderItem;
  selected: boolean;
  onSelect: (id: string) => void;
}

const RootSegmentPathImpl: React.FC<RootSegmentPathProps> = ({ item, selected, onSelect }) => {
  const controllerRef = useRef(createLongPressController(() => onSelect(item.segment.id)));

  useEffect(() => () => {
    controllerRef.current.cancel();
  }, []);

  useEffect(() => {
    controllerRef.current = createLongPressController(() => onSelect(item.segment.id));
  }, [item.segment.id, onSelect]);

  const clearTimer = () => {
    controllerRef.current.cancel();
  };

  const handlePointerDown: React.PointerEventHandler<SVGPathElement> = () => {
    controllerRef.current.start();
  };

  const isActive = selected;
  const isMainRoot = item.segment.isMainRoot;
  const hitStrokeWidth = resolveRootHitStrokeWidth(item.strokeWidth);
  const mainStroke = isActive
    ? 'rgba(126, 97, 69, 0.98)'
    : isMainRoot
      ? 'rgba(114, 92, 73, 0.86)'
      : 'rgba(124, 102, 84, 0.8)';
  const shadowStroke = isActive
    ? 'rgba(141, 104, 76, 0.34)'
    : isMainRoot
      ? 'rgba(116, 98, 84, 0.18)'
      : 'rgba(116, 98, 84, 0.15)';

  return (
    <g>
      <path
        d={item.path}
        stroke="rgba(0,0,0,0)"
        strokeWidth={hitStrokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className="cursor-pointer"
        onClick={() => onSelect(item.segment.id)}
        onPointerDown={handlePointerDown}
        onPointerUp={clearTimer}
        onPointerCancel={clearTimer}
        onPointerLeave={clearTimer}
      />
      <path
        d={item.path}
        stroke={shadowStroke}
        strokeWidth={item.strokeWidth + 1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        pointerEvents="none"
      />
      <path
        d={item.path}
        stroke={mainStroke}
        strokeWidth={item.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className="cursor-pointer transition-all duration-150"
        pointerEvents="none"
      />
    </g>
  );
};

export const RootSegmentPath = memo(RootSegmentPathImpl);
