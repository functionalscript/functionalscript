## Envelope routing skeleton shared by pure and effectful dispatch

**Priority:** P4
**Status:** open

### Problem

The JSON-RPC request preamble — decode the envelope, answer a malformed one
with `Invalid Request` (`id: null`), and split notifications
(`id === undefined`) from requests — is spelled out twice.

Pure `dispatch` (`fjs/protocol/json_rpc/module.f.mjs`):

```js
const [t, message] = decodeRequest(value)
if (t === 'error') { return errorResponseOf(null)(invalidRequest) }
const { id, method, params } = message
if (id === undefined) { return null }
const handler = at(method)(handlers)
if (handler === null) { return errorResponseOf(id)(methodNotFound) }
```

Effectful `mcpStep` (`fjs/protocol/mcp/module.f.mjs`):

```js
const [t, message] = decodeRequest(value)
if (t === 'error') { return pureOk(errorResponseOf(null)(invalidRequest)) }
const { id, method, params } = message
if (id === undefined) {
    if (method === 'notifications/initialized') { ... }
    return pureOk(null)
}
```

`mcpStep` cannot reuse `dispatch` because `dispatch`'s `Handler` is pure
(`(params) => Result<Unknown, RpcError>`) while MCP handlers are effectful
and stateful — so the envelope routing, which is `json_rpc`'s concern, is
re-derived downstream. `decodeRequest` has exactly these two consumers.

### Proposal

Export one envelope-routing skeleton from `json_rpc`, generic in the result
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
- `mcpStep` instantiates `R = Effect<MemOp | O, Response | null, never>`, supplying
  its lifecycle-aware notification/request continuations.

Call sites changed: `dispatch` and `mcpStep` only.

**Caveat (why this is a design proposal, not a mechanical edit):** the shared
span is a handful of lines plus the notification split, and the two
dispatchers intentionally diverge after the preamble (pure table lookup vs.
stateful session gating). The abstraction pays off if more JSON-RPC-based
servers appear; the methods on the [MCP roadmap](../../mcp/todo/roadmap.md)
(`resources/*`, `prompts/*`, `logging/*`) grow `mcpStep`'s arms rather than
add a consumer. If none appears, the duplication may be cheaper than the
three-continuation indirection. Decide when a third consumer appears, or fold
into the [validated-envelope](../../mcp/todo/validated-envelope.md) work if it
touches the same lines anyway.

### Tasks

- [ ] Evaluate the `routeRequest` shape against the `validated`/`toolMethod`
      restructuring in
      [validated-envelope](../../mcp/todo/validated-envelope.md) (different
      layer: that one is the per-method arms, this is the top preamble).
- [ ] If adopted: add `routeRequest` with proof coverage, rebuild `dispatch`
      on it, migrate `mcpStep`.
- [ ] Run `tsc` and `fjs t`.

### Related

- `errorResponseOf` / `successResponseOf` (`../module.f.mjs`) — the envelope
  *constructors*, exported from this module; this issue is the envelope
  *routing*. Complementary, and the skeleton below builds on them.
- [validated-envelope](../../mcp/todo/validated-envelope.md) — per-method
  parse/response arms.
