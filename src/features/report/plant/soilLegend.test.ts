// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import { describe, expect, it } from 'vitest';
import { buildSoilLegendItems } from './soilLegend';

describe('buildSoilLegendItems', () => {
  it('maps legend slots from directionOrder in fixed spatial order', () => {
    const items = buildSoilLegendItems(['life', 'entertainment', 'social', 'work_study', 'exercise']);

    expect(items).toEqual([
      { slotKey: 'top', positionKey: 'plant_direction_top', category: 'social' },
      { slotKey: 'rightTop', positionKey: 'plant_direction_right_top', category: 'work_study' },
      { slotKey: 'rightBottom', positionKey: 'plant_direction_right_bottom', category: 'exercise' },
      { slotKey: 'leftBottom', positionKey: 'plant_direction_left_bottom', category: 'life' },
      { slotKey: 'leftTop', positionKey: 'plant_direction_left_top', category: 'entertainment' },
    ]);
  });

  it('falls back to defaults if directionOrder is incomplete', () => {
    const items = buildSoilLegendItems(['social']);
    expect(items).toEqual([
      { slotKey: 'top', positionKey: 'plant_direction_top', category: 'work_study' },
      { slotKey: 'rightTop', positionKey: 'plant_direction_right_top', category: 'exercise' },
      { slotKey: 'rightBottom', positionKey: 'plant_direction_right_bottom', category: 'social' },
      { slotKey: 'leftBottom', positionKey: 'plant_direction_left_bottom', category: 'social' },
      { slotKey: 'leftTop', positionKey: 'plant_direction_left_top', category: 'life' },
    ]);
  });
});
