## Yield on elapsed time, not on a count of proofs

**Priority:** P3
**Status:** open

### Problem

The browser runner's `all` starts its children in slices of ten and yields to
the event loop between slices
([`fjs/effects/browser/module.mjs`](../../effects/browser/module.mjs)). Ten is a
mitigation, not a design.

A count measures the wrong thing. Proofs differ in cost by orders of magnitude —
most are microseconds, a few run for a second or more — so a slice of ten fast
proofs yields almost immediately and wastes a task boundary, while a slice
holding one slow proof stalls the page for as long as that proof runs and no
count would have helped. The page freezes in bursts, and the reported progress
stops with it, which is exactly when a reader most wants to see it move. The
number was 25 and is now 10 for that reason; the next person to notice a stall
will have the same argument for 5.

### Preliminary design

Yield on a **time budget** rather than a count: keep starting children while the
slice has spent less than some milliseconds — a frame's worth, or a small
multiple of one — and hand the loop back when it has. That bounds the *stall*,
which is the thing a reader actually experiences, and it self-tunes: a thousand
trivial proofs run in one slice and one slow proof yields after itself.

The clock read has to be cheap and monotonic; `performance.now()` is both, and
the shared `sandbox` already measures each proof with it, so the elapsed time
may be available without a second read.

Two questions to settle with measurement rather than by argument:

- **Where the budget belongs.** In `all` alongside the slicing, or in the
  reporting handler that renders? `all` is where the work is started, which is
  what made the slicing correct in the first place.
- **Whether a slow proof can yield at all.** A single proof body is synchronous
  from the runner's point of view; nothing can interrupt it. A budget bounds how
  many *more* are started after one, not the stall the slow one itself causes.
  Reporting the slow proof's *start* — not only its result — may matter more
  than any scheduling change, and is the cheaper experiment.

### Constraints

- The Node runner has no frame to paint and must keep starting its children at
  once; this is the browser interpreter's policy, as the slicing already is.
- `all` must keep answering every `Result` in the order its effects were given.

### Tasks

- [ ] Measure where the page actually stalls on the real suite, per slice, and
      whether the cause is proof cost or rendering.
- [ ] Replace the count with an elapsed-time budget, and prove the boundary the
      way `operations.allYieldsBetweenBatches` proves the current one.
- [ ] Consider reporting a proof's start as well as its result, so a stall is
      visible rather than silent.

### Related

- [Browser testing](browser-testing.md)
- [Explicit browser test controls](browser-test-controls.md)
