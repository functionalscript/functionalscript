## Browser timer precision makes per-proof durations mostly noise

**Priority:** P2
**Status:** open

### Problem

`sandbox` measures every proof the same way in every host — read the clock,
run the body, read it again:

```js
const before = performance.now()
// ...
return { result, duration: after - before }
```

That is right for `fjs t`, where `performance.now()` resolves to well under a
microsecond. It is not right in a browser, where the same call is deliberately
degraded as a Spectre and fingerprinting mitigation:

- Chromium coarsens `performance.now()` to **100 µs** on an ordinary page, and
  to 5 µs only when the page is cross-origin isolated (`COOP`/`COEP`).
- Firefox rounds to **1 ms** by default (`privacy.reduceTimerPrecision`) and
  additionally *jitters* the value, so successive reads are not merely coarse
  but non-deterministic.
- WebKit coarsens as well, and the exact figure has moved between releases.

The numbers our own suite produces put almost every proof under those clamps:
a typical leaf in the CLI report is 0.03–0.2 ms. On an ordinary Chromium page
that is one clock tick or zero, and on Firefox it is zero or one whole
millisecond of jitter. So the browser page's `(0.3 ms)` column is not a
measurement of anything — it is the clamp, rendered per row. Worse, a *total*
built by summing thousands of such rows accumulates the rounding rather than
cancelling it, so the sum can be off by a large multiple in either direction
depending on which way each read rounded.

Note this is not the same concern as
[`now`'s monotonicity](../../effects/browser/module.mjs), which is already
handled: `performance.timeOrigin + performance.now()` cannot go backwards. A
monotonic clock can still be a coarse one, and this is about the resolution.

### Preliminary design

Nothing here is decided; the point of the todo is to establish what is true
before changing the measurement.

- **Measure the clamp rather than assume it.** A proof that reads the clock in
  a tight loop and reports the smallest non-zero difference tells us the real
  resolution in whatever browser is running, which is a fact the report could
  carry alongside the durations. It is also the honest precondition for every
  option below.
- **Report a resolution, not just a duration.** If the host clock ticks at
  100 µs, a row saying `0.1 ms` is claiming precision it does not have. The
  report is serializable and consumed by controllers, so a `resolution` field
  would let a consumer decide what is significant instead of guessing.
- **Accumulate over a group.** The idea raised when this was filed: time a
  batch of leaves with one pair of reads and divide, so the clamp is amortized
  across many proofs instead of applied to each. This is speculation — it
  trades a per-test number for an average, it cannot attribute a slow proof,
  and it interacts with concurrency, since `all` interleaves launches and a
  group's wall time would then include siblings' work. Worth prototyping,
  not worth assuming.
- **Cross-origin isolation.** Serving the eventual application root with
  `COOP: same-origin` and `COEP: require-corp` buys Chromium's 5 µs clock and
  is a header change in the shared controller, not a design change. It does
  nothing for Firefox's jitter, and it constrains what the page may embed.
- **Consider not reporting a per-proof duration in the browser at all** if
  none of the above yields a number worth printing. A column that is always
  the clamp is worse than no column.

### Constraints

- `sandbox` is the operation that executes a proof body, and both runners must
  agree on it exactly or a suite means different things in different hosts.
  Any change to how it measures is a change to the shared contract, not a
  browser-local tweak.
- The clock must stay monotonic. Whatever replaces or supplements
  `performance.now()` cannot reintroduce wall-clock time.
- A duration must not cost a second `sandbox` call or an extra scheduling
  boundary: the reads are adjacent today precisely so a scheduler cannot
  interleave between them.
- Whatever the browser reports has to stay serializable and comparable to what
  `fjs t` reports, or the two reports cannot be diffed.

### Tasks

- [ ] Measure the actual `performance.now()` resolution in Chromium, Firefox
      and WebKit from inside the runner, and record the figures here.
- [ ] Decide whether the report carries the resolution, and whether a row
      below it renders a duration at all.
- [ ] Prototype accumulated timing over a group of leaves and check what it
      costs in attribution and what concurrency does to it.
- [ ] Check whether cross-origin isolation is worth the headers in the shared
      controller.

### Related

- [Run FunctionalScript proofs inside real browsers](browser-testing.md) — the
  report contract these durations belong to.
- [Report a test's name before running it](report-before-running.md) — the
  other thing wrong with what a row shows.
- [Share the whole runner](share-the-whole-runner.md) — `sandbox` is shared,
  so this is one decision, not two.
