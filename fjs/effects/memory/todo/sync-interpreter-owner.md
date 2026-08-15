## sync-interpreter-owner. The synchronous memory interpreter is written three times

**Priority:** P3
**Status:** open

### Problem

`fjs/effects/memory` exports only the `MemOp` effect *constructors*
(`create`/`read`/`write`) and no synchronous interpreter, so every consumer
that runs memory effects against `fjs/effects/mock`'s `run` writes its own —
three copies today:

- `fjs/effects/memory/proof.f.mjs:14-45` — `_MemoryState` typedef,
  `initial = { next: 0, values: {} }`, and a `MemOperationMap<MemOp, _MemoryState>`
  with the `k${state.next}` key scheme;
- `fjs/protocol/mcp/proof.f.mjs:21-43` — the same, character-for-character
  apart from one `assert`;
- `fjs/effects/node/virtual/module.f.mjs:360-377` — a third structural copy
  over `State.memoryNext`/`State.memoryValues` with `mem${state.memoryNext}`
  ids, inlined into the virtual node interpreter.

```js
// both proof files:
memCreate: value => state => {
    const id = `k${state.next}`
    const key = /** @type {Key<unknown>} */ (asNominal(id))
    return [{ next: state.next + 1, values: { ...state.values, [id]: value } }, key]
},
memRead: key => state => [state, state.values[asBase(key)]],
```

The async counterpart is already shared (`fjs/effects/node/memory`); only the
sync one is not. The key-scheme and state shape are incidental details that
now exist in two variants for no reason.

### Proposal

`fjs/effects/memory` exports the sync interpreter next to the constructors:

```js
/** @typedef {{ readonly next: number,
 *   readonly values: { readonly [k: string]: unknown } }} MemoryState */

/** @type {MemoryState} */
export const memoryInitial = { next: 0, values: {} }

/** @type {MemOperationMap<MemOp, MemoryState>} */
export const memoryOperationMap = { memCreate, memRead, memWrite }
```

Both proof files import it. `virtual` keeps its own `State` (memory is one
facet of a larger record), but should build its three handlers by delegating
to the shared map over a lensed `{ next, values }` view — or, minimally, its
copy gets a comment naming the shared map as the reference. The first option
is preferred: the `mem${…}`-vs-`k${…}` divergence disappears.

### Tasks

- [ ] Export `MemoryState`, `memoryInitial`, `memoryOperationMap` from
      `fjs/effects/memory` with proof coverage.
- [ ] Replace the copies in `fjs/effects/memory/proof.f.mjs` and
      `fjs/protocol/mcp/proof.f.mjs`.
- [ ] `fjs/effects/node/virtual`: delegate the `mem*` handlers to the shared
      map (state-lens wrapper) or document why the inline copy stays.
- [ ] `npx tsc`, `fjs t`.

### Related

- `fjs/effects/node/memory/module.mjs` — the async interpreter, already
  shared; this issue gives the sync side the same owner.
