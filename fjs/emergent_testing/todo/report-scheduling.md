## Try removing the browser runner's batching entirely

**Priority:** P3
**Status:** open — the experiment is done; the change it indicates is not

### Problem

The browser runner's `all` starts its children in slices of ten and yields to
the event loop between slices
([`fjs/effects/browser/module.mjs`](../../effects/browser/module.mjs)). **That
batching is premature optimization and should probably not exist.**

It was not added because anyone found the suite slow. It was added in a review
round, because without it the page renders nothing until the run finishes, and
that *looked* wrong. Observing a behaviour is not the same as someone having a
problem with it: nobody has reported a stall, and the number has already been
argued down from 25 to 10 with no measurement on either side of the change —
which is the shape of an optimization nobody can evaluate.

`fjs t` is the reference and it schedules nothing at all. It starts every leaf
of a module at once, prints results as they land, and no one has complained. The
browser runner sharing its semantics but not its scheduling is a difference that
has to justify itself, and so far it has not.

### The experiment, and what it measured

Run in headless Chromium against the generated page, 3435 proofs each time,
sampling the run's state every 150 ms. "Progress steps" counts how many distinct
result-counts a reader ever sees — how often the page visibly moves.

| `all` schedules | run | first row | progress steps |
| --- | ---: | ---: | ---: |
| no yielding at all (`Promise.all`) | 39.7 s | **39.8 s** | 2 |
| slices of 10, `setTimeout` yield | 40.2 s | 3.5 s | 49 |
| every result, `setTimeout` yield | **58.1 s** | 3.5 s | 229 |
| **every result, `MessageChannel` yield** | **40.4 s** | 3.6 s | 123 |

Two things fall out, and the first is not what "remove the batching" expected:

**Removing the yield removes the progress.** With no yielding the page shows
nothing at all until the run ends — first row at 39.8 s of a 39.7 s run. It is
not that the browser paints anyway; every operation resolves through a microtask
and a browser cannot paint between microtasks, so the whole suite is one task.
The run is not faster for it either (39.7 s against 40.2 s).

**The grouping was never the point — the clamp was.** Yielding after *every*
result is what a reader actually wants, and it costs nothing: 40.4 s against
39.7 s with no yielding, about 2%. It cost 45% only through `setTimeout`, which
clamps to 4 ms once nested — 3435 results × 4 ms is the entire difference.
`MessageChannel` (or `scheduler.yield()` where available) has no clamp.

So batching was the wrong mechanism, as suspected, but not because scheduling is
unnecessary: it was a workaround for a bad yield primitive, and the workaround is
what made grouping look necessary. `fjs t` prints each result as it lands and
that is the behaviour to match — one result, one update — which per-result
yielding gives and grouping only approximates.

### Tasks

- [x] Remove the batching and the yield; run the real suite in a browser and
      write down what actually happens. — table above.
- [ ] Replace `batchSize`/`runBatched` with a yield after every result, over a
      yield primitive with no clamp; delete the batch-size constant entirely.
- [ ] Re-point `operations.allYieldsBetweenBatches` at the new behaviour: it
      pins that a boundary exists between children, and should pin that one
      exists after *each* child.
- [ ] Check the yield primitive across browsers, and whether `scheduler.yield()`
      is worth preferring where it exists.

### Constraints

- Whatever the answer, it is the browser interpreter's policy. The Node runner
  has no frame to paint and must keep starting its children at once.
- `all` must keep answering every `Result` in the order its effects were given,
  batching or not.
- `operations.allYieldsBetweenBatches` pins the current behaviour. Removing the
  batching means removing that proof, not weakening it.

### Related

- [Browser testing](browser-testing.md)
- [Explicit browser test controls](browser-test-controls.md)
- [Share the whole runner](share-the-whole-runner.md) — the CLI runner's
  scheduling is one more thing the two hosts do differently for no stated
  reason.
