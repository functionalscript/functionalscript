## `Pr` erases a generic operation's type parameter

**Priority:** P3
**Status:** open

### Problem

An `Operation` may declare a generic signature — `MemRead` is
`<T>(key: Key<T>) => OpResult<T>`, and `Sandbox` (`../types.ts:325`) is
`<T>(f: () => T) => OpResult<SandboxResult<T>>`. `Pr<O, K>` reads the payload
and the output off that signature with `infer P` / `infer R`, and inference
through a generic signature instantiates its type parameter at the constraint.
So the handler an operation map writes receives `T = unknown` and has to cast
its way back — `fjs/effects/node/virtual/module.f.mjs:627` is
`sandbox: f => … ok(/** @type {SandboxResult<unknown>} */ (f()))`, and without
the cast `f()` is `unknown`, which `OpResult<SandboxResult<unknown>>` will not
take.

Note where `SandboxResult` sits: on the *output* side, wrapping what the handler
must produce, not inside `f`. That is the whole reason the cast is needed. Were
the payload `f: () => SandboxResult<T>`, erasure would hand the handler a
`SandboxResult<unknown>` already and there would be nothing to cast.

The same erasure is why `fjs/effects/memory/module.f.mjs:34,39` cast the
`do_('memCreate')` / `do_('memRead')` results back to their generic shapes.
`write`, three lines below them, is the same `do_` call written as an annotated
declaration and needs no cast — but the declaration form was tried on `create`
and does not help: `Func<MemCreate>` is `(value: unknown) => Effect<MemCreate,
Key<unknown>>`, and `Key<unknown>` is not assignable to `Key<T>` in the
covariant result. `write` escapes only because `T` appears in its parameters
alone, where `unknown` is the accepting side.

### A neighbour that looks like this and is not

`fjs/effects/node/module.mjs:438` — `answerRequest(/** @type {Erl<NodeOp>} */
(requestListener))` — was grouped here first, and does not belong: `CreateServer`
is **not** a generic operation. `../types.ts:235` declares it as
`['createServer', (listener: RequestListener<Operation>) => OpResult<Server>]`,
with `Operation` written into the declaration, so `Pr` erases nothing — the
handler is handed the widest listener the type says it may be handed, and
narrowing it to `NodeOp` is what the cast does. The `<O extends Operation>`
signature it looks like it should have exists only on the effect constructor
(`../module.f.mjs:346`), which is itself a cast.

That makes it a third cause, needing its own answer: whether `CreateServer` can
carry the listener's op-set instead of pinning `Operation`, and what the
constructor's cast is standing in for. Left here as the nearest home rather than
filed separately, because whoever takes `Pr` will read this file first.

**Neither of these is the `asyncRun` cause**, which sat beside them and was
checked at the same time: inference of `O` from `ToAsyncOperationMap<O>` at the
call, cured by annotating the runner's own result — see "Prefer `@satisfies`
over `@type` when checking, not overriding" in
[`fjs/AGENTS.md`](../../../AGENTS.md), and `memoryRun` in
[`../memory/module.mjs`](../memory/module.mjs). Deleting each cast and reading
the compiler error is what separated the three, and it is the check to repeat on
any further candidate.

### Proposal

No design yet. Work out whether a generic operation's type parameter can be
carried through `Pr` at all — the handler would have to be typed as a generic
function rather than an instantiation of one, which `OperationMap`'s
`(...payload: Pr<O, K>[0]) => R` cannot currently express — or record that it
cannot and that a generic operation costs one cast per handler by construction.

### Related

- [`todo/inline-type-casts.md`](../../../../todo/inline-type-casts.md) — the
  audit that measured these sites and asked for "its own issue against the
  API it is papering over"; this is that issue for them.
- [`fjs/effects/types.ts`](../../types.ts) — `Pr`, `OperationMap`,
  `ToAsyncOperationMap`.
