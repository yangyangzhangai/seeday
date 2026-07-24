// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import type { Report } from '../../store/useReportStore';

export function getReportCompanionName(mode: string): string {
  if (mode === 'agnes') return 'Agnes';
  if (mode === 'zep') return 'Zep';
  if (mode === 'momo') return 'Momo';
  return 'Van';
}

export function resolveReportObservationText({
  report,
  isPlus,
  loadingText,
  fallbackText,
}: {
  report: Report | null | undefined;
  isPlus: boolean;
  loadingText: string;
  fallbackText: string;
}): string {
  if (!report) return fallbackText;
  if (report.analysisStatus === 'generating') return loadingText;
  const fullText = report.aiAnalysis?.trim();
  const teaserText = report.teaserText?.trim();
  if (isPlus) return fullText || teaserText || fallbackText;
  if (teaserText) return teaserText;
  return report.analysisStatus === 'error' ? fallbackText : loadingText;
}
