# Virtual Node Effect Runner

A synchronous, in-memory implementation of the `NodeOp` effect runner, primarily used for testing.

## Usage

```ts
import { virtual, emptyState } from './module.f.ts'

const [finalState, result] = virtual(emptyState)(myEffect)
```

State carries in-memory representations of the filesystem (`root`), stdout/stderr output (`stdout`, `stderr`), network responses (`internet`), and a simulated clock (`epochNs`).

## Race condition detection

Because the virtual runner executes effects **synchronously and sequentially**, it serialises operations that would run concurrently in production. This makes it a useful tool for detecting potential race conditions: if two effects would conflict when run concurrently (e.g. both writing to the same file), the virtual runner will expose the problem deterministically — the second write always sees the result of the first.

Example: concurrent writes to the same file via `Promise.all` in the real runner may interleave arbitrarily, but the virtual runner always applies them in a fixed order, making the conflict visible and reproducible in tests.
