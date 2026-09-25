## Share the parse→error/ok envelope in `mcpStep`

**Priority:** P3
**Status:** open

### Problem

`fjs/protocol/mcp/module.f.mjs`'s `mcpStep` request handler repeats the same
"parse the params, branch to an error or success response" envelope in every
method arm. The shape is always:

```js
const [t, pr] = parse(<schema>)(<params>)
return t === 'error'
    ? pureOk(errorResponseOf(id)(invalidParams))
    : <success using pr>
```

It appears four times in `mcpStep`, and the four do not even spell the
destructure the same way:

- `ping` — `parse(_noParams)(params)` as `[pt]`, success is
  `pureOk(successResponseOf(id)({}))`.
- `initialize` — `parse(initializeParams)(params)` as `[pr, pv]`, success builds
  an `InitializeResult` and writes state; the whole arm sits inside a
  `resultStep(read(stateKey), …)` that rejects a non-`uninitialized` session.
- `tools/list` — `parse(toolsListParams)(params === undefined ? {} : params)` as
  `[t, pr]`, success is `ioStep(handlers.toolsList(pr), r => pureOk(successResponseOf(id)(r)))`.
- `tools/call` — `parse(toolsCallParams)(params)` as `[t, pr]`, success is
  `ioStep(handlers.toolsCall(pr), r => pureOk(successResponseOf(id)(r)))`.

A fifth site, `notifications/initialized`, runs `parse(_noParams)(params)` but
answers `pureOk(null)` on either branch, since a notification never gets a
response. It shares the parse, not the envelope.

`toolEntry` was added as a helper for registering tool handlers with
pre-validated arguments, but `mcpStep` itself still repeats the inline
parse→error/ok pattern for `ping`, `initialize`, `tools/list`, and `tools/call`.

On top of that, `tools/list` and `tools/call` share a **second** layer that is
near-identical, differing only in the schema, the params-defaulting, and which
handler runs:

```js
// tools/list
if (capabilities.tools === undefined) {
    return pureOk(errorResponseOf(id)(methodNotFound))
}
const [t, pr] = parse(toolsListParams)(params === undefined ? {} : params)
return t === 'error'
    ? pureOk(errorResponseOf(id)(invalidParams))
    : ioStep(handlers.toolsList(pr), r => pureOk(successResponseOf(id)(r)))

// tools/call
if (capabilities.tools === undefined) {
    return pureOk(errorResponseOf(id)(methodNotFound))
}
const [t, pr] = parse(toolsCallParams)(params)
return t === 'error'
    ? pureOk(errorResponseOf(id)(invalidParams))
    : ioStep(handlers.toolsCall(pr), r => pureOk(successResponseOf(id)(r)))
```

Both sit inside one `resultStep(read(stateKey), …)` that has already rejected
an unreadable state (`internalError`) and a non-`initialized` one
(`notInitialized`), so the capability gate is the only per-method guard left
above the envelope.

The repeated `t === 'error' ? pureOk(errorResponseOf(id)(invalidParams)) : …`
envelope forces a reader to diff each arm to confirm the only thing that varies
is the schema and the success branch — exactly the readability cost
[`fjs/AGENTS.md`](../../../AGENTS.md#factor-out-what-two-branches-share)
calls out: "When two code branches share most of their structure, refactor so
the shared part appears once and only the difference lives in the conditional."

### Proposal

**Build the helpers on `json_rpc`'s exported `errorResponseOf` /
`successResponseOf`**, not on new local wrappers — this module stopped
carrying a private `_errResponse` / `_okResponse` pair, and reintroducing one
would undo that.

**Where the helpers live is open.** An earlier draft placed both at module
scope, taking the per-request `id` (and the per-server `capabilities`) as
leading parameters, under a "thread context rather than close over locals"
reading of the hoist rule. [`fjs/AGENTS.md`](../../../AGENTS.md#hoist-helpers-to-module-scope)
§3.3 now says the opposite: a helper that captures local state stays in the
scope that holds it, and a capture is not lifted into a leading parameter just
to hoist the helper ([lifted-captures](../../../todo/lifted-captures.md)).
Every call within one request passes the same `id`, so under the current rule
the helpers belong inside `mcpStep`'s per-request callback. The sketches below
keep the leading-parameter shape only because that is how they were written;
place them per §3.3 when implementing.

1. **A `validated` helper** that captures the `id`-bound `invalidParams`
   failure and forwards the decoded value to a success continuation:

   ```ts
   const validated = <const T extends Type>(id: Id, schema: T, params: Unknown) =>
       <O extends Operation>(onOk: (value: Ts<T>) => Effect<MemOp | O, Response | null, never>) => {
           const [t, pr] = parse(schema)(params)
           return t === 'error'
               ? pureOk(errorResponseOf(id)(invalidParams))
               : onOk(/** @type {Ts<T>} */ (pr))
       }
   ```

   Two things this signature has to get right, both easy to lose. `O` is
   quantified on the *returned* continuation, not alongside `T`: putting it on
   the outer call would instantiate it before `onOk` is seen — the same trap as
   `T` below. And the error channel is spelled `never` explicitly, because
   `Effect` defaults its third argument to `NotImplemented`
   (`fjs/effects/types.ts`), while every MCP handler is `Effect<…, never>`:
   the protocol absorbs its failures into response values. Defaulting here
   would widen `mcpStep`'s public contract — and `Effect`'s own doc uses
   "an MCP handler turning one into a JSON-RPC error response" as its example
   of what `never` claims.

   The schema must be the type parameter, not a widened `RttiType`. `T` appears
   in no argument of `validated(id, schema, params)` otherwise, so it resolves
   to `unknown` at that call — the `onOk` in the *second* call cannot recover
   it — and `parse` on a widened schema answers the base value domain rather
   than this schema's. `toolEntry` in the same module is the working precedent
   (`@template {Type} const T`, `inputRtti: T`, `handle: (args: Ts<T>) => …`),
   including that it still needs one `Ts<T>` cast where the decoded value
   crosses out of `parse` — which is why the sketch above carries the same cast
   at `onOk` rather than only mentioning it.

   Then `ping`, `initialize`, `tools/list`, and `tools/call` each collapse to a
   single `validated(id, schema, params)(pr => …success…)` call, dropping the
   duplicated `[t, pr]` destructure and the `t === 'error' ? …` ternary.

2. **A `toolMethod` helper** for the `tools/*` pair, layering the capability
   gate on top of `validated` so the two arms reduce to a schema, a
   params-default, and a handler:

   ```ts
   const toolMethod = (capabilities: ServerCapabilities, id: Id) =>
       <const T extends Type, O extends Operation>(schema: T, params: Unknown, handler: (v: Ts<T>) => Effect<O, Unknown, never>) =>
           capabilities.tools === undefined
               ? pureOk(errorResponseOf(id)(methodNotFound))
               : validated(id, schema, params)(pr => ioStep(handler(pr), r => pureOk(successResponseOf(id)(r))))
   ```

   `capabilities` is bound at `mcpStep`'s *config* curry level
   (`mcpStep({ protocolVersions, capabilities, serverInfo })`) and `id` per
   *request*, from `decodeRequest`'s message.

   `O` sits beside `T` on the *second* call, unlike in `validated`: `schema` and
   `handler` are both arguments of that call, so both parameters are inferable
   there. In `validated` the continuation arrives on a second call of its own,
   which is why `O` has to be quantified on that one instead. Either way the rule
   is the same — quantify where the argument that determines it is passed.

   `tools/list` becomes
   `toolMethod(capabilities, id)(toolsListParams, params === undefined ? {} : params, handlers.toolsList)`
   — keep that spelling rather than `params ?? {}`, which would also coerce
   `null` and turn a `tools/list` with `params: null` from `invalidParams` into
   a successful empty request. And `tools/call` becomes
   `toolMethod(capabilities, id)(toolsCallParams, params, handlers.toolsCall)`.

Both helpers keep the genuine per-method differences (schema, params-defaulting,
success action) visible at the call site while the validate/error/dispatch
mechanics live once.

### Why this is filed at P3 (not lower)

Unlike the borderline P5 "two tiny functions differ in one slot" cleanups, this
is a four-way repetition in a handler that is the natural growth point for the
protocol: the [MCP roadmap](./roadmap.md) adds `resources/*`, `prompts/*`, and
`logging/*` methods, every one of which will repeat the same parse→error/ok
envelope. The abstraction pays for itself the moment the next method lands, and
prevents the handler from accreting a dozen copies of the same ternary.

### Tasks

- [ ] Add a `validated` helper, placed per `fjs/AGENTS.md` §3.3; rewrite
      `ping`, `initialize`, `tools/list`, `tools/call` to use it. Note that
      `initialize` and the `tools/*` pair sit inside lifecycle
      `resultStep(read(stateKey), …)` wrappers, so the helper has to compose
      inside a continuation rather than replace the arm outright.
- [ ] Add `toolMethod` for the capability-gated `tools/*` pair, placed the same
      way.
- [ ] Confirm `fjs/protocol/mcp/proof.f.mjs` still passes (`fjs t`) with full
      branch coverage (both `error` and `ok` sides of each method) and `tsc` is
      clean.

### Related

- [roadmap.md](./roadmap.md) — the MCP methods not yet served; they are the
  second-and-beyond consumers that make this extraction worth doing now rather
  than later.
- [tool-step.md](./tool-step.md) — the same "failure becomes a result" theme
  one layer down, in the tool handlers.
- [effectful-dispatch-skeleton](../../json_rpc/todo/effectful-dispatch-skeleton.md)
  — the envelope *routing* above these arms.
