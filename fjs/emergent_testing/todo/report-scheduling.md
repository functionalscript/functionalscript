## Try removing the browser runner's batching entirely

**Priority:** P3
**Status:** open — experiment first, design only if the experiment says so

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

### The experiment, before any design

Remove the batching completely — `all` back to `Promise.all` over every child,
no `macrotask`, no `batchSize` — and run the real suite in a browser. Then look:

- Does the page actually stay blank until the end, or does the browser paint
  anyway? Module loading is network-bound and dominates the first seconds, which
  may be all the yielding a page needs.
- If it does stay blank, for how long, and does that matter to anyone reading a
  passing run? A suite that finishes in two seconds with no intermediate frames
  is not a problem; one that finishes in two minutes might be.
- Does anything except rendering depend on the yielding?

Only if that produces a stall someone objects to is there a problem to solve,
and only then is the shape of a solution worth arguing about. If it comes to
that, the argument against a count still holds — proofs differ in cost by orders
of magnitude, so a slice of ten fast ones wastes a boundary while a slice
holding one slow one stalls anyway — and an elapsed-time budget bounds the thing
a reader actually experiences. Reporting a proof's *start* as well as its result
may serve better than any scheduling change, and is cheaper to try.

### Constraints

- Whatever the answer, it is the browser interpreter's policy. The Node runner
  has no frame to paint and must keep starting its children at once.
- `all` must keep answering every `Result` in the order its effects were given,
  batching or not.
- `operations.allYieldsBetweenBatches` pins the current behaviour. Removing the
  batching means removing that proof, not weakening it.

### Tasks

- [ ] Remove the batching and the yield; run the real suite in a browser and
      write down what actually happens.
- [ ] Decide from that whether there is a problem at all.
- [ ] Only then, if there is: bound the stall by elapsed time rather than by a
      count, and prove the boundary the way the current one is proved.

### Related

- [Browser testing](browser-testing.md)
- [Explicit browser test controls](browser-test-controls.md)
- [Share the whole runner](share-the-whole-runner.md) — the CLI runner's
  scheduling is one more thing the two hosts do differently for no stated
  reason.
