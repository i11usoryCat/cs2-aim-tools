# Methodology and Pitfalls

This document records how the calibration method was designed, which approaches failed, and why the current one was kept.

## Does sensitivity actually matter?

### Controlled experiment

Five sensitivities, thirty trials each, with block order counterbalanced (reversed in the second half to cancel learning and fatigue drift):

```text
cm/360   median ball-to-ball interval   median re-entries
16       538 ms                         1.0
20       551 ms                         0.0
23.2     538 ms                         0.0
27       521 ms                         0.0
32       531 ms                         0.0
```

The spread is 5.8%, which is inside statistical noise. **Within this range sensitivity has no measurable effect on hit speed.** This also explains why players can tweak sensitivity for hours without feeling a difference: the effect is smaller than the noise.

## Four iterations of the overshoot method

### v1 — record the click position

```text
f       = (landing - target) / target
cm_new  = cm * (1 + f)
```

Problem: players visually correct before clicking, so the recorded position is already the corrected one. Each round suggested only a 3-8% change and never converged.

### v2 — record the settled position (speed < 25°/s for 70 ms)

Best convergence observed:

```text
cm/360   overshoot
23.2     +7.4%
24.9     +4.8%
26.1     +2.9%
26.9     +2.9%
27.7     +2.3%
```

Monotonic decrease; the last two rounds differed by 0.7%.

### v3 — record the ballistic endpoint (speed dropping below 40°/s)

**Failed.** This captures a point mid-deceleration. Scatter was about ±15% while the bias being measured was about 5%, so the signal-to-noise ratio was too low:

```text
cm/360   overshoot   overshoots : undershoots
23.2     +8.7%       20 : 13
25.2     +16.0%      20 : 14
29.2     +3.3%       22 : 7
51.5     -0.7%       15 : 16
```

The sign flipped between rounds.

### v4 — click position, hits excluded, pooled samples

- Use the click position (zero latency, matches what the player feels)
- **Exclude hits** (angular error within ball radius) from the bias estimate: a hit means "control was sufficient", not "there was a bias"
- Pool every trial across runs, convert each to the cm/360 it implies, take the global median

Result: 480 samples converged to 27.2 cm/360 with a final bias of -0.1%.

## Pitfalls encountered

### 1. Auto-fill drift

"Run again" filled the suggested value automatically. With noisy data each round suggested a small change, and the sequence drifted to an absurd value (23.2 to 8.0, i.e. 8 cm per full turn).

Fix: refuse to auto-fill when the change exceeds 35%; add a "clear pool" button.

### 2. Death spiral in the time limit

```text
allowed time = 0.9 * median of HIT times
-> only fast attempts count as hits
-> the median falls
-> the allowed time falls
-> more timeouts, the surviving hits are faster still
```

Measured hit rate fell 60% -> 30% -> 25% while the ball radius grew, because two controllers were fighting.

Fix:

```text
time-limit mode on  -> ball fixed, only the time limit adapts
                       hit rate >= 85%: tighten 6%
                       hit rate <  70%: relax 7%
time-limit mode off -> time fixed, only the ball adapts
```

### 3. Visual size did not match the hit test

The ball was drawn at a 1.5° radius while the hit test used 3% of flick distance (about 0.6°). Players saw the crosshair inside the ball and still registered a miss.

Fix: the hit test compares angular error directly against the drawn radius.

### 4. Angles were not wrapped

```js
// wrong
Math.abs(tYaw - yaw);      // target 179°, current -179° -> 358°

// correct
wrapPi(tYaw - yaw);        // -> 2°
```

Symptom: "after I turn one direction I can no longer hit anything". Once accumulated rotation passed ±180° the test could never pass.

### 5. `tan()` flips at 90°

Target world position was computed as `x = D * tan(yaw)`, which flips sign past ±90°, drawing the ball at a mirrored position.

Correct spherical placement:

```js
const x = D * Math.cos(pitch) * Math.sin(yaw);
const y = D * Math.sin(pitch);
const z = D * Math.cos(pitch) * Math.cos(yaw);
```

### 6. Synchronous disk writes merge input reports

A raw-input logger that calls `WriteLine` + `AutoFlush` per HID report blocks the message loop, and Windows begins coalescing `WM_INPUT`:

```text
synchronous writes   -> measured 124 Hz
memory buffering     -> measured 4207 Hz
```

A 34x difference on the same 8K mouse. Always rule this out before measuring polling rate.

## The open-loop detour: three models, one honest reframe

The idea was attractive: if the first 250 ms of a flick is still ballistic, its endpoint
should encode the *setting* rather than the *correction*. Three models were built and all
of them failed the same way — the fitted amplitude absorbed the shape of the movement.

### v5 — exponential rise, A·(1 − e^(−t/τ))

Synthetic minimum-jerk trajectories (the realistic S-shape) with a **known gain of 1.00**
were fed in:

| Movement duration | Reported gain |
|---|---|
| 0.15 s | 1.089 |
| 0.20 s | 1.172 |
| 0.25 s | 1.281 |

The model has no acceleration phase, so fitting it to an S-curve inflates the amplitude.

### v6 — minimum-jerk, A·(10u³ − 15u⁴ + 6u⁵)

Correct on clean synthetic data (±1.6%), but on a **real** recording the same motion read
0.88 with the exponential and 1.33 with this model. A and D are not separately
identifiable from a truncated trajectory: a longer, flatter curve fits equally well with a
larger amplitude.

### v7 — first-stop, no model at all

Take the position at the moment speed falls below 15% of its peak — no extrapolation.
Validated end-to-end (synthetic motion injected through the page's own pointermove path):

| Injected gain | cm/360 | Reported |
|---|---|---|
| 0.85 | 27.1 | 84% |
| 1.00 | 27.1 | 99% |
| 1.15 | 27.1 | 114% |
| 1.00 | 40.0 | 99% |

The measurement chain is accurate to ±1% and **independent of the sensitivity setting**.

### What it actually measures

With the chain proven, the remaining readings had to be believed — and they were stable at
**71% at 20° and 71% at 40°** (CI ±13–14%, statistically indistinguishable). A pure gain
error would also be distance-invariant, but a correctly tuned sensitivity would sit near
100%. 71% means the **first movement covers only about 71% of the distance** and a
correction supplies the rest.

That is the two-phase structure of human pointing, not a sensitivity error. The page was
therefore **renamed from "open-loop calibration" to "first-move coverage"**, and its
"suggested cm/360" and "apply to settings" controls were removed — they were driving a
drift loop (each run multiplied cm/360 by about 0.7).

Self-check: append **?selftest=1** to the page URL. It injects three known gains and
reports whether the chain still holds in the current browser.

## Conclusions

1. **Sensitivity between 16 and 32 cm/360 has no significant effect** on measured performance; do not over-invest in tuning it.
2. If you calibrate, use the overshoot method, but **pool samples, exclude hits, and guard against drift**.
3. Use a **single difficulty controller** and an **85% success target**, otherwise the feedback loop diverges.
4. Most of the felt difference after a hardware or engine change comes from rebuilding motor memory, which only repetition can fix.
5. **Pointing tasks cannot measure gain error.** Closed-loop correction erases it; opening the loop removes the information the movement is planned from. What remains measurable is *where the first movement stops* (first-move coverage) and *whether the landing is systematically off-centre* (click bias).
6. Verify the measuring chain with a self-check before trusting any number. The open-loop page does this at `?selftest=1`; a chain that fails it invalidates the session.
