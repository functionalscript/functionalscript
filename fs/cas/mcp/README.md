# CAS MCP server

An [MCP](../../mcp/) front end for the content-addressable store ([`fs/cas`](../)).
It exposes the three `Cas<O>` operations as MCP tools, so an agent that speaks
MCP can store a blob and get back its hash, fetch a blob by hash, and enumerate
what is stored — without shelling out to the `cas` CLI.

The store (`fs/cas/module.f.ts`) stays transport-agnostic; this adapter is an
additional front end alongside the CLI `main`, exactly as the issue describes.

## The three tools

| Tool       | args                  | CAS call         | result text          |
|------------|-----------------------|------------------|----------------------|
| `cas_add`  | `{ content: string }` | `c.write(value)` | hash (cBase32)       |
| `cas_get`  | `{ hash: string }`    | `c.read(key)`    | content (base64)     |
| `cas_list` | `{}`                  | `c.list()`       | hashes, one per line |

Each tool's argument schema is an rtti struct declared once and used twice:
[`toJsonSchema`](../../json/schema/module.f.ts) derives the `inputSchema`
advertised in `tools/list`, and [`validate`](../../types/rtti/validate/module.f.ts)
decodes the `arguments` object in `tools/call`. There is no drift between what we
advertise and what we accept.

## Encoding split: hashes (cBase32) vs. content (base64)

`Cas<O>` deals in `Vec` (bit vectors); MCP models only `textContent` (a
`string`) today. Two encodings cross the protocol, each chosen for its consumer:

- **Hashes** travel as **cBase32** ([`fs/cbase32`](../../cbase32/module.f.ts)) —
  the canonical CAS hash format, shared with the CLI and the on-disk store
  layout. `cas_add` returns it; `cas_get` and the implicit `cas_list` output
  consume / produce it.
- **Content** travels as **standard RFC 4648 base64**
  ([`fs/base64`](../../base64/module.f.ts)) — the MCP-idiomatic encoding for
  opaque binary, which external tools and LLMs already understand without
  project-specific knowledge. `cas_add` takes it as input; `cas_get` returns it.

Both decoders return `null` on malformed input, giving free input validation.

The split was a deliberate revisit of the original "everything in cBase32"
choice (see [i66E-cas-mcp-base64-content](../../../issues/66E-cas-mcp-base64-content.md)):
hashes stay cBase32 because that is their canonical identity across the project,
while content switches to base64 so the MCP surface stays interoperable with the
broader ecosystem. A follow-up will use base64 again when an `EmbeddedResource`
`blob` content type lands (see
[i66E-cas-mcp-file-type](../../../issues/66E-cas-mcp-file-type.md)).

## Protocol errors vs. tool errors

MCP draws a line the dispatcher already respects:

- **Protocol failures** — an unknown method, or malformed params at the
  JSON-RPC layer — are JSON-RPC errors. [`mcpStep`](../../mcp/module.f.ts) handles
  those; this adapter never produces them.
- **Tool failures** are *not* JSON-RPC errors. They come back as a normal
  `tools/call` result with `isError: true` and a text explanation, so the model
  can read and react. This adapter returns an `isError` result for:
  - malformed `content` (base64 `decode` → `null`);
  - malformed `hash` (`cBase32ToVec` → `null`);
  - `cas_get` on an absent hash (`c.read` → `undefined`);
  - an unknown tool `name`.

This mirrors the CLI's distinction (`errorExit` for bad input vs. a real result)
but routed through MCP's in-band error channel.

## Running it

`casMcpServer(c)` allocates the session-state slot, builds the `mcpStep` for an
injected `Cas<O>`, and drives the stdio read → parse → dispatch → write loop
([`fs/mcp/stdio`](../../mcp/stdio/module.f.ts)) until stdin EOF. The `cas`
command (itself a subcommand of the `fjs` binary) exposes it as:

```
fjs cas mcp
```

which runs the server over a filesystem-backed CAS rooted at the current
directory (`MemOp | Fs` effects). Because the adapter is generic in `O`, the same
handlers run over an in-memory `Cas<MemOp>` in `proof.f.ts`, driven through a full
`initialize` → `notifications/initialized` → `tools/call` sequence with no live
process.
