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
| `cas_get`  | `{ hash: string }`    | `c.read(key)`    | content (cBase32)    |
| `cas_list` | `{}`                  | `c.list()`       | hashes, one per line |

Each tool's argument schema is an rtti struct declared once and used twice:
[`toJsonSchema`](../../json/schema/module.f.ts) derives the `inputSchema`
advertised in `tools/list`, and [`validate`](../../types/rtti/validate/module.f.ts)
decodes the `arguments` object in `tools/call`. There is no drift between what we
advertise and what we accept.

## Content encoding (cBase32)

`Cas<O>` deals in `Vec` (bit vectors); MCP models only `textContent` (a
`string`) today. Both hash and content cross the protocol as **cBase32**
([`fs/cbase32`](../../cbase32/module.f.ts)) — the same encoding the CLI uses for
hashes:

- `cas_add` takes cBase32 `content` → `Vec` → store → returns the cBase32 hash;
- `cas_get` takes a cBase32 `hash` → `Vec` key → read → returns cBase32 content.

This keeps a single encoding across the whole CAS surface (the CLI and MCP
agree), and `cBase32ToVec` already returns `null` on malformed input, giving free
input validation.

Alternatives considered: base64 (MCP-idiomatic for binary, but a second encoding
the project does not otherwise use), or adding a `blob`/`resource` content type
to `fs/mcp` so binary need not be text-shoehorned. Both are follow-ups; cBase32
is the minimal, consistent start.

## Protocol errors vs. tool errors

MCP draws a line the dispatcher already respects:

- **Protocol failures** — an unknown method, or malformed params at the
  JSON-RPC layer — are JSON-RPC errors. [`mcpStep`](../../mcp/module.f.ts) handles
  those; this adapter never produces them.
- **Tool failures** are *not* JSON-RPC errors. They come back as a normal
  `tools/call` result with `isError: true` and a text explanation, so the model
  can read and react. This adapter returns an `isError` result for:
  - malformed `content` / `hash` (`cBase32ToVec` → `null`);
  - `cas_get` on an absent hash (`c.read` → `undefined`);
  - an unknown tool `name`.

This mirrors the CLI's distinction (`errorExit` for bad input vs. a real result)
but routed through MCP's in-band error channel.

## Running it

`casMcpServer(c)` allocates the session-state slot, builds the `mcpStep` for an
injected `Cas<O>`, and drives the stdio read → parse → dispatch → write loop
([`fs/mcp/stdio`](../../mcp/stdio/module.f.ts)) until stdin EOF. The CLI exposes
it as a subcommand:

```
cas mcp
```

which runs the server over a filesystem-backed CAS rooted at the current
directory (`MemOp | Fs` effects). Because the adapter is generic in `O`, the same
handlers run over an in-memory `Cas<MemOp>` in `proof.f.ts`, driven through a full
`initialize` → `notifications/initialized` → `tools/call` sequence with no live
process.
