// DOC-DEPS: LLM.md -> docs/MAGIC_PEN_CAPTURE_SPEC.md -> api/README.md -> src/api/README.md

interface MagicPenQualitySegment {
  text: string;
  sourceText: string;
}

interface MagicPenQualityResult {
  segments: MagicPenQualitySegment[];
  unparsed: string[];
}

export type MagicPenQualityFailure =
  | 'empty_result'
  | 'no_recognized_segments'
  | 'low_total_coverage'
  | 'low_recognized_coverage'
  | 'missing_time_anchor'
  | 'undersplit_complex_input';

export interface MagicPenQualityAssessment {
  ok: boolean;
  failure?: MagicPenQualityFailure;
  totalCoverage: number;
  recognizedCoverage: number;
}

const MIN_COVERAGE_INPUT_LENGTH = 12;
const MIN_TOTAL_COVERAGE = 0.8;
const MIN_RECOGNIZED_COVERAGE = 0.55;

function normalizeForMatch(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function calculateCoverage(rawText: string, pieces: string[]): number {
  const normalizedRaw = normalizeForMatch(rawText);
  if (!normalizedRaw) return 1;

  const covered = new Array<boolean>(normalizedRaw.length).fill(false);
  for (const rawPiece of pieces) {
    const piece = normalizeForMatch(rawPiece);
    if (!piece) continue;

    let bestStart = -1;
    let bestGain = 0;
    let searchFrom = 0;
    while (searchFrom < normalizedRaw.length) {
      const start = normalizedRaw.indexOf(piece, searchFrom);
      if (start < 0) break;
      let gain = 0;
      for (let index = start; index < start + piece.length; index += 1) {
        if (!covered[index]) gain += 1;
      }
      if (gain > bestGain) {
        bestStart = start;
        bestGain = gain;
      }
      searchFrom = start + 1;
    }

    if (bestStart < 0) continue;
    for (let index = bestStart; index < bestStart + piece.length; index += 1) {
      covered[index] = true;
    }
  }

  return covered.filter(Boolean).length / normalizedRaw.length;
}

function extractTimeAnchors(rawText: string): string[] {
  const patterns = [
    /\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g,
    /(?:[零一二两三四五六七八九十百\d]{1,4})点(?:半|一刻|三刻|[零一二三四五六七八九十\d]{1,2}分?)?/g,
    /\b(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?)\b/gi,
    /\bat\s+(?:[01]?\d|2[0-3])(?::[0-5]\d)?\b/gi,
  ];
  const anchors = patterns.flatMap((pattern) => rawText.match(pattern) ?? []);
  return Array.from(new Set(anchors.map(normalizeForMatch).filter(Boolean)));
}

function countMeaningfulClauses(rawText: string): number {
  return rawText
    .split(
      /[\n，,。.!?！？；;]+|(?:然后|接着|后来|但是|不过|同时|随即|之后又)|\b(?:and then|then|after that|but|while|afterwards)\b/iu,
    )
    .map(normalizeForMatch)
    .filter((part) => part.length >= 2)
    .length;
}

function failed(
  failure: MagicPenQualityFailure,
  totalCoverage: number,
  recognizedCoverage: number,
): MagicPenQualityAssessment {
  return { ok: false, failure, totalCoverage, recognizedCoverage };
}

function findCoverageFailure(
  rawText: string,
  totalCoverage: number,
  recognizedCoverage: number,
): MagicPenQualityFailure | undefined {
  if (normalizeForMatch(rawText).length < MIN_COVERAGE_INPUT_LENGTH) return undefined;
  if (totalCoverage < MIN_TOTAL_COVERAGE) return 'low_total_coverage';
  if (recognizedCoverage < MIN_RECOGNIZED_COVERAGE) return 'low_recognized_coverage';
  return undefined;
}

function findStructureFailure(
  rawText: string,
  result: MagicPenQualityResult,
  recognizedPieces: string[],
): MagicPenQualityFailure | undefined {
  if (result.segments.length === 0 && result.unparsed.length === 0) return 'empty_result';
  if (result.segments.length === 0) return 'no_recognized_segments';

  const recognizedText = normalizeForMatch(recognizedPieces.join(' '));
  const hasMissingTimeAnchor = extractTimeAnchors(rawText)
    .some((anchor) => !recognizedText.includes(anchor));
  if (hasMissingTimeAnchor) return 'missing_time_anchor';
  if (countMeaningfulClauses(rawText) >= 3 && result.segments.length < 2) {
    return 'undersplit_complex_input';
  }
  return undefined;
}

export function assessMagicPenResult(
  rawText: string,
  result: MagicPenQualityResult,
): MagicPenQualityAssessment {
  const recognizedPieces = result.segments.map((segment) => segment.sourceText || segment.text);
  const allPieces = [...recognizedPieces, ...result.unparsed];
  const totalCoverage = calculateCoverage(rawText, allPieces);
  const recognizedCoverage = calculateCoverage(rawText, recognizedPieces);

  const structureFailure = findStructureFailure(rawText, result, recognizedPieces);
  if (structureFailure) return failed(structureFailure, totalCoverage, recognizedCoverage);
  const coverageFailure = findCoverageFailure(rawText, totalCoverage, recognizedCoverage);
  if (coverageFailure) return failed(coverageFailure, totalCoverage, recognizedCoverage);

  return { ok: true, totalCoverage, recognizedCoverage };
}
