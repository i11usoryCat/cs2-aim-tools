# CS2 Aim Tools

> Browser-based sensitivity calibration and flick training for CS2. No install, no game integration, no data leaves your browser.

[![Live](https://img.shields.io/badge/live-GitHub%20Pages-2ea043?style=flat-square)](https://i11usorycat.github.io/cs2-aim-tools/)
[![License](https://img.shields.io/badge/license-source--available-d29922?style=flat-square)](LICENSE)

---

## Live site

| Page | URL | Description |
| --- | --- | --- |
| **Home** | https://i11usorycat.github.io/cs2-aim-tools/ | Landing page and tool index |
| **Hub** | https://i11usorycat.github.io/cs2-aim-tools/app.html | Stats, plan, drills, settings |
| **Program** | https://i11usorycat.github.io/cs2-aim-tools/program.html | Four-week guided plan |
| **Method** | https://i11usorycat.github.io/cs2-aim-tools/methodology.html | Nine sections: what was tested, what failed, what the numbers mean |

Individual drills:

| Tool | URL |
| --- | --- |
| Click-bias checker | https://i11usorycat.github.io/cs2-aim-tools/tools/sensitivity-calibrator-strict.html |
| First-move coverage | https://i11usorycat.github.io/cs2-aim-tools/tools/openloop-calibrator.html |
| Adaptive random flick | https://i11usorycat.github.io/cs2-aim-tools/tools/aim-trainer.html?mode=random&count=40&limit=1 |
| Blocked repetition | https://i11usorycat.github.io/cs2-aim-tools/tools/aim-trainer.html?mode=block&count=40&limit=0 |
| Micro-precision | https://i11usorycat.github.io/cs2-aim-tools/tools/aim-trainer.html?mode=precision&count=40&limit=0 |

---

## Features

### Two different measurements

| Page | What it measures | Direction |
| --- | --- | --- |
| **Click-bias checker** (`sensitivity-calibrator-strict.html`) | Where your click lands relative to the target, after correction | Closed loop — bias only, near zero for a tuned setting |
| **First-move coverage** (`openloop-calibrator.html`) | How far your first movement travels before the correction starts | Open loop — typically 70–80% for everyone |

Neither derives your "ideal" sensitivity. Sensitivities between 16 and 32 cm/360 produced no
measurable difference in a controlled experiment (see `docs/methodology.md`), so the honest
output of the click-bias page is usually *do not change anything*.

Both pages were validated end-to-end by injecting synthetic motion with a known gain. The
open-loop page can repeat that check in your own browser: append **`?selftest=1`** to its URL
and it will report whether the measurement chain holds (±3% tolerance).

### Quality check (run before every push)

Five scripts, all driven by headless Edge over CDP. Run them from the repository root.

| Script | What it checks | Pass condition |
| --- | --- | --- |
| `scripts/qa.cjs` | Every page: uncaught exceptions, `console.error`, dead internal links, duplicate `id`s, horizontal overflow, untranslated strings after switching to English | `问题数: 0` |
| `scripts/qa-monkey.cjs` | Every visible button, one reload per click: exceptions during the click | `异常条目: 0` |
| `scripts/qa-settings.cjs` | Settings tab walkthrough: fields, derived values, persistence | no assertion failures |
| `scripts/qa-settings-semantics.cjs` | Unit conversions (DPI / m_yaw / cm/360 / sensitivity) against known pairs | no mismatch |
| `scripts/qa-shots.cjs` | Screenshot capture of the main screens for visual review | images written |

```bash
node scripts/qa.cjs --root .
node scripts/qa-monkey.cjs --root . --max 10
node scripts/qa-settings.cjs --root .
node scripts/qa-settings-semantics.cjs --root .
node scripts/qa-shots.cjs --root .
```

`qa.cjs` writes `qa-report.md` / `qa-report.json`; `qa-monkey.cjs` writes `qa-monkey.md`.
A page whose source contains `<meta http-equiv="refresh"` or `location.replace(` is treated as a
redirect stub and skipped by `qa.cjs` — stubs are covered by the redirect check in `docs/qa-regression.md`.

### Sensitivity calibration

The calibrator records where each flick actually lands relative to the target and derives the sensitivity you should be using:

```text
f         = (landing projection - target distance) / target distance
cm/360'   = cm/360 * (1 + median f)
```

- Samples are pooled across runs to suppress single-run noise
- The UI reports convergence when two consecutive rounds differ by less than 1%
- Hits (angular error within the ball radius) are excluded from the bias estimate

### Eleven drills

Four assessment items and seven practice items. Every item is launched from the hub with its own
preset and records its own result.

| Group | Item | Mechanic |
| --- | --- | --- |
| Assessment | **Check-up** | One 90-second run scores six skills: reaction, first shot, confirmation, micro-adjust, flick, stability |
| Assessment | **State check** | 20 balls, no time limit; ball size adapts to your hit rate — a quick "how am I today" |
| Assessment | **Staircase precision** | Ball size staircases to the smallest target you hit at ~85% — a repeatable precision threshold |
| Assessment | **Tracking test** | 90 s of tracking: RMS error, phase lag, velocity gain |
| Practice | **Adaptive random** | Fixed 1.5° ball, only the time limit adapts toward 85% success — the main practice item |
| Practice | **Random distance** | 5–45° random distance and direction; results grouped into four distance bands |
| Practice | **Fixed angle** | The same angle eight times, alternating left/right — warm-up and motor-program building |
| Practice | **Axis-staged** | Two 1 px vertical lines mark the horizontal band; entering it turns them green, leaving only vertical correction. Difficulty fades A0→A4 as you improve |
| Practice | **Precision** | Fixed 0.7° ball, no time limit — landing precision |
| Practice | **Wide flick** | 80–160° turns — the CS peeking scenario |
| Practice | **Micro-adjust** | A target drifting at constant speed; click while following — the VAL / APEX / OW core skill |

### What this is not

- **No leaderboard, ever.** No ranking, no score submission, no account. Progress is a private record you keep against yourself.
- **No uploads.** Everything is measured and stored in your browser's `localStorage`; there is no backend and no network request carries your data.
- **No claim of "your true sensitivity".** The measurement pages report only what they can measure (click bias, first-move coverage) — see [method notes](docs/methodology.md).

### Four-week program

Fifteen minutes a day, five training days and two rest days per week. The program page tracks which day you are on and lists today's tasks.

### Local data

Everything is stored in `localStorage`; nothing is uploaded.

| Key | Contents |
| --- | --- |
| `cs2at.cfg` | DPI, m_yaw, sensitivity, cm/360 |
| `cs2at.best` | Best result per mode |
| `cs2at.runs` | Recent runs (max 300) |
| `cs2at.log` | Program-page training log |
| `cs2at.theme` | UI theme |
| `cs2at.themeUser` | Set to `1` once you pick a theme manually; while absent the theme follows local time (light 06:30–18:30) |
| `cs2at.scene` | Training scene palette |
| `cs2at.fps` | Frame-rate cap |
| `cs2at.perf` | Performance mode |
| `cs2at.axis` | Axis-staged fade level (A0–A4) |

> `file://` and `https://` are separate storage origins. Records made from a local file are not visible on the hosted site and vice versa. Use **Export JSON** on the stats page to move data.

---

## Quick start

1. Open the hub, go to **Settings**, and enter your DPI, m_yaw, and current in-game sensitivity.
2. Run the **Click-bias checker** once and read the bias together with its CI. If the bias is
   inside the noise (±3% with 40 balls), **do not change anything** — that is the normal result,
   and the controlled experiment found no measurable difference between 16 and 32 cm/360.
3. If you do change the sensitivity, move it by ≤10%, then play 10 minutes before judging —
   the first minutes after a change only measure re-adaptation.
4. Open **Plan** and follow today's tasks.
5. After each set, press **Copy set data** in the drill and paste it into the plan page log.

---

## The math

View angle change in Source is:

```text
delta_angle = mouse_counts * sensitivity * m_yaw
```

Therefore:

```text
degrees_per_count = sensitivity * m_yaw
counts_per_360     = 360 / (sensitivity * m_yaw)
cm_per_360         = counts_per_360 / DPI * 2.54
```

Solving for sensitivity:

```js
const sensitivity = 360 / ((cm360 / 2.54) * dpi) / mYaw;
```

Training difficulty follows Fitts' law:

```text
MT = a + b * log2(2D / W)
```

Reducing `W` (ball radius) or increasing `D` (travel distance) raises difficulty. Only one controller runs at a time so the feedback loops do not fight each other.

---

## Project structure

```text
cs2-aim-tools/
├── index.html                              Landing page
├── app.html                                Hub: stats, plan, drills, settings  (?lang=en|zh)
├── program.html                            Four-week guided plan
├── methodology.html                        Nine-section method page (Chinese)
├── tools/
│   ├── sensitivity-calibrator-strict.html  Click-bias checker (all samples; ?fast=1)
│   ├── openloop-calibrator.html            First-move coverage (?selftest=1 self-check)
│   ├── tracking-calibrator.html            Tracking test + step-follow sensitivity probe
│   └── aim-trainer.html                    Trainer: 11 items, mode presets via query
├── en/                                     English entry points — redirect to ../<page>?lang=en
├── assets/
│   ├── scenes.js                           Scene palette
│   ├── arena.js                            3-D scene + projection helpers
│   └── ui-material.css                     Flat UI spec shared by the three tool pages (1 px lines, radius 0)
├── scripts/
│   ├── qa.cjs                              Site-wide QA gate (console / links / ids / overflow / i18n)
│   ├── qa-monkey.cjs                       Interaction monkey test (click every button)
│   ├── qa-settings.cjs                     Settings page walkthrough
│   ├── qa-settings-semantics.cjs           Settings semantics (unit conversions, derived values)
│   └── qa-shots.cjs                        Screenshot capture for visual review
├── windows/
│   ├── RawLogger.cs                        Raw HID input recorder
│   └── README.md
├── docs/
│   ├── methodology.md                      Method notes, three failed models, validation
│   ├── training-plan.md                    Four-week training programme
│   └── qa-regression.md                    Regression checklist and known-fragile areas
├── HANDOFF.md                              Current state, decisions, known limits
└── LICENSE
```

---

## Browser support

- **Chrome / Edge** recommended. They support `pointerrawupdate`, which allows raw-rate sampling.
- Firefox works but samples at a lower rate; the page shows a warning.
- Pointer Lock requires HTTPS or `localhost`.

---

## Raw input recorder

`windows/RawLogger.cs` reads HID reports through `GetRawInputBuffer` to verify real polling rate and report-interval jitter.

```powershell
$csc = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
& $csc /nologo /target:winexe /unsafe /out:RawLogger.exe `
  /reference:System.Windows.Forms.dll /reference:System.Drawing.dll RawLogger.cs
```

> Lesson learned: writing to disk synchronously inside the message callback blocks the message loop, and Windows starts coalescing `WM_INPUT`. Measured rate fell from 4207 Hz to 124 Hz on the same 8K mouse. Buffer in memory and flush at the end.

---

## Case study

Environment: 9800X3D, RX 9070 XT, 400 Hz display, VAXEE NP-01S V3 at 1000 DPI.

| cm/360 | Overshoot | Samples |
| ---: | ---: | ---: |
| 23.2 | +7.4% | 34 |
| 24.9 | +4.8% | 66 |
| 26.1 | +2.9% | 100 |
| 26.9 | +2.9% | 130 |
| 27.7 | +2.3% | 160 |

Two consecutive rounds differed by 0.7%, so the run was marked converged. Final setting: `sensitivity 2.04`, `m_yaw 0.0165`, `27.2 cm/360`; overshoot moved from +7.4% to -0.1%.

---

## Documentation

- [Method notes and pitfalls](docs/methodology.md) — includes the three failed open-loop models and the end-to-end validation
- [Four-week training programme](docs/training-plan.md)
- [QA regression checklist](docs/qa-regression.md)
- [Handoff: current state, decisions, known limits](HANDOFF.md)

---

## Authors

- **[@i11usoryCat](https://github.com/i11usoryCat)** — direction, measurement data, methodology validation.
- **大肥鱼 (Dafeiyu)** — design, implementation, debugging.

Both lines describe *what was done*. Neither outranks the other.

## License

**Source available, all rights reserved.** Reading and using the hosted site are
permitted; copying, modifying, redistributing, rebranding, or commercial use are not.
See [LICENSE](LICENSE) for the full terms.

This project is not affiliated with Valve Corporation.
