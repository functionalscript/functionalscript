## The async memory runner re-implements the synchronous one

**Priority:** P4
**Status:** open

### Problem

Two exports are named `memoryOperationMap`, and they are different things:

- `fjs/effects/memory/module.f.mjs`'s is the synchronous interpreter: a map
  value over `MemoryState`, keys `mem0`, `mem1`, … in creation order, state
  threaded through each handler.
- `fjs/effects/node/memory/module.mjs`'s is a factory `(uuid?) => …` for an
  asynchronous map that holds its slots in a mutable `Map`, keyed by UUIDs. It is
  what `memoryRun` runs, and `fjs/effects/node/module.mjs` imports it under the
  same name.

The rule for a key `memCreate` never handed out — panic, with
`memory key not found: …` — is written in both: `slot` in the synchronous
module, `missingKey` and its two presence checks in the asynchronous one. The
synchronous map was added in
[#2279](https://github.com/functionalscript/functionalscript/pull/2279)
precisely so that consumers stop keeping their own copies of this behaviour;
the asynchronous runner is the copy that remains, and its presence check is
business logic in a `.mjs`.

### Proposal

No design yet. Either build the asynchronous runner by lifting the pure map
over one mutable cell, keeping only the host glue (the store, `randomUUID`) in
`.mjs`, or keep two interpreters and rename one export so the two are not
confused, sharing the not-found message.

### Tasks

- [ ] Decide between lifting the synchronous map and renaming one export.
- [ ] Give the not-found rule one owner.
- [ ] `tsc`, `fjs test`, `node --test`.

### Related

- [`../../../memory/module.f.mjs`](../../../memory/module.f.mjs) —
  `memoryOperationMap` and `memoryInitial`, over `MemoryState` from the sibling
  `types.ts`.
- [`../module.mjs`](../module.mjs) — `memoryOperationMap`, `memoryRun`, `run`.
