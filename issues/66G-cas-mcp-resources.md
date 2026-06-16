# 66G-cas-mcp-resources. Consider MCP resources instead of tools for CAS read operations

**Priority:** P4
**Status:** open

## Problem

`cas_get` and `cas_list` are currently implemented as MCP tools, but MCP has a
first-class **resource** abstraction (`resources/read`, `resources/list`,
`resources/templates/list`) designed for exactly this use case: read-only,
addressable content identified by a URI. Forcing CAS content through the tool
channel loses semantic information that MCP clients can use (inline preview,
download, MIME-aware rendering).

## Proposal

Evaluate replacing the read-side CAS tools with MCP resources:

| Current tool  | MCP resource equivalent          |
|---------------|----------------------------------|
| `cas_list`    | `resources/list` — each hash is a resource URI |
| `cas_get`     | `resources/read` — fetch by `cas://<hash>` URI |

`cas_add` and `cas_add_url` remain tools (writes have no resource equivalent).
`cas_get_url` is also a write-adjacent operation (it exposes a local path) and
may stay a tool.

Resource URIs would follow the scheme `cas://<cBase32-hash>`, making them
self-describing and globally addressable within a session.

### Benefits

- Clients that support `resources/read` can display content inline (text) or
  offer a download (binary) without the model re-reading the bytes.
- `resources/list` gives clients a browsable index without a tool call.
- MIME type is a first-class field on a resource descriptor, so the inference
  work from [i66G-cas-mcp-text-content](./66G-cas-mcp-text-content.md) has a
  natural home.
- Aligns with MCP intent: tools are for actions, resources are for content.

### Concerns

- Not all MCP clients implement `resources/*`; tools are universally supported.
  Dropping `cas_get` entirely would break clients that lack resource support.
- The asymmetry (add = tool, get = resource) may confuse agent prompts.
- `fs/mcp/module.f.ts` does not yet model `resources/*` message types; adding
  them is non-trivial protocol surface.

### Options

1. **Resources only** — remove `cas_get` / `cas_list` tools, expose only
   `resources/read` and `resources/list`. Requires client resource support.
2. **Resources + tools** — keep tools for compatibility, add resources as a
   richer parallel interface. Doubles the surface.
3. **Tools only (status quo)** — keep the current design; close this issue if
   no client integration demands resources.

## Tasks

- [ ] Survey which MCP clients used with FunctionalScript (Claude Desktop, Codex
      Desktop) implement `resources/*` and how they surface resources to the user.
- [ ] Decide between the three options above.
- [ ] If resources are chosen: model `resources/list`, `resources/read`, and
      `resources/templates/list` in `fs/mcp/module.f.ts`.
- [ ] Implement `casResourceHandlers` in `fs/cas/mcp/module.f.ts` if applicable.

## Related

- [i66G-cas-mcp-url-tools](./66G-cas-mcp-url-tools.md) — `cas_get_url` raised
  the tools-vs-resources question; this issue owns the decision.
- [i66G-cas-mcp-text-content](./66G-cas-mcp-text-content.md) — MIME inference
  work that resources would benefit from directly.
- [i66E-mcp-cas-server](./66E-mcp-cas-server.md) — original tool-only design.
- `fs/mcp/module.f.ts` — protocol core; `resources/*` handlers would be added here.
