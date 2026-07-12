# CAS MCP server

An [MCP](../../mcp/) front end for the content-addressable store ([`fs/cas`](../)).
It exposes `Cas<O>` operations as MCP tools, so an agent that speaks MCP can
store a blob and get back its hash, fetch a blob by hash, and enumerate what is
stored — without shelling out to the `cas` CLI.

The store (`fs/cas/module.f.ts`) stays transport-agnostic; this adapter is an
additional front end alongside the CLI `main`.

`casMcpServer(c)` allocates the session-state slot, builds the `mcpStep` for an
injected `Cas<O>`, and drives the stdio read → parse → dispatch → write loop
([`fs/mcp/stdio`](../../mcp/stdio/module.f.ts)) until stdin EOF.

## Running it

Register the CAS MCP server command with your LLM client:

```sh
npx functionalscript m
```

Follow your LLM client's instructions to register that command as an MCP server.
For example:

```sh
# register the MCP for Claude
claude mcp add cas -- npx functionalscript m
# register the MCP for Codex
codex mcp add cas -- npx functionalscript m
```

This command uses `npx` to run the latest version of [FunctionalScript](https://www.npmjs.com/package/functionalscript), downloading it on startup if needed.

You can now ask questions like:
- "Show all records in CAS"
- "What's stored in the content-addressable store?"
- "List the available CAS hashes"

Your client will use the `cas_add`, `cas_get`, and `cas_list` tools to interact with your CAS instance.

## Tools

| Tool       | args                                    | CAS call         | result                                    |
|------------|-----------------------------------------|------------------|-------------------------------------------|
| `cas_add`  | `{ content, type? }`                    | `c.write(value)` | hash (cBase32)                            |
| `cas_get`  | `{ hash, content?: boolean }`           | `c.read(key)`    | JSON `{length,mimeType,type[,uri][,text\|blob]}` |
| `cas_list` | `{}`                                    | `c.list()`       | hashes, one per line                      |

Each tool's argument schema is an rtti struct declared once and used twice:
[`toJsonSchema`](../../media/json/schema/module.f.ts) derives the `inputSchema`
advertised in `tools/list`, and [`validate`](../../types/rtti/validate/module.f.ts)
decodes the `arguments` object in `tools/call`. There is no drift between what we
advertise and what we accept.

## `cas_add`: text or base64 input

`cas_add` accepts a `type` field that controls how `content` is interpreted:

| `type` value        | `content` interpretation                          |
|---------------------|---------------------------------------------------|
| `'text'` (default)  | UTF-8 string — stored as raw UTF-8 bytes          |
| `'base64'`          | RFC 4648 base64 — decoded to bytes before store   |

Omitting `type` defaults to `'text'`, so most agent-generated content (scripts,
JSON, prompts) can be stored without any encoding step. Pass `type: 'base64'`
for pre-encoded binary payloads.

Inline content (`text`/`base64`) resolves into a single `Vec`, which caps at
`maxLength` bits — **128 KiB**. Content that is malformed or exceeds this limit
returns `isError` with a descriptive message pointing at the CLI. There is no
MCP route to store a larger blob — run `npx functionalscript cas add <path>`
instead, either yourself (if you're an agent with shell access) or by giving
the user that exact command to run; it stores the file directly from the
caller's own filesystem and prints the resulting hash. A future `type` may add
a *remote* `http(s)://` URL fetch, downloaded server-side into the store with
no local-path involved; see the design invariant below.

## `cas_get`: metadata + optional inline content

The response fields mirror the MCP resource-contents shape (`resources/read`
results — `uri`, `mimeType`, `text` / `blob`), so the tool view and the future
resource view of the same blob share one vocabulary and a client can move
between them without translation. `type` and `length` are additional fields
alongside that shape — MCP allows extra fields — and `type` stays present even
in the metadata-only response as the discriminator for which of `text` /
`blob` a later `content: true` fetch would populate.

`cas_get` always returns a JSON object in a `text` block with metadata and
content type:

```json
{ "length": 42, "mimeType": "text/plain", "type": "text" }
```

When `content: true` is passed, the inline payload is also included — as
`text` for `type: 'text'`, or `blob` for `type: 'base64'`:

```json
{ "length": 42, "mimeType": "text/plain", "type": "text", "text": "hello world\n" }
```

The `type` field (`'text'` or `'base64'`) is always present and lets the agent
decide whether to fetch the content without paying token cost for the bytes
themselves. The typical decision protocol:

1. Call `cas_get` (default `content: false`) — inspect `length`, `mimeType`,
   and `type`.
2. If `type: 'text'` and `length` is small → call again with `content: true`.
3. If `type: 'base64'` or `length` is large → use `uri` from the response
   to download directly (when present; see below).

`uri` is present only when the server was started with a `toUrl` resolver
(production filesystem-backed server); it is omitted in memory-backed contexts
such as tests.

### Metadata is size-independent (the default `content: false`)

The metadata-only call **never buffers the blob**. It folds the CAS read stream
through [`fs/media/type`](../../media/type/module.f.ts) `detectStream` — a byte-accepting
state machine (running byte count × magic-byte signature eliminator × UTF-8
validity DFA) that derives `{ length, mimeType, type }` in O(1) space. The
detector stops decoding once the verdict is fixed — a magic match settles it
immediately, otherwise once UTF-8 turns invalid — so a large blob costs ≈ length
counting past that point.

This matters because a single `Vec` cannot exceed `maxLength` bits (128 KiB), so
the old "drain the whole blob into one `Vec`" approach failed on any blob larger
than one read chunk — *even with `content: false`*, the exact case where the
caller wants only the metadata. Inspecting a blob's size and type is now
independent of its size: a multi-megabyte blob returns its metadata, never an
error. UTF-8 classification is a true streaming validator, so a blob that is
valid UTF-8 until a trailing invalid byte is correctly classified as `base64`
(a leading-bytes buffer could not decide this).

### Content encoding (when `content: true`)

Only the `content: true` path materializes the bytes (bounded by `maxLength`). It
classifies them with the **same** detector — [`fs/media/type`](../../media/type/module.f.ts)
`detectVec`, the single-`Vec` form of the `detectStream` machine above — so the
three-way verdict is computed in exactly one place, never re-derived from a
parallel `detect` + UTF-8 check. The `type` then selects whether the inline
payload lands in `text` or `blob`:

1. **Magic-byte hit** (PNG/JPEG/GIF/WebP/PDF/ZIP) → `type: 'base64'`, `blob` is
   RFC 4648 base64.
2. **Whole-blob-valid UTF-8** → `type: 'text'`, `mimeType: 'text/plain'`, and
   `text` is the decoded string ([`fs/text/utf8`](../../text/utf8/module.f.ts)
   `fromVec`, used here purely as the decoder).
3. **Fallback** → `type: 'base64'`, `mimeType: 'application/octet-stream'`,
   `blob` is base64.

### Inline-content size limit (`content: true`)

The inline-content path buffers the whole blob into a single `Vec`, which caps at
`maxLength` bits — **128 KiB**. A blob larger than that cannot be fetched inline.
Because the size and type are derived first with the size-independent
`detectStream` machine (the same one the metadata path uses), an oversized blob is
*not* misreported as absent: it returns `isError` with a distinct message naming
the byte size and pointing at the alternatives, e.g.

```
blob too large to fetch inline (262144 bytes, limit 131072 bytes); use the uri field (…) or omit content for metadata
```

So `no such hash` means the hash genuinely is not in the store, while the message
above means the blob exists but exceeds the inline limit — fetch it via `uri`, or
call `cas_get` without `content: true` for size-independent metadata.

Examples:

```json
{ "length": 12, "mimeType": "text/plain",               "type": "text",   "text": "hello world\n" }
{ "length": 10, "mimeType": "image/png",                 "type": "base64", "blob": "iVBOR..."      }
{ "length":  4, "mimeType": "application/octet-stream",  "type": "base64", "blob": "/v8A..."       }
```

## Encoding split: hashes (cBase32) vs. content

`Cas<O>` deals in `Vec` (bit vectors); MCP models only `textContent` today.
Hashes travel as **cBase32** ([`fs/basen/cbase32`](../../basen/cbase32/module.f.ts)) — the
canonical CAS hash format shared with the CLI and the on-disk store layout.
Content encoding is determined at read time as described above.

## Protocol errors vs. tool errors

MCP draws a line the dispatcher already respects:

- **Protocol failures** — unknown method, malformed JSON-RPC params — are
  JSON-RPC errors. [`mcpStep`](../../mcp/module.f.ts) handles those.
- **Tool failures** come back as a normal `tools/call` result with
  `isError: true` and a text explanation. This adapter returns `isError` for:
  - invalid arguments to any tool (`validate` rejects the argument object);
  - inline `content` that is malformed or exceeds 128 KiB (`tryUtf8` / `base64Decode` → `null`);
  - malformed `hash` (`cBase32ToVec` → `null`);
  - `cas_get` on an absent hash (`c.read` → `undefined`);
  - `cas_get` with `content: true` on a blob larger than the inline limit
    (distinct "too large" message — see above — not "no such hash");
  - an unknown tool `name`.

## Design invariant: the server never opens a client-named local path

> The MCP server only ever touches paths under `~/.cas/`, and every such path
> is one the server derives itself — never a path supplied (in whole or in
> part) by the client.

Every server file operation is on a self-derived path: `cas_add` writes via
staging under `~/.cas/_stage/` then renames to the hash-sharded `~/.cas/<shard>`;
`cas_get` reads `~/.cas/<shard>`; `cas_list` walks `~/.cas/`. The client
contributes *content* (`text`/`base64` bytes) and *hashes* (validated cBase32,
which only ever select a shard path and can't escape the store), but never a
filesystem path.

This tool previously accepted `type: 'url'`, a client-supplied path within
`$HOME/cas_upload/` that the server opened on the client's behalf. That was
removed because a writable staging directory is exactly the sandbox an
attacker who controls the MCP client could plant a symlink in
(`cas_upload/x -> /etc/passwd`), and no purely-TypeScript check — leaf
`O_NOFOLLOW`, `realpath` containment, or both together — closes every race
and directory-symlink variant; the only airtight fix (per-component
`openat()` pinning) isn't reachable without a native addon. Large files now
go through the `cas` CLI instead (`npx functionalscript cas add <path>`),
where the person running it *is* the user, not a sandboxed model, so
following a symlink they planted themselves is ordinary `cat`/`cp` behavior,
not a sandbox escape.

Treat this as the acceptance test for any tool added later: it's safe on this
axis iff it never opens, reads, writes, or renames a path derived from client
input. A future *remote* `http(s)://` URL fetch would satisfy it — the server
downloads into `~/.cas/_stage/`, a self-derived path, and the client-supplied
part is a URL handed to the network stack, never the filesystem.

### Store location

Blobs are stored under **`~/.cas/`** (the user's home directory as returned by
`os.homedir()`). Each blob is written to a two-level sharded path derived from
its cBase32 hash:

```
~/.cas/<AB>/<CD>/<rest-of-hash>
```

where `AB`, `CD`, and `<rest-of-hash>` are the first two, next two, and
remaining characters of the cBase32 hash. The `uri` field returned by
`cas_get` contains the full absolute path to the blob file.

### Testing without a live process

Because the adapter is generic in `O`, the same handlers run over an
in-memory `Cas<MemOp>` in `proof.f.ts`, driven through a full
`initialize` → `notifications/initialized` → `tools/call` sequence with no live
process.
