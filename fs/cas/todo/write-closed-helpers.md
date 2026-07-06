## write-closed-helpers. Closed top-level helpers for `fileCas.write`

**Priority:** P4
**Status:** open
**Blocked by:** [fold-stream-combinator](../../effects/todo/fold-stream-combinator.md)
— partially: the chunk-loop task waits for `foldStream` (and, transitively,
[step-adapters](../../effects/todo/step-adapters.md), which comes first in the
sequence); the `publish`/`fail` hoisting can proceed independently at any time.

### Problem

`fileCas.write` (`fs/cas/module.f.ts:162-220`) defines its helpers nested:
`publish` (`:167-177`), `fail` (`:179-180`), and the chunk `loop`
(`:184-207`), capturing `sha2`, `path`, `stageDir`, `rndStr`, and `payload`
from the enclosing scopes.

The AGENTS.md hoisting rules, as originally motivated (per-call cost,
dependency visibility), don't force extraction here: `write` runs rarely and
each helper is built once per call. But under content-addressable
FunctionalScript the calculus changes — a closed, module-scope function has a
context-free identity that can deduplicate structurally against any other
module or repository, while a nested helper that captures enclosing locals
hashes uniquely to its context forever (see the content-addressing rationale
in the AGENTS.md hoisting bullets). Two further wins: finer proof granularity
(each helper coverable in isolation), and the residual `write` body becomes a
thin composition spine (`gcStage → mkdir → createExclusive → loop`), which is
itself the most dedup-likely form of all.

### Proposal

Lift each helper's captures into leading curried parameters and hoist it to
module scope — private (`const`, not `export const`), per the
no-speculative-export rule:

```ts
/** Publishes the finished staging file to its content-addressed shard. */
const publish = (sha2: Sha2) => (path: string) =>
    (state: Sha2State, offset: number, curPath: string): Effect<FileCasOperation, IoResult<Vec>> => …

/** Deletes the partial staging file and fails with `e`. */
const fail = (curPath: string) => (e: unknown): Effect<Rm, IoResult<Vec>> =>
    rm(curPath).step(() => pure(error(e)))
```

The chunk `loop` is one of the four consumers listed in
[fold-stream-combinator](../../effects/todo/fold-stream-combinator.md):
prefer expressing it through `foldStream` once that lands, threading
`{ state, offset, curPath }` as the accumulator. If that issue stalls, the
loop can still be hoisted closed on its own, with `(sha2)(stageDir)(rndStr)`
as curried context.

Split only along nameable seams — each extracted function must be describable
by a one-line JSDoc claim, as above. No fragment extraction.

### Tasks

- [ ] Hoist `publish` and `fail` as closed module-scope helpers with curried context.
- [ ] After [fold-stream-combinator](../../effects/todo/fold-stream-combinator.md)
      lands, express the chunk loop through `foldStream`; otherwise hoist it
      closed directly and note why here.
- [ ] `npx tsc`, `fjs t`; existing CAS proofs pass unchanged.

### Related

- [fold-stream-combinator](../../effects/todo/fold-stream-combinator.md) —
  covers the chunk loop; this issue covers the remaining nested helpers.
- [step-adapters](../../effects/todo/step-adapters.md) — `okStep` applies to
  two steps inside `write` (`createExclusive`, and `casUpload` beside it).
