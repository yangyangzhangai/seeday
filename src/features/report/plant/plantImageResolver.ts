// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md

// =============================================================
// 植物图片命名规则 Plant Asset Naming Convention
// =============================================================
//
// 格式 Format:
//   {rootType}_{plantStage}_{序号}_{variant}.{suffix}
//
// 字段说明 Fields:
//   rootType   → 根系类型（由用户行为数据自动计算）
//                tap | fib | sha | bra | bul
//
//   plantStage → 植物生长阶段（只有两档）
//                early（早期）| late（晚期）
//
//   序号       → 同一 rootType + stage 下的多张图编号（三位数）
//                001, 002, 003 ...
//
//   variant    → 第四维度：外观/风格变体【可选字段】
//                base | glow | dry | … 由设计师定义
//                如无 variant，可省略此字段
//
// 示例 Examples:
//   fib_early_001_base.webp   → fib根系, 早期, 第1张, base风格
//   fib_late_002_glow.webp    → fib根系, 晚期, 第2张, glow风格
//   sha_early_001.webp        → sha根系, 早期, 第1张, 无variant
//
// Fallback 降级链（图片不存在时按顺序降级查找）:
//   Level 1: 精确匹配   {plantId}.{suffix}
//   Level 2: 同类同阶   {rootType}_{plantStage}_001.{suffix}
//   Level 3: 全局兜底   sha_early_001.{suffix}  ← ⚠️ 必须保证此图存在！
//
// 每一 Level 内依次尝试以下后缀：webp → png → jpg → jpeg → webp.png → webp.jpg
//
// 素材登记表（有新素材时先在此登记，再放图到 public/assets/plants/）:
//   docs/plant_assets_registry.csv
// =============================================================

import type { PlantStage, RootType } from '../../../types/plant';

const IMAGE_SUFFIXES = ['webp', 'png', 'jpg', 'jpeg', 'webp.png', 'webp.jpg'];
export const PLANT_ASSET_SUFFIX_COUNT = IMAGE_SUFFIXES.length;

function normalizePlantId(plantId: string): string {
  return plantId.trim().toLowerCase();
}

function buildPlantIdFallbackChain(plantId: string, rootType: RootType, plantStage: PlantStage): string[] {
  const normalizedId = normalizePlantId(plantId);
  const sameTypeAndStage = `${rootType}_${plantStage}_001`; // Level 2: 同类型同阶段第1张
  const globalFallback = 'sha_early_001';                   // Level 3: 全局兜底
  return Array.from(new Set([normalizedId, sameTypeAndStage, globalFallback]));
}

export function buildPlantAssetCandidates(plantId: string, rootType: RootType, plantStage: PlantStage): string[] {
  const ids = buildPlantIdFallbackChain(plantId, rootType, plantStage);
  const urls: string[] = [];
  ids.forEach((id) => {
    IMAGE_SUFFIXES.forEach((suffix) => {
      urls.push(`/assets/plants/${id}.${suffix}`);
    });
  });
  return urls;
}

export function resolvePlantFallbackLevelFromCandidateIndex(index: number): 1 | 2 | 3 | 4 {
  if (!Number.isFinite(index) || index < 0) {
    return 4;
  }
  const level = Math.floor(index / PLANT_ASSET_SUFFIX_COUNT) + 1;
  if (level <= 1) return 1;
  if (level === 2) return 2;
  if (level === 3) return 3;
  return 4; // Level 4 = 全部降级失败，图片完全缺失
}

