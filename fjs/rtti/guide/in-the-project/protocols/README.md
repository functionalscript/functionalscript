# Protocols

**Status:** implemented

The messages the repository exchanges with a peer are schemas, so one
declaration is both the decoder and the static type:

- the JSON-RPC 2.0 envelopes, in
  [`protocol/json_rpc`](../../../../protocol/json_rpc/module.f.mjs);
- the MCP messages, in [`protocol/mcp`](../../../../protocol/mcp/module.f.mjs);
- the arguments of the MCP tools the repository serves, in
  [`mcp/cas`](../../../../mcp/cas/module.f.mjs) and
  [`mcp/evo`](../../../../mcp/evo/module.f.mjs). A tool's argument schema is
  both the `inputSchema` the server advertises, through
  [`toJsonSchema`](../../outputs/json-schema/README.md), and the check its
  arguments pass.

A message read from a peer is read with `parse`: what comes in is rebuilt to
the schema. The envelopes say `open`, so a peer on a later protocol revision
can add members ([open containers](../../schemas/open-containers/README.md)); a
tool's arguments are closed, because the server defines that vocabulary.

## Examples

The demo on this page offers four schemas: a JSON-RPC request, an MCP tool,
and the arguments of `cas_add` and `evo_add`, each shown as the import that
brings it in and with a value it accepts. They are defined in
[`sample.f.mjs`](./sample.f.mjs), and the
[module page's demo](../../../README.md) lists them among all the others.

## Where it is implemented

The modules linked above.
