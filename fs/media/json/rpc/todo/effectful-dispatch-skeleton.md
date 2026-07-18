# Envelope routing skeleton shared by pure and effectful dispatch

**Priority:** P4
**Status:** open

## Problem

The JSON-RPC request preamble — decode the envelope, answer a malformed one
with `Invalid Request` (`id: null`), and split notifications
(`id === undefined`) from requests — is spelled out twice.

Pure `dispatch` (`fs/media/json/rpc/module.f.ts:98-113`):

```ts
const [t, message] = decodeRequest(value)
if (t === 'error') { return errorResponseOf(null)(invalidRequest) }
const { id, method, params } = message
if (id === undefined) { return null }
const handler: Handler | undefined = handlers[method]
if (handler === undefined) { return errorResponseOf(id)(methodNotFound) }
```

Effectful `mcpStep` (`fs/mcp/module.f.ts:315-338`):

```ts
const [t, message] = decodeRequest(value)
if (t === 'error') { return pure(_errResponse(null)(invalidRequest)) }
const { id, method, params } = message
if (id === undefined) {
    if (method === 'notifications/initialized') { ... }
    return pure(null)
}
```

`mcpStep` cannot reuse `dispatch` because `dispatch`'s `Handler` is pure
(`(params) => Result<Unknown, RpcError>`) while MCP handlers are effectful
and stateful — so the envelope routing, which is `json/rpc`'s concern, is
re-derived downstream. `decodeRequest` has exactly these two consumers.

## Proposal

Export one envelope-routing skeleton from `json/rpc`, generic in the result
type, and rebuild `dispatch` on top of it:

```ts
export const routeRequest =
    <R>(route: {
        readonly onError: (id: Id | null) => (e: RpcError) => R,
        readonly onNotification: (method: string) => (params: Unknown | undefined) => R,
        readonly onRequest: (id: Id) => (method: string) => (params: Unknown | undefined) => R,
    }) =>
    (value: Unknown): R => { /* decode + invalidRequest + notification split, once */ }
```

- Pure `dispatch` instantiates `R = Response | null`.
- `mcpStep` instantiates `R = Effect<MemOp | O, Response | null>`, supplying
  its lifecycle-aware notification/request continuations.

Call sites changed: `dispatch` and `mcpStep` only.

**Caveat (why this is a design proposal, not a mechanical edit):** the shared
span is ~5 lines plus the notification split, and the two dispatchers
intentionally diverge after the preamble (pure table lookup vs. stateful
session gating). The abstraction pays off if the roadmap adds more
JSON-RPC-based servers (`resources/*`, `prompts/*`, `logging/*` from
i665-mcp); if that never happens, the duplication may be cheaper than the
three-continuation indirection. Decide when a third consumer appears, or
fold into the 66D envelope work if it touches the same lines anyway.

## Tasks

- [ ] Evaluate the `routeRequest` shape against the 66D
      `validated`/`toolMethod` restructuring in `fs/mcp/todo/README.md`
      (different layer: 66D is per-method arms, this is the top preamble).
- [ ] If adopted: add `routeRequest` with proof coverage, rebuild `dispatch`
      on it, migrate `mcpStep`.
- [ ] Run `npx tsc` and `fjs t`.

## Related

- `fs/media/json/rpc/todo/response-constructors.md` — the envelope
  *constructors*; this issue is the envelope *routing*. Complementary.
- `fs/mcp/todo/README.md` (66D) — per-method validate/response arms.
