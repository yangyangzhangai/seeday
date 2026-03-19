# Plant P3 WebView Performance Sampling Template

- Purpose: capture comparable FPS and long-task evidence for root interaction acceptance in iOS/Android WebView.
- Scope: `/report` root section daytime interaction only (zoom controls, root tap/long-press detail bubble, dense root rendering).

## 1) Device + Build Context

- Date:
- Tester:
- App build/version:
- Commit hash:
- Environment: `local` / `staging` / `production-like`
- Device model:
- OS version:
- WebView engine version (if available):
- Screen size / refresh rate:

## 2) Test Data Profile

- Segment count in day:
- Dominant direction distribution:
- Max single-activity duration:
- Long-segment count (`>= 90m`):
- Has generated plant today: `yes` / `no`

## 3) Scenarios (run each 3 times)

| Scenario ID | Operation | Duration | Notes |
|---|---|---|---|
| S1 | Initial enter `/report` and first paint of root section | 10s | Observe first-frame smoothness |
| S2 | Repeated zoom-in/out via buttons | 20s | 10 cycles minimum |
| S3 | Tap and long-press root segments in dense area | 20s | Check hit reliability + bubble response |
| S4 | Switch report ranges and return to root section | 20s | Check rerender stability |
| S5 | Idle with realtime extension (>15m ongoing) | 60s | Observe frame consistency |

## 4) Metrics Capture

- Sampling tool: Chrome DevTools remote profiling / Safari Web Inspector / other
- Average FPS:
- P5 FPS:
- P1 FPS:
- Long task count (`> 50ms`):
- Longest task (ms):
- JS heap trend (optional):
- Approximate LCP (if measurable):

## 5) Interaction Quality Checklist

- [ ] Root tap hit-rate is stable in dense area (no obvious missed taps).
- [ ] Long-press consistently triggers root detail.
- [ ] Detail bubble does not clip out of viewport edges.
- [ ] Zoom controls remain responsive after repeated operations.
- [ ] No visible jitter when zoom reaches min/max bounds.
- [ ] Bottom navigation and safe-area do not occlude critical interactions.

## 6) Findings Log

| Time | Symptom | Suspected Cause | Repro Steps | Severity | Owner |
|---|---|---|---|---|---|
|  |  |  |  | low/med/high |  |

## 7) Acceptance Decision

- Gate target: interaction animation stable at `>= 30 FPS` on target devices.
- Result: `pass` / `conditional-pass` / `fail`
- Blocking issues:
- Follow-up actions:
