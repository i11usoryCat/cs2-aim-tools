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

Individual drills:

| Tool | URL |
| --- | --- |
| Sensitivity calibrator | https://i11usorycat.github.io/cs2-aim-tools/tools/sensitivity-calibrator.html |
| Calibrator (strict) | https://i11usorycat.github.io/cs2-aim-tools/tools/sensitivity-calibrator-strict.html |
| Adaptive random flick | https://i11usorycat.github.io/cs2-aim-tools/tools/aim-trainer.html?mode=random&count=40&limit=1 |
| Blocked repetition | https://i11usorycat.github.io/cs2-aim-tools/tools/aim-trainer.html?mode=block&count=40&limit=0 |
| Micro-precision | https://i11usorycat.github.io/cs2-aim-tools/tools/aim-trainer.html?mode=precision&count=40&limit=0 |

---

## Features

### Sensitivity calibration

The calibrator records where each flick actually lands relative to the target and derives the sensitivity you should be using:

```text
f         = (landing projection - target distance) / target distance
cm/360'   = cm/360 * (1 + median f)
```

- Samples are pooled across runs to suppress single-run noise
- The UI reports convergence when two consecutive rounds differ by less than 1%
- Hits (angular error within the ball radius) are excluded from the bias estimate

### Flick training

Three modes mapped to stages of motor learning:

| Mode | Mechanic | Purpose |
| --- | --- | --- |
| Adaptive random | Ball size and time limit auto-adjust toward an **85% success rate** | Main practice |
| Fixed angle (blocked practice) | Same angle eight times, alternating across a centre anchor on four axes | Build the motor program, warm-up |
| Micro-precision | Fixed 0.7° ball, no time limit | Landing precision |

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
| `cs2at.scene` | Training scene palette |
| `cs2at.fps` | Frame-rate cap |
| `cs2at.perf` | Performance mode |

> `file://` and `https://` are separate storage origins. Records made from a local file are not visible on the hosted site and vice versa. Use **Export JSON** on the stats page to move data.

---

## Quick start

1. Open the hub, go to **Settings**, and enter your DPI, m_yaw, and current in-game sensitivity.
2. Run the **Sensitivity calibrator** once and note the suggested value.
3. Update the sensitivity in Settings.
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
├── index.html                            Landing page
├── app.html                              Hub: stats, plan, drills, settings
├── program.html                          Four-week guided plan
├── tools/
│   ├── sensitivity-calibrator.html       Calibration, all samples
│   ├── sensitivity-calibrator-strict.html Calibration, misses only
│   └── aim-trainer.html                  Flick trainer, three modes
├── windows/
│   ├── RawLogger.cs                      Raw HID input recorder
│   └── README.md
├── docs/
│   ├── methodology.md                    Method notes and pitfalls
│   └── training-plan.md                  Four-week training programme
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

- [Method notes and pitfalls](docs/methodology.md)
- [Four-week training programme](docs/training-plan.md)

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
