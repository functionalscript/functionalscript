## 65Z-tf-test-tree-walker. `fjs/emergent_testing`: share the test-tree walker between `runModule` and `registerModule`

**Priority:** P4
**Status:** open

### Problem

`fjs/emergent_testing/module.f.mjs` already factors out the static collection step into
`collectTests` (lines 116-128), which walks the export tree and returns a flat
list of `[path, TestEntry]` pairs. Both downstream consumers — `runModule` and
`registerModule` — then independently re-implement the *dynamic* walk of each
test's return value:

```ts
// registerModule (./fjs/emergent_testing/module.f.mjs:122)
const registerOne = (ctx: TestContext, [path, { fn, throws }]: TestAndPath) =>
    test(ctx, fmtImport(k, path), throws, (t): Effect<Test | All | Await, void> =>
        awaitIfPromise(fn())
        .step(resolved => {
            if (throws) { return pure(undefined) }
            const sub = collectTests([...path, null], false, resolved)
            if (sub.length === 0) { return pure(undefined) }
            return all(...sub.map(e => registerOne(t, e))).step(() => pure(undefined))
        }))

// runModule (./fjs/emergent_testing/module.f.mjs)
const one = ([testPath, set]: TestAndPath): Effect<O | All, RunTotals> =>
    test(k, testPath, set)
    .step(sr => {
        const t = testResult(k, testPath, sr)
        return result(t, sr, set.throws)
        .step((): Effect<O | All, RunTotals> => {
            const total = addResult(zeroTotals, t)
            if (t.status !== 'passed' || set.throws) { return pure(total) }
            return walk([...testPath, null], false, sr.result[1])
            .step(sub => pure(mergeTotals(total, sub)))
        })
    })
const walk = (path: Path, throws: boolean, v: unknown): Effect<O | All, RunTotals> => {
    const effects = collectTests(path, throws, v).map(one)
    return all(...effects)
    .step(states => pure(states.reduce(mergeTotals, zeroTotals)))
}
```

Both implementations:

1. Take a `TestAndPath` for the current leaf.
2. Execute the leaf (`fn()` directly or via `sandbox` inside `test`).
3. On success-without-`throws`, take the resolved return value, hand it back
   through `collectTests([...path, null], false, resolved)`, recurse into each
   sub-leaf, then `all(...)` the results.
4. Have a "neutral" continuation when the sub-list is empty.

`registerModule` is a process-adapter path for the surviving external frameworks. It
cannot always reuse `runModule`'s `Reporter<O>` because of the external-framework
constraint discussed in the module doc (lines 144-153). But the *traversal* (collect
leaves, recurse into function-return sub-trees, fan out with `all`) is shared and decouples
cleanly from the per-leaf action.

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

`runModule` instantiates `S = RunTotals`, threads `Sandbox`/`Reporter` effects
in `onLeaf`, and returns the sub-tree value on success-without-`throws`.

`registerModule` instantiates `S = void` for surviving process adapters, registers through
`TestContext` in `onLeaf`, and returns the sub-tree value the same way (the registered
callback itself becomes the recursion driver).

The shared browser runner described by [browser-testing](./browser-testing.md) must preserve
the same recursive proof-tree semantics. It may reuse emitted browser-compatible walker
code when dependency layering permits, or implement the same runner-independent contract
inside the page. Playwright itself remains outside that walker and only controls the page.

The exact `Walker` shape is open — it may be cleaner to split "should we
recurse?" from "give me the sub-tree value" so the abstraction doesn't force a
boolean discriminator. The point is the recursion shape (collect → fan-out →
merge) lives in one place for the process-side implementations, while the browser runner
shares the semantics rather than the obsolete Playwright registration path.

### Why this qualifies

- **DRY at the right altitude.** `collectTests` already names the static walk;
  this names the dynamic one. Two process-side consumers exist today, and another
  process adapter, JSON reporter, or coverage instrumenter would otherwise copy it.
- **Separation of concerns.** The recursion structure (fan-out, merge, when
  to stop) is one concern; the per-leaf action (sandbox+reporter vs.
  framework registration) is another. Today they're entangled inside two
  near-identical functions.
- **Documents the contract.** The "function-return sub-tree is walked the
  same way as the static export tree, with `throws` reset to `false` and a
  `null` marker appended to the path" rule is currently a comment in
  `runModule` (lines 187-188). Lifting it into a shared `walkTests` makes
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
- `runModule` builds each leaf's `TestResult` and folds it into `RunTotals`
  with `addResult`; `registerModule` doesn't care. The walker must not
  pretend to own this — it stays inside `onLeaf`.
- Browser execution has no `TestContext` and must not import the Node effect runner. Share
  browser-compatible code only when it keeps the page independent from Node and
  Playwright; otherwise share the explicit semantic contract and cross-runner fixtures.
- This is a single-consumer module today (`registerModule` and `runModule`
  are the only two in-repo callers of the pattern). Per `AGENTS.md`'s
  speculative-code rule, ship this only when the abstraction makes the
  *existing* two implementations shorter and clearer, not on the promise of
  a third consumer.

### Tasks

- [ ] Spike a `walkTests` shape against the existing `runModule` and surviving
      process-adapter `registerModule` implementations.
- [ ] Keep Playwright out of `TestContext`, `registerModule`, and the process-side walker.
- [ ] Define runner-independent fixtures for recursive return-value subtrees, `throws`
      reset, path construction, and sibling fan-out.
- [ ] Run those fixtures against both the process walker and the shared browser runner.
- [ ] Keep the browser runner free of Node and Playwright imports.
- [ ] Land the abstraction only when the existing process-side implementations become
      shorter and clearer.

### Related

- i183 — broader work on the `tf`
  framework; this is a structural cleanup that lands cleanly alongside it.
- [i157](../../djs/todo/157-json-djs-shared-value-machine.md) — same flavour: two parallel
  walkers over the same static shape, differing in the per-node action.
- [browser-testing](./browser-testing.md) — browser-side execution shared by the HTML,
  `fjs browser-test`, and Playwright outer runners.
