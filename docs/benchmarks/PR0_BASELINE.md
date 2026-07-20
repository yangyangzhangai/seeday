# PR0 Baseline (Multilingual Classification)

Last updated: 2026-07-20

## Commands

- `npm run eval:classification:pr0`
- `npm run eval:classification:pr0:artifact`

Artifact output path:

- `docs/benchmarks/pr0-baseline.latest.json`

## Baseline Snapshot

- live-input kind accuracy: `26/26 = 100.00%`
- live-input internal accuracy: `26/26 = 100.00%`
- activity-category accuracy: `18/18 = 100.00%`
- todo-category accuracy: `18/18 = 100.00%`
- magic-pen local fallback accuracy: `6/6 = 100.00%`

## Highlighted Gaps

- The 26-case live-input fixture now includes grammar activity, bare noun, mental-state, contracted future, and contracted negation buckets with no mismatches.
- This is a small deterministic regression fixture, not proof that production accuracy has reached the 80% target.
- Production validation still requires 300-500 reviewed samples per language and confusion-matrix reporting.

## Purpose

This file freezes PR0 baseline numbers so PR1a-PR4 can compare against one stable fixture set and one rerunnable command.
