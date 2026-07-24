// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/store/README.md
import { isSameDay } from 'date-fns';
import type { Report } from './useReportStore';

export function hasStoredDiaryText(report: Report | null | undefined): boolean {
  return Boolean(report?.aiAnalysis?.trim() || report?.teaserText?.trim());
}

function hasUsefulStats(report: Report): boolean {
  const stats = report.stats;
  return Boolean(
    stats?.diaryPageSnapshot
    || (stats?.actionAnalysis?.length ?? 0) > 0
    || (stats?.moodDistribution?.length ?? 0) > 0
    || (stats?.totalTodos ?? 0) > 0
  );
}

function snapshotGeneratedAt(report: Report): number | null {
  const value = report.stats?.diaryPageSnapshot?.generatedAt;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function hasDiaryTextConflict(existing: Report, incoming: Report): boolean {
  const aiConflict = Boolean(
    existing.aiAnalysis?.trim()
    && incoming.aiAnalysis?.trim()
    && existing.aiAnalysis.trim() !== incoming.aiAnalysis.trim(),
  );
  const teaserConflict = Boolean(
    existing.teaserText?.trim()
    && incoming.teaserText?.trim()
    && existing.teaserText.trim() !== incoming.teaserText.trim(),
  );
  return aiConflict || teaserConflict;
}

export function mergeSameReportRecord(existing: Report, incoming: Report): Report {
  const preserveSnapshot = Boolean(
    existing.stats?.diaryPageSnapshot
    && !incoming.stats?.diaryPageSnapshot,
  );
  const preserveExistingStats = preserveSnapshot || hasDiaryTextConflict(existing, incoming);
  const aiAnalysis = existing.aiAnalysis?.trim() ? existing.aiAnalysis : incoming.aiAnalysis;
  const teaserText = existing.teaserText?.trim() ? existing.teaserText : incoming.teaserText;
  return {
    ...existing,
    ...incoming,
    aiAnalysis,
    teaserText,
    stats: preserveExistingStats ? existing.stats : incoming.stats ?? existing.stats,
    analysisStatus: aiAnalysis?.trim() || teaserText?.trim() ? 'success' : incoming.analysisStatus,
  };
}

export function choosePreferredReport(left: Report, right: Report): Report {
  if (left.id === right.id) return mergeSameReportRecord(left, right);
  const leftGenerated = hasStoredDiaryText(left);
  const rightGenerated = hasStoredDiaryText(right);
  if (leftGenerated !== rightGenerated) return leftGenerated ? left : right;

  const leftGeneratedAt = snapshotGeneratedAt(left);
  const rightGeneratedAt = snapshotGeneratedAt(right);
  if (leftGeneratedAt !== null && rightGeneratedAt !== null && leftGeneratedAt !== rightGeneratedAt) {
    return leftGeneratedAt < rightGeneratedAt ? left : right;
  }
  const leftUseful = hasUsefulStats(left);
  const rightUseful = hasUsefulStats(right);
  if (leftUseful !== rightUseful) return leftUseful ? left : right;
  return left.id.localeCompare(right.id) <= 0 ? left : right;
}

export function findPreferredReportForWindow(
  reports: Report[],
  type: Report['type'],
  date: number | Date,
): Report | null {
  const matches = reports.filter(
    report => report.type === type && isSameDay(new Date(report.date), new Date(date)),
  );
  return matches.reduce<Report | null>(
    (preferred, report) => preferred ? choosePreferredReport(preferred, report) : report,
    null,
  );
}

export function mergeReportByWindow(reports: Report[], incoming: Report): Report[] {
  const matching = reports.filter(
    report => report.type === incoming.type && isSameDay(new Date(report.date), new Date(incoming.date)),
  );
  const existingPreferred = matching.reduce<Report | null>(
    (current, report) => current ? choosePreferredReport(current, report) : report,
    null,
  );
  const preferred = existingPreferred
    ? choosePreferredReport(existingPreferred, incoming)
    : incoming;
  return [
    ...reports.filter(
      report => !(report.type === incoming.type && isSameDay(new Date(report.date), new Date(incoming.date))),
    ),
    preferred,
  ];
}

export function dedupeReportsByWindow(reports: Report[]): Report[] {
  return reports
    .reduce<Report[]>((deduped, report) => mergeReportByWindow(deduped, report), [])
    .sort((left, right) => right.date - left.date);
}

export function shouldRepairSparseReport(report: Report | null | undefined): boolean {
  if (!report || hasStoredDiaryText(report)) return false;
  const stats = report.stats;
  if (!stats) return true;
  const hasAction = (stats.actionAnalysis?.length ?? 0) > 0;
  const hasMood = (stats.moodDistribution?.length ?? 0) > 0;
  const hasTodo = (stats.totalTodos ?? 0) > 0;
  return !hasAction && !hasMood && !hasTodo;
}
