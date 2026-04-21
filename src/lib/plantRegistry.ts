// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/Seeday_植物生长_技术实现文档_v1.7.docx
//
// ⚠️  此文件由脚本自动生成，请勿手动修改
//    修改植物列表请编辑 docs/plant_assets_registry.csv
//    然后运行 npm run sync:plants
//
// 生成时间：2026-03-30T18:49:51.376Z

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
  tap: [
    { id: 'tap_early_0001', nameCN: '虞美人', nameEN: 'Corn Poppy', nameIT: 'Papavero', stage: 'early' }, // live
    { id: 'tap_early_0002', nameCN: '大波斯菊', nameEN: 'Cosmos', nameIT: 'Cosmea', stage: 'early' }, // live
    { id: 'tap_early_0003', nameCN: '紫云英', nameEN: 'Chinese Milk Vetch', nameIT: 'Astragalo cinese', stage: 'early' }, // live
    { id: 'tap_early_0004', nameCN: '薰衣草', nameEN: 'Lavender', nameIT: 'Lavanda', stage: 'early' }, // live
    { id: 'tap_early_0005', nameCN: '飞燕草', nameEN: 'Larkspur', nameIT: 'Speronella', stage: 'early' }, // live
    { id: 'tap_late_0001', nameCN: '虞美人', nameEN: 'Corn Poppy', nameIT: 'Papavero', stage: 'late' }, // live
    { id: 'tap_late_0002', nameCN: '大波斯菊', nameEN: 'Cosmos', nameIT: 'Cosmea', stage: 'late' }, // live
    { id: 'tap_late_0003', nameCN: '紫云英', nameEN: 'Chinese Milk Vetch', nameIT: 'Astragalo cinese', stage: 'late' }, // live
    { id: 'tap_late_0004', nameCN: '薰衣草', nameEN: 'Lavender', nameIT: 'Lavanda', stage: 'late' }, // live
    { id: 'tap_late_0005', nameCN: '飞燕草', nameEN: 'Larkspur', nameIT: 'Speronella', stage: 'late' }, // live
  ],
  fib: [
    { id: 'fib_early_0001', nameCN: '狼尾草', nameEN: 'Fountain Grass', nameIT: 'Penniseto', stage: 'early' }, // live
    { id: 'fib_early_0002', nameCN: '麦穗', nameEN: 'Wheat Ear', nameIT: 'Spiga di grano', stage: 'early' }, // live
    { id: 'fib_early_0003', nameCN: '芒草', nameEN: 'Miscanthus', nameIT: 'Miscanto', stage: 'early' }, // live
    { id: 'fib_early_0004', nameCN: '粉黛乱子草', nameEN: 'Pink Muhly Grass', nameIT: 'Erba muhly rosa', stage: 'early' }, // live
    { id: 'fib_late_0001', nameCN: '狼尾草', nameEN: 'Fountain Grass', nameIT: 'Penniseto', stage: 'late' }, // live
    { id: 'fib_late_0002', nameCN: '麦穗', nameEN: 'Wheat Ear', nameIT: 'Spiga di grano', stage: 'late' }, // live
    { id: 'fib_late_0003', nameCN: '芒草', nameEN: 'Miscanthus', nameIT: 'Miscanto', stage: 'late' }, // live
    { id: 'fib_late_0004', nameCN: '粉黛乱子草', nameEN: 'Pink Muhly Grass', nameIT: 'Erba muhly rosa', stage: 'late' }, // live
  ],
  sha: [
    { id: 'sha_early_0001', nameCN: '绣球花', nameEN: 'Hydrangea', nameIT: 'Ortensia', stage: 'early' }, // global_fallback
    { id: 'sha_early_0003', nameCN: '杜鹃花', nameEN: 'Azalea', nameIT: 'Azalea', stage: 'early' }, // live
    { id: 'sha_early_0004', nameCN: '栀子花', nameEN: 'Gardenia', nameIT: 'Gardenia', stage: 'early' }, // live
    { id: 'sha_early_0005', nameCN: '牡丹', nameEN: 'Peony', nameIT: 'Peonia', stage: 'early' }, // live
    { id: 'sha_late_0001', nameCN: '绣球花', nameEN: 'Hydrangea', nameIT: 'Ortensia', stage: 'late' }, // live
    { id: 'sha_late_0003', nameCN: '杜鹃花', nameEN: 'Azalea', nameIT: 'Azalea', stage: 'late' }, // live
    { id: 'sha_late_0004', nameCN: '栀子花', nameEN: 'Gardenia', nameIT: 'Gardenia', stage: 'late' }, // live
    { id: 'sha_late_0005', nameCN: '牡丹', nameEN: 'Peony', nameIT: 'Peonia', stage: 'late' }, // live
  ],
  bra: [],
  bul: [
    { id: 'bul_early_0001', nameCN: '郁金香', nameEN: 'Tulip', nameIT: 'Tulipano', stage: 'early' }, // live
    { id: 'bul_early_0003', nameCN: '朱顶红', nameEN: 'Amaryllis', nameIT: 'Amarillide', stage: 'early' }, // live
    { id: 'bul_early_0004', nameCN: '仙客来', nameEN: 'Cyclamen', nameIT: 'Ciclamino', stage: 'early' }, // live
    { id: 'bul_early_0005', nameCN: '仙人掌', nameEN: 'Cactus', nameIT: 'Cactus', stage: 'early' }, // live
    { id: 'bul_late_0001', nameCN: '郁金香', nameEN: 'Tulip', nameIT: 'Tulipano', stage: 'late' }, // live
    { id: 'bul_late_0003', nameCN: '朱顶红', nameEN: 'Amaryllis', nameIT: 'Amarillide', stage: 'late' }, // live
    { id: 'bul_late_0004', nameCN: '仙客来', nameEN: 'Cyclamen', nameIT: 'Ciclamino', stage: 'late' }, // live
    { id: 'bul_late_0005', nameCN: '仙人掌', nameEN: 'Cactus', nameIT: 'Cactus', stage: 'late' }, // live
  ],
};

/** 无素材时的兜底植物 ID */
export const GLOBAL_FALLBACK_PLANT_ID = 'sha_early_0001';

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
