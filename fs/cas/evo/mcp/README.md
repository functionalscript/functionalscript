# Evo MCP server

An [MCP](../../../mcp/) front end for the Evo API ([`fs/cas/evo`](../)):
subjects and revision heads over the content-addressable store
([`fs/cas`](../../)), backed by the in-memory cache the core module
maintains.

## Running it

Register the Evo MCP server command with your LLM client:

```sh
npx functionalscript v
```

Follow your LLM client's instructions to register that command as an MCP
server. For example:

```sh
# register the MCP for Claude
claude mcp add cas-evo -- npx functionalscript v
# register the MCP for Codex
codex mcp add cas-evo -- npx functionalscript v
```

Your client will use the `evo_list`, `evo_head`, and `evo_add` tools to
interact with your CAS's subjects and revisions.

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

## Startup: one scan, then cache-only reads

`evoMcpServer` scans the whole store once at startup (`initEvo`, see
[`fs/cas/evo`](../)) to build the subject/head cache, then serves every
`tools/call` request off that cache: `evo_list`/`evo_head` never touch the
store, and `evo_add` updates both the store and the cache in one step —
there is no per-request rescan.

## Errors

- Invalid `arguments` (rtti `validate` rejects the object, e.g. a missing
  `parents`) → `isError`, reported by the shared `toolEntry` machinery before
  the domain logic runs (same as `fs/cas/mcp`).
- A domain-level `evo_add` failure — an unresolvable `subject`, an invalid
  `vnd.fjs.revision` (see [`fs/media/revision`](../../../media/revision/)),
  a blob too large to encode, or a store write failure — → `isError` with the
  message from `Evo.add`'s `Result`.
- An unknown tool `name` → `isError`.

## Testing without a live process

Like [`fs/cas/mcp`](../../mcp/), the adapter is generic in the store's
operation type `O`; `proof.f.ts` drives the handlers through a full
`initialize` → `notifications/initialized` → `tools/call` sequence over an
in-memory virtual filesystem, no live process required.
