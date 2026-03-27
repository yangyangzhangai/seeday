// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/TimeShine_植物生长_技术实现文档_v1.7.docx
//
// ⚠️  此文件由脚本自动生成，请勿手动修改
//    修改植物列表请编辑 docs/plant_assets_registry.csv
//    然后运行 npm run sync:plants
//
// 生成时间：2026-03-27T11:36:39.297Z

import type { RootType, PlantStage } from '../types/plant.js';

export interface PlantEntry {
  /** plantId，对应 public/assets/plants/{id}.png */
  id: string;
  nameCN: string;
  nameEN: string;
  nameIT: string;
  stage: PlantStage;
}

/** 每种根系下的可用植物，由 docs/plant_assets_registry.csv 自动生成 */
export const PLANT_REGISTRY: Record<RootType, PlantEntry[]> = {
  tap: [],
  fib: [
    { id: 'fib_early_001', nameCN: '狼尾草', nameEN: 'Fountain Grass', nameIT: 'Penniseto', stage: 'early' }, // 已上线
    { id: 'fib_early_002', nameCN: '麦穗', nameEN: 'Wheat Ear', nameIT: 'Spiga di grano', stage: 'early' }, // 已上线
    { id: 'fib_late_001', nameCN: '狼尾草', nameEN: 'Fountain Grass', nameIT: 'Penniseto', stage: 'late' }, // 已上线
    { id: 'fib_late_002', nameCN: '麦穗', nameEN: 'Wheat Ear', nameIT: 'Spiga di grano', stage: 'late' }, // 已上线
  ],
  sha: [
    { id: 'sha_early_001', nameCN: '', nameEN: '', nameIT: '', stage: 'early' }, // 全局兜底图 最高优先级
  ],
  bra: [],
  bul: [],
};

/** 无素材时的兜底植物 ID */
export const GLOBAL_FALLBACK_PLANT_ID = 'sha_early_001';

/** 获取某根系下的植物列表，无素材时降级到 sha */
export function getAvailablePlants(rootType: RootType): PlantEntry[] {
  const list = PLANT_REGISTRY[rootType];
  if (list && list.length > 0) return list;
  const sha = PLANT_REGISTRY.sha;
  return sha.length > 0 ? sha : [{ id: GLOBAL_FALLBACK_PLANT_ID, nameCN: '', nameEN: '', nameIT: '', stage: 'early' }];
}

/** 从 plantId 提取 stage */
export function extractStageFromPlantId(plantId: string): PlantStage {
  return plantId.includes('_late_') ? 'late' : 'early';
}
