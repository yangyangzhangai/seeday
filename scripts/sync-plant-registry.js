#!/usr/bin/env node
/**
 * sync-plant-registry.js
 *
 * 从 docs/plant_assets_registry.csv 自动生成 src/lib/plantRegistry.ts
 *
 * 使用方式：
 *   node scripts/sync-plant-registry.js
 *   或 npm run sync:plants
 *
 * 美工工作流：
 *   1. 在 docs/plant_assets_registry.csv 里追加新植物行
 *   2. 运行本脚本，plantRegistry.ts 自动更新
 *   3. 提交 CSV + 生成的 .ts 文件
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CSV_PATH = path.join(ROOT, 'docs', 'plant_assets_registry.csv');
const OUT_PATH = path.join(ROOT, 'src', 'lib', 'plantRegistry.ts');

// ── CSV 解析 ──────────────────────────────────────────────────────────────────

function stripBom(text) {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

function parseCSVLine(line) {
  const cols = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        // Escaped quote (RFC 4180): ""
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }

    if (ch === ',') {
      cols.push(cur);
      cur = '';
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    cur += ch;
  }

  cols.push(cur);
  return cols;
}

function parseCSV(text) {
  const normalized = stripBom(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]).map(c => c.trim());
    if (!cols[0]) continue; // 跳过 plantId 为空的行

    const row = {};
    headers.forEach((h, idx) => { row[h] = cols[idx] ?? ''; });
    rows.push(row);
  }
  return rows;
}

function toTsSingleQuotedString(value) {
  const s = String(value ?? '');
  const escaped = s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
  return `'${escaped}'`;
}

// ── 生成 TypeScript ───────────────────────────────────────────────────────────

function generateTS(rows) {
  // 按 rootType 分组
  const byRoot = {};
  const ROOT_TYPES = ['tap', 'fib', 'sha', 'bra', 'bul'];
  ROOT_TYPES.forEach(rt => { byRoot[rt] = []; });

  for (const row of rows) {
    const rt = row['rootType'];
    if (!byRoot[rt]) {
      console.warn(`[sync] 未知 rootType "${rt}"，跳过行 ${row['plantId']}`);
      continue;
    }
    byRoot[rt].push({
      id:      row['plantId'],
      nameCN:  row['nameCN']  || '',
      nameEN:  row['nameEN']  || '',
      nameIT:  row['nameIT']  || '',
      stage:   row['plantStage'] || 'early',
      notes:   row['notes']  || '',
    });
  }

  // 构建 TS 内容
  const lines = [
    '// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/SEEDAY_植物生长_技术实现文档_v1.7.docx',
    '//',
    '// ⚠️  此文件由脚本自动生成，请勿手动修改',
    '//    修改植物列表请编辑 docs/plant_assets_registry.csv',
    '//    然后运行 npm run sync:plants',
    '//',
    "// 生成时间：" + new Date().toISOString(),
    '',
    "import type { RootType, PlantStage } from '../types/plant.js';",
    '',
    'export interface PlantEntry {',
    '  /** plantId，对应 public/assets/plants/{id}.png */',
    '  id: string;',
    '  nameCN: string;',
    '  nameEN: string;',
    '  nameIT: string;',
    '  stage: PlantStage;',
    '}',
    '',
    '/** 每种根系下的可用植物，由 docs/plant_assets_registry.csv 自动生成 */',
    'export const PLANT_REGISTRY: Record<RootType, PlantEntry[]> = {',
  ];

  ROOT_TYPES.forEach(rt => {
    const entries = byRoot[rt];
    if (entries.length === 0) {
      lines.push(`  ${rt}: [],`);
    } else {
      lines.push(`  ${rt}: [`);
      entries.forEach(e => {
        const note = String(e.notes ?? '').replace(/\s+/g, ' ').trim();
        const noteStr = note ? ` // ${note}` : '';
        lines.push(
          `    { id: ${toTsSingleQuotedString(e.id)}, nameCN: ${toTsSingleQuotedString(e.nameCN)}, nameEN: ${toTsSingleQuotedString(e.nameEN)}, nameIT: ${toTsSingleQuotedString(e.nameIT)}, stage: ${toTsSingleQuotedString(e.stage)} },${noteStr}`,
        );
      });
      lines.push(`  ],`);
    }
  });

  lines.push('};', '');

  lines.push(
    "/** 无素材时的兜底植物 ID */",
    "export const GLOBAL_FALLBACK_PLANT_ID = 'sha_early_0001';",
    '',
    '/** 获取某根系下的植物列表，无素材时降级到 sha */\n' +
    'export function getAvailablePlants(rootType: RootType): PlantEntry[] {\n' +
    '  const list = PLANT_REGISTRY[rootType];\n' +
    '  if (list && list.length > 0) return list;\n' +
    '  const sha = PLANT_REGISTRY.sha;\n' +
    '  return sha.length > 0 ? sha : [{ id: GLOBAL_FALLBACK_PLANT_ID, nameCN: \'\', nameEN: \'\', nameIT: \'\', stage: \'early\' }];\n' +
    '}',
    '',
    '/** 从 plantId 提取 stage */\n' +
    "export function extractStageFromPlantId(plantId: string): PlantStage {\n" +
    "  return plantId.includes('_late_') ? 'late' : 'early';\n" +
    '}',
  );

  return lines.join('\n') + '\n';
}

// ── 主流程 ────────────────────────────────────────────────────────────────────

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`[sync] CSV 文件不存在：${CSV_PATH}`);
    process.exit(1);
  }

  const csv = fs.readFileSync(CSV_PATH, 'utf-8');
  const rows = parseCSV(csv);

  if (rows.length === 0) {
    console.error('[sync] CSV 解析结果为空，检查格式是否正确');
    process.exit(1);
  }

  const ts = generateTS(rows);
  fs.writeFileSync(OUT_PATH, ts, 'utf-8');

  console.log(`[sync] ✓ 已生成 src/lib/plantRegistry.ts`);
  console.log(`[sync] 共处理 ${rows.length} 条植物记录`);

  // 按根系打印摘要
  const summary = {};
  rows.forEach(r => {
    summary[r.rootType] = (summary[r.rootType] || 0) + 1;
  });
  Object.entries(summary).forEach(([rt, count]) => {
    console.log(`        ${rt}: ${count} 个植物`);
  });
}

main();
