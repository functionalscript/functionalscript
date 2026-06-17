# CAS MCP server

An [MCP](../../mcp/) front end for the content-addressable store ([`fs/cas`](../)).
It exposes `Cas<O>` operations as MCP tools, so an agent that speaks MCP can
store a blob and get back its hash, fetch a blob by hash, and enumerate what is
stored — without shelling out to the `cas` CLI.

The store (`fs/cas/module.f.ts`) stays transport-agnostic; this adapter is an
additional front end alongside the CLI `main`.

## Tools

| Tool       | args                                    | CAS call         | result                                    |
|------------|-----------------------------------------|------------------|-------------------------------------------|
| `cas_add`  | `{ content, type? }`                    | `c.write(value)` | hash (cBase32)                            |
| `cas_get`  | `{ hash, content?: boolean }`           | `c.read(key)`    | JSON `{length,mime_type,type[,url,content]}` |
| `cas_list` | `{}`                                    | `c.list()`       | hashes, one per line                      |

Each tool's argument schema is an rtti struct declared once and used twice:
[`toJsonSchema`](../../json/schema/module.f.ts) derives the `inputSchema`
advertised in `tools/list`, and [`validate`](../../types/rtti/validate/module.f.ts)
decodes the `arguments` object in `tools/call`. There is no drift between what we
advertise and what we accept.

## `cas_add`: text, base64, or file input

`cas_add` accepts a `type` field that controls how `content` is interpreted:

| `type` value        | `content` interpretation                          |
|---------------------|---------------------------------------------------|
| `'text'` (default)  | UTF-8 string — stored as raw UTF-8 bytes          |
| `'base64'`          | RFC 4648 base64 — decoded to bytes before store   |
| `'url'`             | Filesystem path — file is read and stored as-is   |

Omitting `type` defaults to `'text'`, so most agent-generated content (scripts,
JSON, prompts) can be stored without any encoding step. Pass `type: 'base64'`
for pre-encoded binary payloads, or `type: 'url'` to store a file directly from
the filesystem.

## `cas_get`: metadata + optional inline content

`cas_get` always returns a JSON object in a `text` block with metadata and
content type:

```json
{ "length": 42, "mime_type": "text/plain", "type": "text" }
```

When `content: true` is passed, the inline payload is also included:

```json
{ "length": 42, "mime_type": "text/plain", "type": "text", "content": "hello world\n" }
```

The `type` field (`'text'` or `'base64'`) is always present and lets the agent
decide whether to fetch the content without paying token cost for the bytes
themselves. The typical decision protocol:

1. Call `cas_get` (default `content: false`) — inspect `length`, `mime_type`,
   and `type`.
2. If `type: 'text'` and `length` is small → call again with `content: true`.
3. If `type: 'base64'` or `length` is large → use `url` from the response
   to download directly (when present; see below).

`url` is present only when the server was started with a `toUrl` resolver
(production filesystem-backed server); it is omitted in memory-backed contexts
such as tests.

### Content encoding (when `content: true`)

Two-phase MIME detection determines the encoding:

1. **Magic-byte sniffing** ([`fs/mime`](../../mime/module.f.ts) `detect`): if the
   leading bytes match a known signature (PNG, JPEG, GIF, WebP, PDF, ZIP),
   `content` is RFC 4648 base64 and `type` is `'base64'`.

2. **UTF-8 validation** ([`fs/text/utf8`](../../text/utf8/module.f.ts) `fromVec`):
   if the blob decodes as valid UTF-8, `content` is the decoded string and
   `type` is `'text'` with `mime_type: 'text/plain'`.

3. **Fallback**: bytes that pass neither test are returned as base64 with
   `mime_type: 'application/octet-stream'`.

Examples:

```json
{ "length": 12, "mime_type": "text/plain",               "type": "text",   "content": "hello world\n" }
{ "length": 10, "mime_type": "image/png",                 "type": "base64", "content": "iVBOR..."      }
{ "length":  4, "mime_type": "application/octet-stream",  "type": "base64", "content": "/v8A..."       }
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
  - invalid arguments to any tool (`validate` rejects the argument object);
  - `type: 'base64'` with malformed base64 `content` (`base64Decode` → `null`);
  - `type: 'url'` with an unreadable or missing file;
  - malformed `hash` (`cBase32ToVec` → `null`);
  - `cas_get` on an absent hash (`c.read` → `undefined`);
  - an unknown tool `name`.

## Running it

`casMcpServer(c)` allocates the session-state slot, builds the `mcpStep` for an
injected `Cas<O>`, and drives the stdio read → parse → dispatch → write loop
([`fs/mcp/stdio`](../../mcp/stdio/module.f.ts)) until stdin EOF.

Start the server without a local install using `npx`:

```sh
npx functionalscript cas mcp
```

Or, if `fjs` is already on your `PATH` (e.g. after `npm install -g functionalscript`):

```sh
fjs cas mcp
```

### Store location

Blobs are stored under **`~/.cas/`** (the user's home directory as returned by
`os.homedir()`). Each blob is written to a two-level sharded path derived from
its cBase32 hash:

```
~/.cas/<AB>/<CD>/<rest-of-hash>
```

where `AB`, `CD`, and `<rest-of-hash>` are the first two, next two, and
remaining characters of the cBase32 hash. The `url` field returned by
`cas_get` contains the full absolute path to the blob file.

### Testing without a live process

Because the adapter is generic in `O`, the same handlers run over an
in-memory `Cas<MemOp>` in `proof.f.ts`, driven through a full
`initialize` → `notifications/initialized` → `tools/call` sequence with no live
process.
