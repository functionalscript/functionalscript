## 65Z-tf-test-tree-walker. `fjs/emergent_testing`: share the test-tree walker between `runModule` and `registerModule`

**Priority:** P4
**Status:** open

### Problem

`fjs/emergent_testing/module.f.ts` already factors out the static collection step into
`collectTests` (lines 116-128), which walks the export tree and returns a flat
list of `[path, TestEntry]` pairs. Both downstream consumers — `runModule` and
`registerModule` — then independently re-implement the *dynamic* walk of each
test's return value:

```ts
// registerModule (./fjs/emergent_testing/module.f.ts:154)
const registerOne = (ctx: TestContext, [path, { fn, throws }]: TestAndPath) =>
    test(ctx, fmtImport(k, path), throws, (t): Effect<Test | All | Await, void> =>
        awaitIfPromise(fn())
        .step(resolved => {
            if (throws) { return pure(undefined) }
            const sub = collectTests([...path, null], false, resolved)
            if (sub.length === 0) { return pure(undefined) }
            return all(...sub.map(e => registerOne(t, e))).step(() => pure(undefined))
        }))

// runModule (./fjs/emergent_testing/module.f.ts:175)
const one = ([testPath, set]: TestAndPath): Effect<O | All, TestState> =>
    test(k, testPath, set)
    .step(sr => {
        const { result: [s, r], duration } = sr
        return result(k, testPath, sr)
        .step((): Effect<O | All, TestState> => {
            if (s === 'ok') {
                if (set.throws) { return pure(addPass(duration)(zero)) }
                return walk([...testPath, null], false, r)
                .step(sub => pure(mergeState(addPass(duration)(zero), sub)))
            }
            return pure(addFail(duration)(zero))
        })
    })
const walk = (path: Path, throws: boolean, v: unknown): Effect<O | All, TestState> => {
    const effects = collectTests(path, throws, v).map(one)
    return all(...effects)
    .step(states => pure(states.reduce(mergeState, zero)))
}
```

Both implementations:

1. Take a `TestAndPath` for the current leaf.
2. Execute the leaf (`fn()` directly or via `sandbox` inside `test`).
3. On success-without-`throws`, take the resolved return value, hand it back
   through `collectTests([...path, null], false, resolved)`, recurse into each
   sub-leaf, then `all(...)` the results.
4. Have a "neutral" continuation when the sub-list is empty.

The control flow is the same; the per-leaf reducer differs (build a
`SandboxResult`-aware `TestState` accumulator vs. just register the test with
the framework).

`registerModule` (the Bun/Playwright path) explicitly cannot reuse `runModule`'s
`Reporter<O>` because of the external-framework constraint discussed in the
module doc (lines 144-153). But the *traversal* (collect leaves, recurse into
function-return sub-trees, fan out with `all`) is shared and decouples cleanly
from the per-leaf action.

### Proposal

Lift the traversal into a single `walkTests` combinator parameterized over the
per-leaf action and the accumulator merge:

```ts
// ./fjs/emergent_testing/module.f.ts (sketch)

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

`runModule` instantiates `S = TestState`, threads `Sandbox`/`Reporter` effects
in `onLeaf`, and returns the sub-tree value on success-without-`throws`.

`registerModule` instantiates `S = void`, registers via the `TestContext` in
`onLeaf`, and returns the sub-tree value the same way (the registered callback
itself becomes the recursion driver).

The exact `Walker` shape is open — it may be cleaner to split "should we
recurse?" from "give me the sub-tree value" so the abstraction doesn't force a
boolean discriminator. The point is the recursion shape (collect → fan-out →
merge) lives in one place.

### Why this qualifies

- **DRY at the right altitude.** `collectTests` already names the static walk;
  this names the dynamic one. Two consumers exist today and a third — a
  reporter that produces JSON, a coverage instrumenter, an alternative
  external framework — would otherwise be the third copy.
- **Separation of concerns.** The recursion structure (fan-out, merge, when
  to stop) is one concern; the per-leaf action (sandbox+reporter vs.
  framework registration) is another. Today they're entangled inside two
  near-identical functions.
- **Documents the contract.** The "function-return sub-tree is walked the
  same way as the static export tree, with `throws` reset to `false` and a
  `null` marker appended to the path" rule is currently a comment in
  `runModule` (lines 187-188). Lifting it into a shared `walkTests` makes
  the rule the API, not a convention to be reproduced.

### Caveats

- `registerModule`'s recursion happens *inside* a `test()` callback, so the
  child registration uses `t` (the inner `TestContext`), not `ctx`. The
  walker needs to carry whatever per-recursion context the leaf action
  produced — i.e. `onLeaf` may need to return a "child context" alongside
  the accumulator. This may complicate the signature enough that the
  abstraction stops feeling like a win; a small spike will tell.
- `runModule` measures per-leaf `duration` from `SandboxResult` and folds it
  into `TestState`; `registerModule` doesn't care. The walker must not
  pretend to own this — it stays inside `onLeaf`.
- This is a single-consumer module today (`registerModule` and `runModule`
  are the only two in-repo callers of the pattern). Per `AGENTS.md`'s
  speculative-code rule, ship this only when the abstraction makes the
  *existing* two implementations shorter and clearer, not on the promise of
  a third consumer.

### Related

- i183 — broader work on the `tf`
  framework; this is a structural cleanup that lands cleanly alongside it.
- [i157](../djs/todo.md) — same flavour: two parallel
  walkers over the same static shape, differing in the per-node action.
