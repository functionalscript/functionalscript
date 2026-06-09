# Memory Effect

**Priority:** P3
**Status:** done

A key-value store effect for mutable state that persists across multiple effect steps within a session or computation.

## Design

### Key type

```ts
import type { Phantom } from '../types/phantom/module.f.ts'
import type { Nominal } from '../types/nominal/module.f.ts'

type Key<T> = Phantom<Nominal<'MemKey', '3f114fa6036a8da026b827f0c3e6d901f5e81ad9a320e431ccce31451892d286', string>, T>
```

- `Nominal<'MemKey', '3f114fa6036a8da026b827f0c3e6d901f5e81ad9a320e431ccce31451892d286', string>` makes keys opaque — prevents accidental use of arbitrary strings as keys and insulates callers from future representation changes (`number`, `bigint`, etc.).
- `Phantom<…, T>` carries the value type so `read` and `write` are type-safe without a cast.
- Real collision prevention comes from randomization at runtime (e.g. `crypto.randomUUID()`), not from the nominal type alone.

### Operations

```ts
type MemCreate<T> = readonly['memCreate', (value: T) => Key<T>]
type MemRead<T>   = readonly['memRead', (key: Key<T>) => T]
type MemWrite<T>  = readonly['memWrite', (key: Key<T>, value: T) => void]
type MemOp = MemCreateOp | MemReadOp | MemWriteOp
```

- `create` allocates a new slot with an initial value and returns its key.
- `read` retrieves the current value for a key.
- `write` updates the value for a key.

`MemOp` uses broad, non-exported operation members whose payload positions are
`never` and whose return positions are `unknown`, so concrete typed operations
such as `MemCreate<number>` are accepted without introducing `any` into the
operation union.

### Intended use cases

- Tool implementations inside an MCP server that maintain state across calls (e.g. a counter, a cache, a conversation history buffer).
- Any computation that needs a mutable cell without threading explicit state through every function.

The MCP session state itself (`McpSessionState`) is better kept as explicit state threading `(value, state) => [effect, newState]` — see [669-ci-integration-tests.md](669-ci-integration-tests.md) for context. Memory effect is for *tool-level* state that outlives a single step.

## Future extensions

The initial design stores scalar or plain-object values. In the future we may support richer value types — for example, a mutable cell holding an immutable map or set (e.g. `Key<BTree<K, V>>` from `fs/types/btree`). Each `write` replaces the whole value, but because the stored value is itself immutable and structurally shared, this is efficient. In the future we may provide richer mutable value types — for example, a mutable map `Key<Map<K, V>>` where individual entries can be updated without replacing the whole value. This would allow more efficient operations on large collections without requiring a full read-modify-write cycle.

## Plan

- [x] Define `Key<T>`, `MemOp`, and the three operation types in `fs/effects/memory/module.f.ts`.
- [x] Implement a Node.js interpreter under `fs/effects/node/memory/` (`Map<string, unknown>` backed, keys generated via `crypto.randomUUID()`).
- [x] Add proof tests covering create/read/write round-trips and type safety.
- [x] Document how to compose `MemOp` with other operation types (e.g. `IoOp | MemOp`).
