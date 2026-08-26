# `Pr` erases a generic operation's type parameter

**Priority:** P3
**Status:** open

### Problem

An `Operation` may declare a generic signature — `MemRead` is
`<T>(key: Key<T>) => OpResult<T>`, `Sandbox` is `<T>(f: () => SandboxResult<T>)
=> …`, `CreateServer` is `<O extends Operation>(listener: RequestListener<O>) =>
…`. `Pr<O, K>` reads the payload and the output off that signature with
`infer P` / `infer R`, and inference through a generic signature instantiates
its type parameter at the constraint. So the handler an operation map writes
receives `T = unknown`, `O = Operation`, and has to cast its way back:

- `fjs/effects/node/virtual/module.f.mjs:627` — `sandbox: f => … ok(/** @type
  {SandboxResult<unknown>} */ (f()))`; without the cast, `f()` is `unknown`
  and `Ok<unknown>` is not `OpResult<SandboxResult<unknown>>`.
- `fjs/effects/node/module.mjs:438` — `answerRequest(/** @type {Erl<NodeOp>} */
  (requestListener))`; without the cast, the payload is
  `RequestListener<Operation>` and `Operation` is not assignable to `NodeOp`.

The same erasure is why `fjs/effects/memory/module.f.mjs:34,39` cast the
`do_('memCreate')` / `do_('memRead')` results back to their generic shapes.
`write`, three lines below them, is the same `do_` call written as an annotated
declaration and needs no cast — but the declaration form was tried on `create`
and does not help: `Func<MemCreate>` is `(value: unknown) => Effect<MemCreate,
Key<unknown>>`, and `Key<unknown>` is not assignable to `Key<T>` in the
covariant result. `write` escapes only because `T` appears in its parameters
alone, where `unknown` is the accepting side.

**This is not the same cause as the `asyncRun` casts that used to sit beside
them**, and the two were checked together before being split apart. That one
was inference of `O` from `ToAsyncOperationMap<O>` at the call, and annotating
the runner's own result cured it — see "Prefer `@satisfies` over `@type` when
checking, not overriding" in [`fjs/AGENTS.md`](../../../AGENTS.md), and
`memoryRun` in [`../memory/module.mjs`](../memory/module.mjs). These two survive
that treatment: the loss happens inside `Pr`, before any call site has a say.
Deleting each cast and reading the compiler error is what separated them, and it
is the check to repeat on any further candidate.

### Proposal

No design yet. Work out whether a generic operation's type parameter can be
carried through `Pr` at all — the handler would have to be typed as a generic
function rather than an instantiation of one, which `OperationMap`'s
`(...payload: Pr<O, K>[0]) => R` cannot currently express — or record that it
cannot and that a generic operation costs one cast per handler by construction.

### Related

- [`todo/inline-type-casts.md`](../../../../todo/inline-type-casts.md) — the
  audit that measured all four sites and asked for "its own issue against the
  API it is papering over"; this is that issue for the generic ones.
- [`fjs/effects/types.ts`](../../types.ts) — `Pr`, `OperationMap`,
  `ToAsyncOperationMap`.
