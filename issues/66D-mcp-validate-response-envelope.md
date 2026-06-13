# 66D-mcp-validate-response-envelope. `mcp`: share the validate→error/ok response envelope

**Priority:** P3
**Status:** open

## Problem

`fs/mcp/module.f.ts`'s `mcpStep` request handler repeats the same
"validate the params, branch to an error or success response" envelope in
every method arm. The shape is always:

```ts
const [t, pr] = validate(<schema>)(<params>)
return t === 'error'
    ? pure(_errResponse(id)(invalidParams))
    : <success using pr>
```

It appears four times:

- `ping` (lines 220-225) — `validate(_noParams)(params)`, success is
  `pure(_okResponse(id)({}))`.
- `initialize` (lines 233-242) — `validate(initializeParams)(params)`, success
  builds an `InitializeResult` and writes state.
- `tools/list` (lines 252-261) — `validate(toolsListParams)(params === undefined ? {} : params)`,
  success is `handlers.toolsList(pr).step(r => pure(_okResponse(id)(r)))`.
- `tools/call` (lines 263-271) — `validate(toolsCallParams)(params)`, success is
  `handlers.toolsCall(pr).step(r => pure(_okResponse(id)(r)))`.

On top of that, `tools/list` and `tools/call` share a **second** layer that is
near-identical, differing only in the schema, the params-defaulting, and which
handler runs:

```ts
// tools/list (252-261)
if (capabilities.tools === undefined) {
    return pure(_errResponse(id)(methodNotFound))
}
const [t, pr] = validate(toolsListParams)(params === undefined ? {} : params)
return t === 'error'
    ? pure(_errResponse(id)(invalidParams))
    : handlers.toolsList(pr).step(r => pure(_okResponse(id)(r)))

// tools/call (263-271)
if (capabilities.tools === undefined) {
    return pure(_errResponse(id)(methodNotFound))
}
const [t, pr] = validate(toolsCallParams)(params)
return t === 'error'
    ? pure(_errResponse(id)(invalidParams))
    : handlers.toolsCall(pr).step(r => pure(_okResponse(id)(r)))
```

The repeated `t === 'error' ? pure(_errResponse(id)(invalidParams)) : …`
envelope forces a reader to diff each arm to confirm the only thing that varies
is the schema and the success branch — exactly the readability cost AGENTS.md
calls out: "When two code branches share most of their structure, refactor so
the shared part appears once and only the difference lives in the conditional."

## Proposal

1. **A `validated` helper** that captures the `id`-bound `invalidParams` failure
   and forwards the decoded value to a success continuation. Because `id`,
   `params`, and the `_errResponse`/`invalidParams` pair are per-request, the
   helper lives inside `mcpStep` (it genuinely closes over `id`), or — preferred
   per the "thread context rather than close over locals" rule — at module scope
   taking `id` as a parameter:

   ```ts
   const validated = <T>(id: Id, schema: RttiType, params: Unknown) =>
       (onOk: (value: T) => Effect<MemOp | O, Response | null>) => {
           const [t, pr] = validate(schema)(params)
           return t === 'error' ? pure(_errResponse(id)(invalidParams)) : onOk(pr)
       }
   ```

   Then `ping`, `initialize`, `tools/list`, and `tools/call` each collapse to a
   single `validated(id, schema, params)(pr => …success…)` call, dropping the
   duplicated `[t, pr]` destructure and the `t === 'error' ? …` ternary.

2. **A `toolMethod` helper** for the `tools/*` pair, layering the capability
   gate on top of `validated` so the two arms reduce to a schema, a
   params-default, and a handler:

   ```ts
   const toolMethod = <T>(schema: RttiType, params: Unknown, handler: (v: T) => Effect<O, Unknown>) =>
       capabilities.tools === undefined
           ? pure(_errResponse(id)(methodNotFound))
           : validated(id, schema, params)(pr => handler(pr).step(r => pure(_okResponse(id)(r))))
   ```

   `tools/list` becomes `toolMethod(toolsListParams, params ?? {}, handlers.toolsList)`
   and `tools/call` becomes `toolMethod(toolsCallParams, params, handlers.toolsCall)`.

Both helpers keep the genuine per-method differences (schema, params-defaulting,
success action) visible at the call site while the validate/error/dispatch
mechanics live once.

## Why this is filed at P3 (not lower)

Unlike the borderline P5 "two tiny functions differ in one slot" cleanups, this
is a four-way repetition in a handler that is the natural growth point for the
protocol: i665-mcp's roadmap adds `resources/*`, `prompts/*`, and `logging/*`
methods, every one of which will repeat the same validate→error/ok envelope. The
abstraction pays for itself the moment the next method lands, and prevents the
handler from accreting a dozen copies of the same ternary.

## Tasks

- [ ] Add a module-scope (or `mcpStep`-local) `validated` helper threading `id`;
      rewrite `ping`, `initialize`, `tools/list`, `tools/call` to use it.
- [ ] Add `toolMethod` for the capability-gated `tools/*` pair.
- [ ] Confirm `fs/mcp/proof.f.ts` still passes (`fjs t`) with full branch
      coverage (both `error` and `ok` sides of each method) and `npx tsc` is clean.

## Related

- [i665-mcp](./665-mcp.md) — the MCP roadmap; the methods it enumerates
  (`resources/*`, `prompts/*`, `logging/*`) are the second-and-beyond consumers
  that make this extraction worth doing now rather than later.
