## Require an `outputSchema` for every tool

**Priority:** P3
**Status:** open

### Problem

MCP lets a tool declare the JSON Schema of its result as an optional
`outputSchema` in its `tools/list` descriptor, and answer a matching
`structuredContent` from `tools/call`. The protocol does not require it, and
nothing here provides it: the `tool` descriptor schema in
[`../module.f.mjs`](../module.f.mjs) has `name`, `description` and
`inputSchema` only, and `toolEntry` takes an rtti schema for a tool's input but
none for its output. So a client cannot learn what shape a tool answers, and a
handler's result is checked against no declared type.

The protocol leaves the output schema optional; tools built with this module
should be required to declare one, the same way they already declare their
input.

### Proposal

`toolEntry` takes an output rtti schema beside `inputRtti`, derives the
descriptor's `outputSchema` from it with `toJsonSchema` as it does
`inputSchema`, and types the handler's structured result as `Ts<>` of it.

### Tasks

- [ ] Add `outputSchema` to the `tool` descriptor schema and `structuredContent`
      to `toolsCallResult`.
- [ ] Make `toolEntry` require an output schema; migrate the tool registries in
      `fjs/mcp/cas` and `fjs/mcp/evo`.
- [ ] `tsc`, `fjs test`.

### Related

- [roadmap.md](./roadmap.md) — the rest of the protocol this module does not
  serve yet.
- [Model Context Protocol](https://modelcontextprotocol.io/) — tools,
  `outputSchema` and `structuredContent`.
