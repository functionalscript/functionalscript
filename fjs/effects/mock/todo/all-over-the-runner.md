## `run` and `partialRun` answer `all` over themselves

**Priority:** P3
**Status:** open

### Problem

The async side solved this: `asyncRunAll` and `asyncPartialRun` in
[`fjs/effects/module.mjs`](../../module.mjs) inject `all: allOver(() => run)`
so that, in its own words, no host writes the fan-out, and `asyncPartialRun`
does it only where `commands` includes `all`. The synchronous side —
`run` and `partialRun` in [`module.f.mjs`](../module.f.mjs) — has no
counterpart, so every state-threading runner that needs `all` hand-rolls the
loop *and* the `let runner; runner = run(...)` self-reference it needs:

```js
// virtualOperationMap.all, in fjs/effects/node/virtual
all: (...a) => state => {
    let e = []
    for (const i of a) {
        const [ns, ei] = virtual(state)(i)
        state = ns
        e = [...e, ei]
    }
    return [state, ok(e)]
},
```

— a loop reassigning its parameter inside an `.f.mjs`, over the module-level
`virtual` it is itself part of. `fanOut` in
[`fjs/effects/common/proof.f.mjs`](../../common/proof.f.mjs) and three
runners in [`fjs/emergent_testing/proof.f.mjs`](../../../emergent_testing/proof.f.mjs)
each write it again, the latter three verbatim as a `reduce` threading the
state. The [common README](../../common/README.md) lists `all` as answered by
Node and SpiderMonkey only, and says nothing about writing it per mock.

### Proposal

Mirror the async module: `partialRun` adds `all: allOver(() => run)` where
`commands` includes `all`, and a `runAll(o)` sibling of `run` does the same
for total maps. `allOver` folds the effects over the runner in turn,
threading the state — the sequential reading the common proof documents
("`all` says the effects may run at once, not that they must").

### Tasks

- [ ] Add `allOver`, `runAll`, and the conditional injection in `partialRun`.
- [ ] Delete the five handlers and the self-reference dances they needed.

### Related

- [`fjs/effects/todo/all-argument-limit`](../../todo/all-argument-limit.md) —
  `all`'s signature; fewer hand-written handlers make that change smaller.
- [run-map-inference](./run-map-inference.md) — the casts at the same proof
  sites.
