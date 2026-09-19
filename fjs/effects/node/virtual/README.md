# Virtual Node Effect Runner

A synchronous, in-memory implementation of the `NodeOp` effect runner, primarily used for testing.

## Usage

```ts
import { virtual, emptyState } from './module.f.mjs'

const [finalState, result] = virtual(emptyState)(myEffect)
```

State carries in-memory representations of the filesystem (`root`), stdout/stderr output (`stdout`, `stderr`), network responses (`internet`), and a simulated clock (`epochNs`).

## File-module resolution

`resolveFileModule` uses a lexical path profile: a literal entry path, or an
admitted portable URL-path spelling resolved against a normalized path identity.
Identity escapes literal `%`, `?` and `#` in the pathname and appends the query
and fragment; file reads use the decoded path. Empty components are omitted.
Suffix text otherwise stays opaque: Unicode/space URL normalization is the
native host's responsibility.
The fixture filesystem has no working directory or symlinks. This preserves the
virtual host's path model; it does not simulate Node's file URL/realpath rules.
Compiler traversal is tested here, and native ESM comparisons test those Node
rules under Node in `fjs/fsc/transpiler/proof.mjs`.

## Race condition detection

Because the virtual runner executes effects **synchronously and sequentially**, it serialises operations that would run concurrently in production. This makes it a useful tool for detecting potential race conditions: if two effects would conflict when run concurrently (e.g. both writing to the same file), the virtual runner will expose the problem deterministically — the second write always sees the result of the first.

Example: concurrent writes to the same file via `Promise.all` in the real runner may interleave arbitrarily, but the virtual runner always applies them in a fixed order, making the conflict visible and reproducible in tests.
