# Evo MCP tools

MCP tool definitions for the Evo API ([`fs/cas/evo`](../)): subjects and
revision heads over the content-addressable store ([`fs/cas`](../../)),
backed by the in-memory cache the core module maintains.

These tools are not their own server. They are served by the same process as
`cas_add`/`cas_get`/`cas_list`: [`fs/cas/mcp`](../../mcp/) builds one
`Evo<O>` from its own `Cas<O>` and cache slot (`initEvo`, scanned once at
startup), concatenates `evoToolRegistry` onto its own tool registry, and
serves everything — one `~/.cas/` store, one Evo cache, one server, one
`npx functionalscript m`. See [`fs/cas/mcp/README.md`](../../mcp/README.md)
for how to run it and register it with an MCP client.

## Tools

| Tool       | args                                             | action        | result                    |
|------------|--------------------------------------------------|---------------|---------------------------|
| `evo_list` | `{}`                                              | `e.list()`    | subjects, one per line    |
| `evo_head` | `{ subject }`                                     | `e.head(...)` | head hashes, one per line |
| `evo_add`  | `{ parents, snapshot?, subject?, archived? }`     | `e.add(...)`  | hash (cBase32)            |

Each tool's argument schema is an rtti struct declared once and used twice:
[`toJsonSchema`](../../../media/json/schema/module.f.ts) derives the
`inputSchema` advertised in `tools/list`, and
[`validate`](../../../types/rtti/validate/module.f.ts) decodes the
`arguments` object in `tools/call` — the same pattern as
[`fs/cas/mcp`](../../mcp/).

## Errors

- Invalid `arguments` (rtti `validate` rejects the object, e.g. a missing
  `parents`) → `isError`, reported by the shared `toolEntry` machinery before
  the domain logic runs.
- A domain-level `evo_add` failure — an unresolvable `subject`, an invalid
  `vnd.fjs.revision` (see [`fs/media/revision`](../../../media/revision/)),
  a blob too large to encode, or a store write failure — → `isError` with the
  message from `Evo.add`'s `Result`.

## Testing without a live process

`evoToolRegistry` is generic in the store's operation type `O` and takes a
plain `Evo<O>`, so `proof.f.ts` exercises each tool entry's `handle` directly
against an in-memory `Evo` — no MCP session or live process required.
