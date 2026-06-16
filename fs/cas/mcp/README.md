# CAS MCP server

An [MCP](../../mcp/) front end for the content-addressable store ([`fs/cas`](../)).
It exposes `Cas<O>` operations as MCP tools, so an agent that speaks MCP can
store a blob and get back its hash, fetch a blob by hash, and enumerate what is
stored — without shelling out to the `cas` CLI.

The store (`fs/cas/module.f.ts`) stays transport-agnostic; this adapter is an
additional front end alongside the CLI `main`.

## Tools

| Tool           | args                                    | CAS call           | result                         |
|----------------|-----------------------------------------|--------------------|--------------------------------|
| `cas_add`      | `{ content, type? }`                    | `c.write(value)`   | hash (cBase32)                 |
| `cas_get`      | `{ hash: string }`                      | `c.read(key)`      | JSON `{content,type,mime_type}`|
| `cas_list`     | `{}`                                    | `c.list()`         | hashes, one per line           |
| `cas_add_url`  | `{ url: string }`                       | `c.write(value)`   | hash (cBase32)                 |
| `cas_get_meta` | `{ hash: string }`                      | `c.read(key)`      | JSON `{length,mime_type[,url]}`|

Each tool's argument schema is an rtti struct declared once and used twice:
[`toJsonSchema`](../../json/schema/module.f.ts) derives the `inputSchema`
advertised in `tools/list`, and [`validate`](../../types/rtti/validate/module.f.ts)
decodes the `arguments` object in `tools/call`. There is no drift between what we
advertise and what we accept.

## `cas_add`: text or base64 input

`cas_add` accepts a `type` field that controls how `content` is interpreted:

| `type` value        | `content` interpretation                       |
|---------------------|------------------------------------------------|
| `'text'` (default)  | UTF-8 string — stored as raw UTF-8 bytes       |
| `'base64'`          | RFC 4648 base64 — decoded to bytes before store|

Omitting `type` defaults to `'text'`, so most agent-generated content (scripts,
JSON, prompts) can be stored without any encoding step. Pass `type: 'base64'`
for pre-encoded binary payloads.

## `cas_get`: smart text/binary output

`cas_get` always returns a JSON object in a `text` block:

```json
{ "content": "<value>", "type": "text"|"base64", "mime_type": "<mime>" }
```

The encoding is determined by two-phase MIME detection on the retrieved bytes:

1. **Magic-byte sniffing** ([`fs/mime`](../../mime/module.f.ts) `detect`): if the
   leading bytes match a known signature (PNG, JPEG, GIF, WebP, PDF, ZIP),
   `content` is RFC 4648 base64 and `type` is `'base64'`.

2. **UTF-8 validation** ([`fs/text/utf8`](../../text/utf8/module.f.ts) `fromVec`):
   if the blob decodes as valid UTF-8 with no error code points, surrogates, or
   out-of-range values, `content` is the decoded string and `type` is `'text'`
   with `mime_type: 'text/plain'`.

3. **Fallback**: bytes that pass neither test are returned as base64 with
   `mime_type: 'application/octet-stream'`.

Examples:

```json
{ "content": "hello world\n", "type": "text",   "mime_type": "text/plain" }
{ "content": "iVBOR...",       "type": "base64", "mime_type": "image/png"  }
{ "content": "/v8A...",        "type": "base64", "mime_type": "application/octet-stream" }
```

## Encoding split: hashes (cBase32) vs. content

`Cas<O>` deals in `Vec` (bit vectors); MCP models only `textContent` today.
Hashes travel as **cBase32** ([`fs/cbase32`](../../cbase32/module.f.ts)) — the
canonical CAS hash format shared with the CLI and the on-disk store layout.
Content encoding is determined at read time as described above.

## Protocol errors vs. tool errors

MCP draws a line the dispatcher already respects:

- **Protocol failures** — unknown method, malformed JSON-RPC params — are
  JSON-RPC errors. [`mcpStep`](../../mcp/module.f.ts) handles those.
- **Tool failures** come back as a normal `tools/call` result with
  `isError: true` and a text explanation. This adapter returns `isError` for:
  - `type: 'base64'` with malformed base64 `content`;
  - malformed `hash` (`cBase32ToVec` → `null`);
  - `cas_get` on an absent hash (`c.read` → `undefined`);
  - an unknown tool `name`.

## Running it

`casMcpServer(c)` allocates the session-state slot, builds the `mcpStep` for an
injected `Cas<O>`, and drives the stdio read → parse → dispatch → write loop
([`fs/mcp/stdio`](../../mcp/stdio/module.f.ts)) until stdin EOF. The `cas`
command exposes it as:

```
fjs cas mcp
```

which runs the server over a filesystem-backed CAS rooted at the current
directory. Because the adapter is generic in `O`, the same handlers run over an
in-memory `Cas<MemOp>` in `proof.f.ts`, driven through a full
`initialize` → `notifications/initialized` → `tools/call` sequence with no live
process.
