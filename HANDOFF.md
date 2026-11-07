# Handoff — current state, decisions, known limits

Written 2026-11-08. Everything below was checked against the code in this repository, not
from memory. Where a number appears, it is a number you can re-derive from the source.

## 1. What exists today

| Page | File | State |
| --- | --- | --- |
| Landing | `index.html` | Stable; language switch wipes with a translated clone layer |
| Hub | `app.html` | Stable; five-column drill table, 11 items, `?lang=en|zh` |
| Program | `program.html` | Stable; four-week plan, log driven by `cs2at.log` |
| Method | `methodology.html` | Nine sections; numbers mirror `docs/methodology.md` |
| Trainer | `tools/aim-trainer.html` | 11 modes incl. Axis-staged (A0–A4 fade) |
| Click-bias checker | `tools/sensitivity-calibrator-strict.html` | All samples, no drift controls |
| First-move coverage | `tools/openloop-calibrator.html` | `?selftest=1` injects known gains |
| Tracking test | `tools/tracking-calibrator.html` | Sine tracking + 43 s step-follow probe |
| English entries | `en/*.html` | Redirect stubs → `<main page>?lang=en` |

Deployment: GitHub Pages from `main`. There is no backend, no account, and no leaderboard.
All measurements live in `localStorage` on the visitor's machine.

## 2. Decisions made this round, and why

### 2.1 English mirrors became redirect stubs

`en/*.html` used to be full copies of the Chinese pages. They drifted: the English sensitivity
page was still running the old miss-only estimator while the Chinese page had moved to all
samples. Two copies of one algorithm will always drift.

Now every `en/*.html` is a ~700-byte stub that redirects to the real page with `?lang=en`, and
the page itself renders English. One code path, two languages. Pages that already had a
language picker needed no other change.

### 2.2 The open-loop page was renamed and its suggestion controls were removed

It was called "open-loop calibration" and printed a suggested cm/360. Three models were tried
(exponential rise, minimum-jerk, first-stop with no model). All three produced different
amplitudes from the same recording, because a truncated trajectory cannot separate amplitude
from duration.

The first-stop version was validated end-to-end by injecting motion with a known gain through
the page's own input path: 0.85 → 84%, 1.00 → 99%, 1.15 → 114%, and the result did not change
when cm/360 was changed from 27.1 to 40.0. That proved the chain, not the interpretation:
what it measures is **how far the first movement travels**, which sits at 71% for a normal
two-phase flick regardless of setting. So the page now reports coverage, and the "suggested
cm/360" and "apply to settings" controls are gone — they were multiplying cm/360 by ~0.7 on every run.

### 2.3 Click-bias checker keeps all samples

Excluding hits from the bias estimate inflates it (true 5% reads as 6–9%, and the inflation
moves with ball size). The page now pools hits and misses and says so on screen.

### 2.4 Flat UI spec, one filled button per screen

`assets/ui-material.css` is the shared spec for the three tool pages: 1 px lines, radius 0,
8 px row rhythm, every element left-aligned to one gutter, and exactly one filled (accent)
button per screen — the primary action. Secondary actions are transparent with a 1 px border.

### 2.5 Theme follows local time unless the user picks one

Light 06:30–18:30, dark otherwise, recomputed on load. Once the user picks a theme by hand,
`cs2at.themeUser=1` is written and auto-switching stops. Without that key the theme is never
persisted, so it cannot get stuck on yesterday's choice.

### 2.6 Axis-staged: two vertical lines, fade A0→A4

The horizontal band is marked by two 1 px vertical lines; crossing into the band turns them
green on the same frame, leaving only vertical correction. The tolerance factors are
`[2.0, 1.6, 1.3, 1.3, 2.0]` for A0–A4; five consecutive good entries promote, a failure or two
consecutive misses demote. A4 removes the lines entirely and returns to plain 2-D aiming.

### 2.7 Step-follow probe on the tracking page

43 s: targets teleport; the interval staircases (three hits in a row → 8% shorter, a miss → 8%
longer), alternating A/B blocks of 10 s each. It gives a **direction** (is the current setting
too fast or too slow), not a magnitude — see limitations.

### 2.8 `en/` defaults to English

Old logic read `navigator.language`, so a Chinese-locale browser opening an English URL got a
fully Chinese page — including the `<title>`. Now only an explicit `?lang=zh` switches to
Chinese; everything else stays English.

### 2.9 Horizon fixed at 0.500H

`assets/arena.js` places the horizon at exactly 0.500 × canvas height. Any other value implies a
constant pitch offset baked into the scene, which would bias every vertical measurement.

## 3. Known limits — read before trusting a number

1. **The step-follow probe gives direction only.** It does not estimate a gain value, and the
   staircase is confounded by adaptation within the 43 s window — a player who is still
   adapting to the setting will look different from one who is settled. It is a nudge, not a
   measurement.
2. **Axis-staged guidance cannot be retired quickly.** A4 only arrives after five consecutive
   good entries, and the tolerance factors were tuned by feel, not fitted to data. Expect the
   fade to take multiple sessions; do not read A0 after one run as a verdict.
3. **The click-bias number mixes habit with gain.** A systematic 3% offset can be a click habit
   or a real setting error; the page cannot tell them apart. That is why applying a suggestion
   is no longer offered.
4. **First-move coverage is not a sensitivity error.** 71% is the normal two-phase structure.
   Compare it to itself over time, never to 100%.
5. **Pointer lock and fullscreen cannot be tested headless.** `unadjustedMovement` needs a real
   gesture; automated runs only prove the fallback path (banner + retry + continue). The raw
   path needs one manual run per browser version.
6. **GitHub Pages lags 1–3.5 minutes** after a push. Verify by polling a file's byte size, not
   by loading the page once.
7. **`git push` to github.com is blocked from this network**; releases go through the GitHub
   Contents API. The local clone can therefore lag the remote — check `raw.githubusercontent.com`
   before assuming a push landed.

## 4. How to verify a change

```bash
node scripts/qa.cjs --root .                    # must print 问题数: 0
node scripts/qa-monkey.cjs --root . --max 10    # must print 异常条目: 0
node scripts/qa-settings.cjs --root .
node scripts/qa-settings-semantics.cjs --root .
node scripts/qa-shots.cjs --root .              # visual review
```

Redirect check (after deploying anything under `en/`): load each stub in a fresh browser
profile, wait ~2 s, then assert the final URL, `document.documentElement.lang === 'en'`, and
that the page is not a 404.

Measurement checks that do not need a human:

| Page | Check | Expected |
| --- | --- | --- |
| `openloop-calibrator.html?selftest=1` | injects gains 0.85 / 1.00 / 1.15 | panel shows ≈85% / 100% / 115%, all ✓ |
| `sensitivity-calibrator-strict.html` | inject 40 balls with a known +4% offset | bias reads ≈+4.0% |

## 5. Loose files outside the repository

The working copy on the author's machine contains files that are **not** in the repository and
were left alone deliberately. None of them is linked from any page:

| File | Size | Note |
| --- | --- | --- |
| `app.backup.html` | 65,491 B | Pre-flat-UI copy of the hub |
| `index.backup.html` | 25,993 B | Pre-flat-UI copy of the landing page |
| `_fb.html` | 25,516 B | Early landing-page experiment |
| `logo-*.html` (12 files) | 3–15 KB each | Logo exploration pages |
| `crystal-preview.html` | 6,219 B | Design preview |
| `结果页预览.html` | 2,217 B | Result-screen preview |
| `对话记录.md` | 739,482 B | Raw conversation log |
| `对话记录-公开节选.html` | 9,093 B | Curated public excerpt |
| `qa-regression.md` (repository root) | 11,768 B | Stray duplicate of `docs/qa-regression.md` — the docs/ copy is the one to keep |
| `qa-report.json/.md`, `qa-monkey.json/.md`, `qa-settings*.json/.md` | — | Generated QA output |
| `shots/` | — | Screenshots used during verification |

`ui-contract.md` is also absent from the repository: it was a working spec between the Lead and the
UI teammates. The README no longer lists it. Publish it if the spec should stay public.