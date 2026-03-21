# PR0 Baseline (Multilingual Classification)

Last updated: 2026-03-21

## Commands

- `npm run eval:classification:pr0`
- `npm run eval:classification:pr0:artifact`

Artifact output path:

- `docs/benchmarks/pr0-baseline.latest.json`

## Baseline Snapshot

- live-input kind accuracy: `17/18 = 94.44%`
- live-input internal accuracy: `17/18 = 94.44%`
- activity-category accuracy: `17/18 = 94.44%`
- todo-category accuracy: `13/18 = 72.22%`
- magic-pen local fallback accuracy: `6/6 = 100.00%`

## Highlighted Gaps

- EN negation sample (`I am not working now`) is still classified as `new_activity`.
- EN activity category sample (`reviewing probability statistics`) still falls into `work` instead of `study`.
- Todo category still has multilingual misses, especially IT text defaulting to `life` in multiple cases.

## Purpose

This file freezes PR0 baseline numbers so PR1a-PR4 can compare against one stable fixture set and one rerunnable command.
