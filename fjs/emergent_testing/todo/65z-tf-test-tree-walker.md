## 65Z-tf-test-tree-walker. `fjs/emergent_testing`: share the test-tree walk between `runEntries` and `registerModule`

**Priority:** P4
**Status:** open

### Problem

`fjs/emergent_testing/module.f.mjs` already factors out the static collection step into
`collectTests`, which walks the export tree and returns a flat list of
`[path, TestEntry]` pairs. Both downstream consumers then walk each leaf's
*return value* by their own means, and at `36c8d4a` the two means have diverged:

- **The run path.** `runModule` is a one-line wrapper over `runEntries`. Its
  per-leaf `one` announces the leaf, runs it through `test` (the sandbox),
  and — on success without `throws` — reads the returned value with
  `collectTests([...testPath, null], false, …)`, guarded by `catch_` because the
  read runs user code. It then reports the leaf and *answers* the children:
  `walkEntries` is `walkStep(pureOk(entries), state, one)`, which puts them in
  front of the siblings that remain. There is no recursion — one flat loop,
  sequential, threading `RunState`.
- **The registration path.** `registerModule`'s `registerOne` hands each leaf to
  the external framework through `test(ctx, name, throws, body)`. Inside the
  body it awaits `fn()`, reads the returned value with the same
  `collectTests([...path, null], false, …)` (unguarded), and *recurses* into
  `registerOne(t, e)` for each child under the child context `t`, fanned out
  with `allOk(...)`.

What the two still share is the rule for a returned value: it is read only after
a leaf succeeds without `throws`, walked the same way as the static export tree,
with `throws` reset to `false` and a `null` marker appended to the path. Each
path spells that rule itself. What they no longer share is the shape around it:
a flat `walkStep` loop that answers children as items, against a recursion
nested inside the framework's callback.

`registerModule` is a process-adapter path for the surviving external frameworks. It
cannot always reuse `runModule`'s `Reporter<O>` because of the external-framework
constraint discussed in the module doc. Whether a shared walk still decouples
cleanly from the per-leaf action, now that one side is a loop and the other a
recursion under a framework's context, is the open question this issue asks.

The removed Node-side Playwright integration is not a consumer of this design. A future
Playwright Test adapter opens the shared browser application and consumes its report; it
does not call `registerModule` for each proof.

### Proposal

Lift the traversal into a single `walkTests` combinator parameterized over the
per-leaf action and the accumulator merge:

```ts
// ./fjs/emergent_testing/module.f.mjs (sketch)

type Walker<O extends Operation, S> = {
    /** What to do at a single leaf. May return a sub-tree value to recurse into. */
    readonly onLeaf: (entry: TestAndPath) =>
        Effect<O, readonly [accumulator: S, subtreeValue: { has: true, v: unknown } | { has: false }]>
    /** Combine sibling accumulators. */
    readonly merge: (a: S, b: S) => S
    readonly zero: S
}

export const walkTests = <O extends Operation, S>(w: Walker<O | All, S>) => {
    const walk = (path: Path, throws: boolean, v: unknown): Effect<O | All, S> =>
        all(...collectTests(path, throws, v).map(entry =>
            w.onLeaf(entry).step(([sAcc, sub]) =>
                sub.has
                    ? walk([...entry[0], null], false, sub.v).step(s2 => pure(w.merge(sAcc, s2)))
                    : pure(sAcc))))
        .step(states => pure(states.reduce(w.merge, w.zero)))
    return walk
}
```

**The sketch above predates the sequential run and hard-codes the one thing
the two consumers no longer agree on.** It also predates `walkStep`: the run
path no longer recurses at all, so a walker that recurses cannot be what
`runEntries` instantiates without undoing that. The
[sequential run](../README.md#the-two-runners-and-what-sharing-them-cost) makes
`runModule`'s traversal sequential — one leaf's whole chain finishes before
the next starts — while `registerModule` keeps its `all` fan-out (its
recursion drives an external framework's own scheduling, and it is a site in
[all-argument-limit](../../effects/todo/all-argument-limit.md) either way).
So `all(...collectTests(...).map(...))` cannot live inside a shared walker:
scheduling is the *instantiation's* contract, not the walker's. A `walkTests`
that survives this takes the sibling combination as a parameter alongside
`merge` — a sequential fold for the run path, a fan-out for the registration
path — or it does not qualify. The sequential traversal has landed, so a spike
works against the code as it is; a walker that quietly restores concurrency to
`runEntries`, or quietly serializes `registerModule`, has broken a scheduling
contract this repository has already paid to settle.

`runEntries` would instantiate `S = RunState`, thread `Sandbox`/`Reporter`
effects in `onLeaf`, and return the sub-tree value on success-without-`throws`.

`registerModule` instantiates `S = void` for surviving process adapters, registers through
`TestContext` in `onLeaf`, and returns the sub-tree value the same way (the registered
callback itself becomes the recursion driver).

The shared browser runner described by [browser-testing](./browser-testing.md) must preserve
the same recursive proof-tree semantics. It may reuse emitted browser-compatible walker
code when dependency layering permits, or implement the same runner-independent contract
inside the page. Playwright itself remains outside that walker and only controls the page.

The exact `Walker` shape is open — it may be cleaner to split "should we
recurse?" from "give me the sub-tree value" so the abstraction doesn't force a
boolean discriminator. The point is the recursion shape (collect → visit each
sibling, under the instantiation's scheduling → merge) lives in one place for
the process-side implementations, while the browser runner
shares the semantics rather than the obsolete Playwright registration path.

### Why this qualifies

- **DRY at the right altitude.** `collectTests` already names the static walk;
  this names the dynamic one. Two process-side consumers exist today, and another
  process adapter, JSON reporter, or coverage instrumenter would otherwise copy it.
- **Separation of concerns.** The recursion structure (visit siblings, merge,
  when to stop) is one concern; the per-leaf action (sandbox+reporter vs.
  framework registration) is another — and the sibling *scheduling* belongs
  to neither: it is each instantiation's contract, per the note under the
  sketch. Today all three are entangled inside two near-identical functions.
- **Documents the contract.** The "function-return sub-tree is walked the
  same way as the static export tree, with `throws` reset to `false` and a
  `null` marker appended to the path" rule is currently a comment in
  `runEntries`'s `one`. Lifting it into a shared `walkTests` makes
  the rule the API, not a convention to be reproduced.
- **Keeps browser semantics aligned.** The browser application can validate itself against
  the same tree-walking contract without making Playwright a proof-registration framework.

### Caveats

- `registerModule`'s recursion happens *inside* a process-framework `test()` callback, so
  child registration may use an inner `TestContext` rather than the parent context. The
  walker needs to carry whatever per-recursion context the leaf action produced — i.e.
  `onLeaf` may need to return a "child context" alongside the accumulator. This may
  complicate the signature enough that the abstraction stops feeling like a win; a small
  spike will tell.
- `runEntries` builds each leaf's `TestResult` and folds it into `RunState`
  with `addLeaf`; `registerModule` doesn't care. The walker must not
  pretend to own this — it stays inside `onLeaf`.
- Browser execution has no `TestContext` and must not import the Node effect runner. Share
  browser-compatible code only when it keeps the page independent from Node and
  Playwright; otherwise share the explicit semantic contract and cross-runner fixtures.
- This is a single-consumer module today (`registerModule` and `runEntries`
  are the only two in-repo callers of the pattern). Per `AGENTS.md`'s
  speculative-code rule, ship this only when the abstraction makes the
  *existing* two implementations shorter and clearer, not on the promise of
  a third consumer.

### Tasks

- [ ] Spike a `walkTests` shape against `runEntries` and the surviving
      process-adapter `registerModule`, with the sibling combination as a
      parameter, per the note under the sketch. The
      [sequential traversal](../README.md#the-two-runners-and-what-sharing-them-cost)
      it must take as given has landed.
- [ ] Keep Playwright out of `TestContext`, `registerModule`, and the process-side walker.
- [ ] Define runner-independent fixtures for recursive return-value subtrees, `throws`
      reset, path construction, and sibling scheduling — proving the run path
      sequential and the registration path fanned out, since the walker takes
      the combination as a parameter.
- [ ] Run those fixtures against both the process walker and the shared browser runner.
- [ ] Keep the browser runner free of Node and Playwright imports.
- [ ] Land the abstraction only when the existing process-side implementations become
      shorter and clearer.

### Related

- [The two runners, and what sharing them cost](../README.md#the-two-runners-and-what-sharing-them-cost)
  — what settled `runModule`'s scheduling, which this issue's walker must take
  as a parameter rather than decide.
- i183 — broader work on the `tf`
  framework; this is a structural cleanup that lands cleanly alongside it.
- [i157](../../media/json/todo/157-json-djs-shared-value-machine.md) — same flavour: two parallel
  walkers over the same static shape, differing in the per-node action.
- [browser-testing](./browser-testing.md) — browser-side execution shared by the HTML,
  `fjs browser-test`, and Playwright outer runners.
