## MCP methods not yet served

**Priority:** P3
**Status:** open

### Problem

[MCP](https://modelcontextprotocol.io/) (Model Context Protocol) is a thin
protocol over JSON-RPC 2.0: every message is a JSON-RPC request, notification,
or response, with an MCP-specific `method` and payload. This module serves the
minimal subset a tool server needs, and the rest of the protocol is unserved.

What has landed, and where it is documented:

- the JSON-RPC 2.0 envelope — `fjs/protocol/json_rpc/module.f.mjs`;
- the lifecycle and capability state machine — `initialize`,
  `notifications/initialized`, `ping`, the not-initialized guard and
  capability-gated routing, with protocol-version negotiation — in `mcpStep`'s
  JSDoc in [`../module.f.mjs`](../module.f.mjs);
- `tools/list` and `tools/call`, with `text` and embedded-resource content;
- the stdio transport — [`../stdio/module.f.mjs`](../stdio/module.f.mjs);
- the rtti → JSON Schema printer that derives a tool's `inputSchema` —
  `fjs/media/json/schema/module.f.mjs`.

What remains is the rest of the protocol.

### Proposal

Each item below is independently buildable and may become its own issue.

- **Schemas** (rtti, one declaration → runtime decoder via `parse` + static
  type via `Ts<>`):
  - **Resources:** `resources/list`, `resources/read`,
    `resources/templates/list`, `resources/subscribe` / `unsubscribe`,
    `notifications/resources/list_changed`, `notifications/resources/updated`.
  - **Prompts:** `prompts/list`, `prompts/get`,
    `notifications/prompts/list_changed`.
  - **Logging / progress / cancellation:** `logging/setLevel`,
    `notifications/message`, `notifications/progress`,
    `notifications/cancelled`.
  - **Tools:** `notifications/tools/list_changed`.
  - **Content types:** the `image` and `audio` variants of `contentItem`, and
    resource links.
  - **Capabilities:** the rest of the capability objects negotiated in
    `initialize` (`resources`, `prompts`, `logging`, `completions`,
    `sampling`, `roots`), which gate the methods above.
- **Streamable HTTP transport** — a single endpoint, client→server `POST` plus
  an optional server→client SSE stream, over `createServer` / `listen` in
  `fjs/effects/node`.
- **Bidirectional requests (server → client).** Some MCP features invert
  direction: the server calls the client — `sampling/createMessage` and
  `roots/list`. The dispatcher must support both directions (a peer is
  simultaneously a server and a client), not just server-answers-request.

### Open questions

- **rtti ↔ JSON Schema fidelity.** Which rtti constructs map cleanly to JSON
  Schema, and what is unrepresentable in each direction? Do we generate JSON
  Schema from rtti (preferred — describe tools once), accept raw JSON Schema,
  or both?
- **Spec coverage order.** Resources, prompts, and logging after the minimal
  initialize + tools subset; the order among them is not decided.

### Tasks

- [ ] Resources, prompts, and logging schemas and their `mcpStep` arms.
- [ ] The remaining content types and capability objects.
- [ ] Streamable HTTP transport.
- [ ] Bidirectional (sampling / roots) support.

### Related

- [validated-envelope.md](./validated-envelope.md) — the per-method
  parse→error/ok envelope every new method arm will repeat until it is shared.
- [effectful-dispatch-skeleton](../../json_rpc/todo/effectful-dispatch-skeleton.md)
  — envelope routing shared with the pure JSON-RPC dispatcher, worth doing if
  more JSON-RPC-based servers appear.
- [`fjs/mcp/todo/remote-url.md`](../../../mcp/todo/remote-url.md) — the CAS
  server's plan to serve blobs as resources, the first consumer of the
  resource schemas.
- `fjs/rtti/module.f.mjs` — schema combinators; `fjs/rtti/ts/` is the
  precedent for a printer.
- [Model Context Protocol](https://modelcontextprotocol.io/) ·
  [JSON-RPC 2.0](https://www.jsonrpc.org/specification)
