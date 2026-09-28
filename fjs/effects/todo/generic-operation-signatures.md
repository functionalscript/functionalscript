## Generic operation signatures cost a cast

**Priority:** P3
**Status:** open

### Problem

An `Operation` may declare a generic signature — `MemRead` is
`<T>(key: Key<T>) => OpResult<T>`, and `Sandbox` (`../common/types.ts`) is
`<T>(f: () => T) => OpResult<SandboxResult<Awaited<T>>>`. Neither side of the
effect API can carry that type parameter, so each generic operation costs a
cast, twice over: once where the effect constructor is built, once where a
runner handles it.

**The constructor side: `Func<O>`.** `do_` builds an effect constructor from a
command name:

```js
export const do_ = command => (...payload) => ({ command, payload, continuation: pure })
```

Its result is typed by `Func<O>`, which works whenever the operation's
parameter and return types are fixed. A type parameter has nowhere to go in
`Func<O>`, so each generic constructor is cast instead:

| Site | Cast |
| --- | --- |
| `create` in `fjs/effects/memory/module.f.mjs` | `<T>(value: T) => Effect<MemCreate, Key<T>>` |
| `read` in `fjs/effects/memory/module.f.mjs` | `<T>(key: Key<T>) => Effect<MemRead, T>` |
| `all` in `fjs/effects/common/module.f.mjs` | `<O extends Operation, T, E>(...a: readonly Effect<O, T, E>[]) => Effect<O \| All, readonly Result<T, E>[], NotImplemented>` |

The contrast is visible in one file: the non-generic constructors are written
as `/** @type {Func<Stat>} */ const stat = do_('stat')` — an annotated
declaration, checked — and the generic ones as an inline cast, which is not.
`write`, beside `create` and `read`, is the same `do_` call written as an
annotated declaration and needs no cast — but the declaration form was tried on
`create` and does not help: `Func<MemCreate>` is `(value: unknown) =>
Effect<MemCreate, Key<unknown>>`, and `Key<unknown>` is not assignable to
`Key<T>` in the covariant result. `write` escapes only because `T` appears in
its parameters alone, where `unknown` is the accepting side.

**The handler side: `Pr`.** `Pr<O, K>` reads the payload and the output off an
operation's signature with `infer P` / `infer R`, and inference through a
generic signature instantiates its type parameter at the constraint. So the
handler an operation map writes receives `T = unknown` and has to cast its way
back: the `sandbox` handler in `fjs/effects/node/virtual/module.f.mjs` is
`f => state => [state, ok(/** @type {SandboxResult<unknown>} */ (f()))]`, and
without the cast `f()` is `unknown`, which `OpResult<SandboxResult<unknown>>`
will not take.

Note where `SandboxResult` sits: on the *output* side, wrapping what the handler
must produce, not inside `f`. That is the whole reason the cast is needed. Were
the payload `f: () => SandboxResult<T>`, erasure would hand the handler a
`SandboxResult<unknown>` already and there would be nothing to cast.

These are the last casts in the effects API that are load-bearing rather than
noise. See [`todo/inline-type-casts.md`](../../../todo/inline-type-casts.md).

### A neighbour that looks like this and is not

`answerRequest(/** @type {Erl<NodeOp>} */ (requestListener))` in
`fjs/effects/node/module.mjs`'s `createServer` handler was grouped here first,
and does not belong: `CreateServer` is **not** a generic operation.
`../node/types.ts` declares it as
`['createServer', (listener: RequestListener<Operation>) => OpResult<Server>]`,
with `Operation` written into the declaration, so `Pr` erases nothing — the
handler is handed the widest listener the type says it may be handed, and
narrowing it to `NodeOp` is what the cast does. The `<O extends Operation>`
signature it looks like it should have exists only on the effect constructor
(`createServer` in `../node/module.f.mjs`), which is itself a cast.

That makes it a third cause, needing its own answer: whether `CreateServer` can
carry the listener's op-set instead of pinning `Operation`, and what the
constructor's cast is standing in for. Left here as the nearest home rather than
filed separately, because whoever takes `Pr` will read this file first.

**Neither of these is the `asyncRun` cause**, which sat beside them and was
checked at the same time: inference of `O` from `ToAsyncOperationMap<O>` at the
call, cured by annotating the runner's own result — see "Prefer `@satisfies`
over `@type` when checking, not overriding" in
[`fjs/AGENTS.md`](../../AGENTS.md), and `memoryRun` in
[`../node/memory/module.mjs`](../node/memory/module.mjs). Deleting each cast and
reading the compiler error is what separated the three, and it is the check to
repeat on any further candidate.

### Proposal

No design yet. Give `Operation` a way to declare type parameters, so `Func<O>`
can produce a generic signature and the constructors become annotated
declarations like their non-generic neighbours; and work out whether a generic
operation's type parameter can be carried through `Pr` at all — the handler
would have to be typed as a generic function rather than an instantiation of
one, which `OperationMap`'s `(...payload: Pr<O, K>[0]) => R` cannot currently
express. Failing either, record here why it cannot be done, so the casts stop
reading as an oversight.

### Tasks

- [ ] Decide whether `Func<O>` can carry an operation's type parameter, and
      convert `create`, `read` and `all` if it can.
- [ ] Decide whether `Pr` can, and drop the handler-side casts if it can.
- [ ] Decide whether `CreateServer` can carry the listener's op-set.

### Related

- [`todo/inline-type-casts.md`](../../../todo/inline-type-casts.md) — the
  audit that measured these sites and asked for "its own issue against the
  API it is papering over"; this is that issue for them.
- [`../types.ts`](../types.ts) — `Func`, `Pr`, `OperationMap`,
  `ToAsyncOperationMap`.
