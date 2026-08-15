# `ToAsyncOperationMap<O>` rejects the operation maps built for it

**Priority:** P3
**Status:** open

### Problem

`asyncRun` takes a `ToAsyncOperationMap<O>`, and `memoryOperationMap()` exists to
supply one — but the result is not assignable, so both call sites cast:

- `fjs/effects/node/memory/module.mjs:60` — `asyncRun(/** @type {ToAsyncOperationMap<MemOp>} */ (memoryOperationMap()))`
- `fjs/effects/node/memory/proof.mjs:28` — the same cast, spelled with an inline `import(…)`

`npx tsc` reports `MemoryOperationMap` is not assignable to
`ToAsyncOperationMap<Operation>`, so the mismatch is between the map type the
factory returns and the shape the runner asks for — not between `MemOp` and some
other operation set.

This matters beyond tidiness: [`fjs/AGENTS.md`](../../../AGENTS.md) notes that a
cast around a value handed to a `ToAsyncOperationMap<O>`-shaped parameter blocks
TypeScript from checking each operation's implementation against `O`, so a
drifted handler shape is absorbed rather than reported. These two casts are that
exact hazard.

Two nearby casts in the same area may or may not share a cause, and are worth
checking at the same time:

- `fjs/effects/node/module.mjs:287` — `Erl<NodeOp>` on a request listener
- `fjs/effects/node/virtual/module.f.mjs:410` — `SandboxResult<unknown>` on `f()`

### Proposal

Make `memoryOperationMap()` return something `asyncRun` accepts, so the object
literal is checked structurally against `O` at the call site and both casts go.

### Related

- [`todo/inline-type-casts.md`](../../../../todo/inline-type-casts.md)
