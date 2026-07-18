## `json/rpc`: own and export the response-envelope constructors

**Priority:** P4
**Status:** open

### Problem

Building a JSON-RPC response envelope — `{ jsonrpc, result, id }` on success,
`{ jsonrpc, error, id }` on failure — is a `json/rpc` concern: the module owns
`jsonrpc`, `Id`, `RpcError`, and the `Response` schema. Yet the constructors
for those two shapes exist in **two modules**, once privately here and once
re-rolled downstream:

```ts
// fs/media/json/rpc/module.f.ts:87 — private
const errorResponseOf = (id: Id) => (error: RpcError): Response =>
    ({ jsonrpc, error, id })
// fs/media/json/rpc/module.f.ts:116 — success shape inlined in dispatch
    ? { jsonrpc, result, id }

// fs/mcp/module.f.ts:240-244 — the same two constructors, rebuilt
const _errResponse = (id: Id) => (error: RpcError): Response =>
    ({ jsonrpc, error, id })
const _okResponse = (id: Id) => (result: Unknown): Response =>
    ({ jsonrpc, result, id })

// fs/mcp/stdio/module.f.ts:52,55 — third and fourth copies of the error envelope
const parseErrorResponse: Response = { jsonrpc, error: parseError, id: null }
const internalErrorResponse = (id: Response['id']): Response => ({ jsonrpc, error: internalError, id })
```

(`parseErrorResponse` is `errorResponseOf(null)(parseError)` evaluated once;
`internalErrorResponse` is `errorResponseOf` specialized to `internalError` —
both collapse onto the exported constructor.)

`mcp` already imports `jsonrpc`, `rpcError`, `invalidRequest`, `invalidParams`,
and `methodNotFound` from `json/rpc` — the error *values* travel across the
module boundary, but the envelope *constructors* had to be reinvented because
they are private. That is the same separation-of-concerns smell already fixed
for `ToolsCallResult` (`okResult`/`errorResult` now live in `mcp` and
`cas/mcp` imports `okResult` instead of hand-rolling it) one layer down: the
owner module exports half of a pair and every consumer hand-rolls the rest.
`_errResponse` is byte-identical to `errorResponseOf`; `_okResponse` is the
inlined success literal from `dispatch` given a name. Both are used throughout
`mcpStep` (8+ call sites) and will be used by every future protocol built on
`json/rpc`.

Per `AGENTS.md`: "When a sibling module already has the type or helper you
need, import it — add `export` to the existing declaration if it's not yet
exported, rather than duplicating it." Two real consumers exist (`dispatch`
itself and `mcpStep`), so the extraction is past the second-consumer bar.

### Proposal

Export both constructors from `fs/media/json/rpc/module.f.ts` and consume them in
`dispatch` and `mcp`:

```ts
// fs/media/json/rpc/module.f.ts
export const errorResponseOf = (id: Id) => (error: RpcError): Response =>
    ({ jsonrpc, error, id })

export const successResponseOf = (id: Id) => (result: Unknown): Response =>
    ({ jsonrpc, result, id })
```

- Naming: the schemas `successResponse`/`errorResponse` are already exported,
  so the constructors take the `…Of` suffix that `errorResponseOf` already
  uses. Keep the pair's names parallel.
- `dispatch` replaces its inline `{ jsonrpc, result, id }` with
  `successResponseOf(id)(result)`.
- `fs/mcp/module.f.ts` deletes `_errResponse`/`_okResponse` and imports the
  exported pair; no behavior change.
- Future JSON-RPC-based servers (the `resources/*`, `prompts/*`, `logging/*`
  methods from [i665-mcp](../../../mcp/todo/README.md)) get the constructors
  for free instead of copying them a third time.

This composes cleanly with
[66D-mcp-validate-response-envelope](../../../mcp/todo/README.md): that
issue's `validated` helper is defined *in terms of* the error constructor;
after this change it builds on the imported one.

### Tasks

- [ ] Export `errorResponseOf`; add and export `successResponseOf` in
      `fs/media/json/rpc/module.f.ts`; use it in `dispatch`.
- [ ] Replace `_errResponse`/`_okResponse` in `fs/mcp/module.f.ts` with the
      imported constructors.
- [ ] Rebuild `parseErrorResponse`/`internalErrorResponse` in
      `fs/mcp/stdio/module.f.ts` on the imported `errorResponseOf`.
- [ ] `npx tsc` clean; `fjs t` passes (`fs/media/json/rpc/proof.f.ts`,
      `fs/mcp/proof.f.ts`).

### Related

- `fs/media/json/rpc/module.f.ts` — owner of the `Response` envelope.
- `fs/mcp/module.f.ts:240-244` — the duplicated private constructors.
- `fs/mcp/module.f.ts` `okResult`/`errorResult` — the same
  owner-exports-the-pair pattern, already applied to `ToolsCallResult`.
- [66D-mcp-validate-response-envelope](../../../mcp/todo/README.md) — builds
  its `validated` helper on top of these constructors.
