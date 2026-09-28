## duration-format. One test duration is rendered three ways, and one of them by hand

**Priority:** P4
**Status:** open

### Problem

A `TestResult.duration` is a number of milliseconds, and three renderers
each spell it their own way:

```js
// fjs/emergent_testing/module.f.mjs, timeFormat — the terminal line and the `Time:` summary
const timeFormat = a => {
    const y = Math.round(a * 10_000).toString()
    const yl = 5 - y.length
    const x = '0'.repeat(yl > 0 ? yl : 0) + y
    const s = x.length - 4
    return `${x.substring(0, s)}.${x.substring(s)} ms`
}
// fjs/emergent_testing/browser/module.f.mjs, formatDuration — the counts line
export const formatDuration = ms => ms < 1000 ? `${ms.toFixed(1)} ms` : `${(ms / 1000).toFixed(1)} s`
// the same file, resultView — one row
`(${result.duration.toFixed(1)} ms)`
```

`timeFormat` is seven lines of string arithmetic that compute what
`toFixed(4)` computes — fixed point, four decimals, zero-padded — and the
browser module ignores its own `formatDuration` in the row beside the
counts that use it, so a leaf that took a second and a half reads
`1500.0 ms` in its row and `1.5 s` in the header above it.

On the same seam, `startBrowserTests` in `browser/module.mjs` re-counts
results in place (`into.passed += 1`) where `addResult` in
`module.f.mjs` is the fold the rest of the framework uses, and whose doc
says the run's verdict has one answer across the runners.

### Proposal

`fjs/emergent_testing/module.f.mjs` owns one `formatDuration`, the
browser module imports it, and every renderer calls it; `timeFormat` goes.
If the terminal wants four decimals where the page wants one, the
precision is a parameter, not a second function. `startBrowserTests`
folds with `addResult`.

### Tasks

- [ ] One `formatDuration`, with a proof, replacing `timeFormat` and the
      inline `toFixed`.
- [ ] `startBrowserTests` counts through `addResult`.
- [ ] `tsc`, `fjs test`.

### Related

- [timer-precision.md](./timer-precision.md) — the measurement's
  resolution; this issue is its rendering.
- [tty-and-line-consumers.md](./tty-and-line-consumers.md) — where the
  terminal line goes; independent of how the number in it is spelled.
