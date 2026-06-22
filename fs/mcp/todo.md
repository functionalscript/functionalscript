# TODO

## 66D-mcp-validate-response-envelope. `mcp`: share the validate→error/ok response envelope

**Priority:** P3
**Status:** open

### Problem

`fs/mcp/module.f.ts`'s `mcpStep` request handler repeats the same
"validate the params, branch to an error or success response" envelope in
every method arm. The shape is always:

```ts
const [t, pr] = validate(<schema>)(<params>)
return t === 'error'
    ? pure(_errResponse(id)(invalidParams))
    : <success using pr>
```

It appears four times in `mcpStep` (in `fs/mcp/module.f.ts`):

- `ping` — `validate(_noParams)(params)`, success is `pure(_okResponse(id)({}))`.
- `initialize` — `validate(initializeParams)(params)`, success builds an
  `InitializeResult` and writes state.
- `tools/list` — `validate(toolsListParams)(params === undefined ? {} : params)`,
  success is `handlers.toolsList(pr).step(r => pure(_okResponse(id)(r)))`.
- `tools/call` — `validate(toolsCallParams)(params)`, success is
  `handlers.toolsCall(pr).step(r => pure(_okResponse(id)(r)))`.

Note: `toolEntry` (line 178) was added as a helper for registering tool handlers
with pre-validated arguments, but `mcpStep` itself still repeats the inline
validate→error/ok pattern for `ping`, `initialize`, `tools/list`, and `tools/call`.

On top of that, `tools/list` and `tools/call` share a **second** layer that is
near-identical, differing only in the schema, the params-defaulting, and which
handler runs:

```ts
// tools/list
if (capabilities.tools === undefined) {
    return pure(_errResponse(id)(methodNotFound))
}
const [t, pr] = validate(toolsListParams)(params === undefined ? {} : params)
return t === 'error'
    ? pure(_errResponse(id)(invalidParams))
    : handlers.toolsList(pr).step(r => pure(_okResponse(id)(r)))

// tools/call
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

### Proposal

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

### Why this is filed at P3 (not lower)

Unlike the borderline P5 "two tiny functions differ in one slot" cleanups, this
is a four-way repetition in a handler that is the natural growth point for the
protocol: i665-mcp's roadmap adds `resources/*`, `prompts/*`, and `logging/*`
methods, every one of which will repeat the same validate→error/ok envelope. The
abstraction pays for itself the moment the next method lands, and prevents the
handler from accreting a dozen copies of the same ternary.

### Tasks

- [ ] Add a module-scope (or `mcpStep`-local) `validated` helper threading `id`;
      rewrite `ping`, `initialize`, `tools/list`, `tools/call` to use it.
- [ ] Add `toolMethod` for the capability-gated `tools/*` pair.
- [ ] Confirm `fs/mcp/proof.f.ts` still passes (`fjs t`) with full branch
      coverage (both `error` and `ok` sides of each method) and `npx tsc` is clean.

### Related

- [i665-mcp](todo.md) — the MCP roadmap; the methods it enumerates
  (`resources/*`, `prompts/*`, `logging/*`) are the second-and-beyond consumers
  that make this extraction worth doing now rather than later.

---

## 665-mcp. Building blocks to describe and serve MCP

**Priority:** P3
**Status:** open

### Goal

Inventory everything needed to **describe** [MCP](https://modelcontextprotocol.io/)
(Model Context Protocol) in FunctionalScript and serve it. This is a scoping /
roadmap issue: it decomposes "an MCP server" into independently-buildable pieces,
several of which become their own issues. It is not a full design of each piece.

MCP is a thin protocol over JSON-RPC 2.0: every message is a JSON-RPC request,
notification, or response, with an MCP-specific `method` and payload. So the work
splits into "the JSON-RPC envelope" (already scoped) and "the MCP-specific layers
on top."

### Building blocks

#### 1. JSON-RPC 2.0 layer — landed in `fs/json/rpc/module.f.ts`

The envelope: request / notification / response / error schemas, decoders, and the
pure dispatcher. MCP rides directly on this.

#### 2. MCP message schemas (rtti)

The method-specific payloads, described as rtti schemas (one declaration → runtime
decoder via `validate` + static type via `Ts<>`). A representative subset:

- **Lifecycle:** `initialize` (params: `protocolVersion`, `capabilities`,
  `clientInfo`; result: `protocolVersion`, `capabilities`, `serverInfo`,
  optional `instructions`), `notifications/initialized`, `ping`.
- **Capabilities:** the client/server capability objects negotiated in
  `initialize` (`tools`, `resources`, `prompts`, `logging`, `completions`,
  `sampling`, `roots`) — these gate which methods are valid.
- **Tools:** `tools/list` (result: `tools[]` = name, description, `inputSchema`),
  `tools/call` (params: name, arguments; result: `content[]`, `isError`),
  `notifications/tools/list_changed`.
- **Resources:** `resources/list`, `resources/read`,
  `resources/templates/list`, `resources/subscribe` / `unsubscribe`,
  `notifications/resources/list_changed`, `notifications/resources/updated`.
- **Prompts:** `prompts/list`, `prompts/get`,
  `notifications/prompts/list_changed`.
- **Logging / progress / cancellation:** `logging/setLevel`,
  `notifications/message`, `notifications/progress`, `notifications/cancelled`.
- **Content types:** the union used in tool/prompt/resource results —
  `text`, `image`, `audio`, embedded `resource` (and resource links).

#### 3. rtti → JSON Schema printer — landed in `fs/json/schema/module.f.ts`

MCP declares each tool's `inputSchema` as **JSON Schema**, not TypeScript. rtti
today only prints to TypeScript (`fs/types/rtti/ts/`, `toTs`). To describe a tool
*once* in rtti and expose it over MCP, `toJsonSchema` maps an rtti `Type` to a
JSON Schema object — analogous to `toTs` but emitting `{ type, properties,
required, items, … }`. This is the main capability MCP needs that JSON-RPC does
not.

#### 4. Lifecycle / capability state machine

A session is a state machine: the peer must `initialize` (negotiating
`protocolVersion` and capabilities) before any other method; capabilities gate
which methods are accepted. The dispatcher from i665 needs an initialization
guard and capability-aware routing on top.

#### 5. Transports

MCP defines transports the pure layers plug into (built on `fs/effects/node`):

- **stdio** — newline-delimited JSON over stdin / `write` (the common local case).
- **Streamable HTTP** — single endpoint, client→server `POST` plus an optional
  server→client SSE stream, over `createServer` / `listen`.

Transport framing is out of scope for the schema/dispatch work and is its own
follow-up. Start with stdio.

#### 6. Bidirectional requests (server → client)

Some MCP features invert direction: the server calls the client —
`sampling/createMessage` and `roots/list`. The dispatcher must support both
directions (a peer is simultaneously a server and a client), not just
server-answers-request.

### Open questions

- **rtti ↔ JSON Schema fidelity.** Which rtti constructs map cleanly to JSON
  Schema, and what is unrepresentable in each direction? Do we generate JSON
  Schema from rtti (preferred — describe tools once), accept raw JSON Schema, or
  both?
- **Protocol version.** MCP revises its version string; pin a supported set and
  decide how to negotiate / reject.
- **Transport order.** stdio first (simplest, local); Streamable HTTP later.
- **Spec coverage.** Target a minimal viable subset (initialize + tools) first,
  then resources / prompts / logging.
- **`id` / number handling.** Inherit the JSON-RPC layer's decision.

### Suggested decomposition (future issues)

1. MCP core schemas + lifecycle (initialize, capabilities, ping, tools).
2. stdio transport over `fs/effects/node`.
3. resources / prompts / logging schemas.
4. Streamable HTTP transport.
5. bidirectional (sampling / roots) support.

### Related

- `fs/json/rpc/module.f.ts` — the JSON-RPC 2.0 envelope
- `fs/json/schema/module.f.ts` — rtti → JSON Schema printer
- `fs/types/rtti/module.f.ts` — schema combinators; `fs/types/rtti/ts/` is the precedent for a printer
- `fs/effects/node/module.f.ts` — stdio (`write` / stdin) and HTTP (`createServer` / `listen`) for transports
- [Model Context Protocol](https://modelcontextprotocol.io/) · [JSON-RPC 2.0](https://www.jsonrpc.org/specification)

---

