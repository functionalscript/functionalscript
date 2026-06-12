# 664-drop-io-interface. Drop the private `Io` interface from the node effect runner

**Priority:** P3
**Status:** done

## Problem

After PR 943, `fs/effects/node/module.ts` holds a private `Io` type and a single
`io: Io` instance bound to Node globals. `Io` is no longer a public export and is
no longer a mocking seam — it is pure indirection:

- **Mocking bypasses `Io` entirely.** Effectful programs are tested by the
  mem-runners in `fs/effects/mock/module.f.ts` and
  `fs/effects/node/virtual/module.f.ts`, which interpret `Effect<NodeOp, T>`
  directly against an in-memory `MemOperationMap` / `State`. They never construct
  an `Io`.
- **There is exactly one `Io` instance** (`const io: Io`), so the type bundles a
  handler table that is only ever filled one way.
- **The last external consumer is gone.** `env(io)` in `fs/dev/module.f.ts` —
  the only code outside the runner that took an `Io` — is already commented out.

## Proposal

Inline the single `io` handler table directly into the runner and remove the
`Io` indirection:

- delete `type Io` (private), and the already-dead `type App = (io: Io) => …`
  and `type Run` (both declared but never referenced)
- drop the `io` parameter from `fromIo` and `runProgram` — reference the Node
  globals / module-level constants directly instead of destructuring an `Io`
- prune `io` members the interpreter never reads (only appear in the `Io` type
  and the `io` literal, never consumed by `fromIo` / `runProgram`):
  - `console`
  - `tryCatch`
  - `asyncTryCatch`

  (`fs`, `fetch`, `http`, `childProcess`, `asyncImport`, `now`, `sandbox`,
  `write`, `await`, `process`, `testContext` / `bunTestContext` /
  `playwrightTestContext`, `engine` are consumed and stay.)

  Implementation note: `performance` was also never consumed via `io` — the
  `sandbox` handler closes over the global `performance` directly — so it was
  pruned as well.

End state: a single module-level `asyncRun({ … })` handler table wired straight
to Node globals, with `run` / `runEffect` unchanged.

## Constraints

- **No public API change.** `Io` is already private; `run` / `runEffect` and the
  `NodeProgram` / effect types are untouched. This is a pure internal
  simplification and should be a behaviour-preserving diff.
- Confirm `npm test` (including the `virtual` / `mock` runner proofs) and `fjs t`
  both still pass — they exercise the real runner end to end.

## Related

- [i664-file-type-conventions](./664-file-type-conventions.md) — `module.*` conventions
- #943 — folded `fs/io` into `fs/effects/node` and made `Io` private (prerequisite)
