# MIME detection

Magic-byte MIME type detection: the leading bytes of a `Vec` are eliminated
against one signature list. No I/O, no dependencies beyond
[`fjs/types/bit_vec`](../../types/bit_vec/).

```ts
import { detect } from './module.f.mjs'

detect(pngBytes)   // 'image/png'
detect(textBytes)  // null
```

## Why detect rather than store

The content-addressable store ([`fjs/cas`](../../cas/)) is type-agnostic by design —
it keeps raw bytes only, with no room for a per-blob type tag. Type is therefore
**recovered on read** by sniffing the content, not written on `cas_add`. This
keeps the store a pure `hash → bytes` map and confines all type knowledge to the
edge that needs it (the MCP adapter's `cas_get`).

## Recognised signatures

| MIME type         | Leading bytes                          |
|-------------------|----------------------------------------|
| `image/png`       | `89 50 4E 47 0D 0A 1A 0A`              |
| `image/jpeg`      | `FF D8 FF`                             |
| `image/gif`       | `47 49 46 38 37 61` / `…39 61` (`"GIF87a"` / `"GIF89a"`) |
| `image/webp`      | `52 49 46 46 .. .. .. .. 57 45 42 50` (`"RIFF"…"WEBP"`) |
| `application/pdf` | `25 50 44 46 2D` (`"%PDF-"`)           |
| `application/zip` | `50 4B 03 04` / `05 06` / `07 08` (`"PK"` entry, empty, or spanned) |

Anything else — text, unknown binary, or a `Vec` shorter than the signature it
might match — returns `null`. There is deliberately no text/`charset` fallback:
distinguishing UTF-8 from arbitrary bytes is not a magic-byte test, and the
caller's `null` branch already handles "treat as opaque/text".

WebP is the only non-contiguous signature: the four-byte little-endian file size
sits between the `RIFF` and `WEBP` markers, so its pattern carries four wildcard
bytes in that gap.

The table above is documentation; the signatures themselves are declared once, as
the `signatures` list in [`module.f.mjs`](./module.f.mjs). `detect` and the
streaming detector both eliminate against that one list through the same
`magicStep`, so adding or correcting a signature is a single edit.

## Streaming detector (`detectStream`)

`detectVec` classifies a whole blob held in a single `Vec`, which caps at
`maxLength` bits (128 KiB). For inspecting blobs of any size without buffering,
the module also exports `detectStream` — the streaming form of the **same
byte-accepting state machine**:

```ts
import { detectStream, detectVec, push, finish, detectInit } from './module.f.mjs'

// fold a CAS read stream (List<O, Vec, IoChannel>) into { length, mime_type, type }
detectStream(stream)            // Effect<O, DetectMeta, IoChannel>

// classify a whole Vec you already hold, through the same machine
detectVec(bytes)                // { length, mime_type, type }
// detectVec is just finish(push(detectInit)(bytes)); push/finish are exposed for
// driving the machine chunk-by-chunk directly.
```

`DetectState` is the product of three independent folds over the byte stream:

| factor  | what it does                                                        | absorbing                |
|---------|---------------------------------------------------------------------|--------------------------|
| length  | running byte count (`+chunkLen` per chunk)                          | never                    |
| magic   | signature elimination — the same `magicStep` `detect` folds with     | matched / dead (≤12 B)   |
| utf8    | UTF-8 validity-and-text DFA over `fjs/text/utf8`'s decoder            | invalid / non-text       |

`finish` reads the same three-way verdict as the pure path: magic hit → `base64`
+ detected mime; else whole-blob-valid UTF-8 **that is also all-text** → `text` +
`text/plain`; else `base64` + `application/octet-stream`. UTF-8 classification
must see **every** byte (a blob can be valid until its last byte), so a
leading-bytes buffer would be incorrect — only the streaming validator is.

The utf8 factor tracks two orthogonal verdicts: *valid* (well-formed UTF-8, the
decoding contract) and *text* (every decoded code point is a text code point per
`isTextCodePoint`, not a control byte). They are kept distinct because a
control-bearing blob is perfectly well-formed UTF-8 yet binary: a NUL run decodes
to U+0000 — "valid UTF-8" — but NUL is the sharpest binary marker, so it must
classify as `application/octet-stream`. C1 controls (`U+0080`–`U+009F`) arrive as
2-byte UTF-8 and are invisible at the byte level, so the check is at the code-point
level, after decoding. The whitespace controls `U+0009`–`U+000D` (TAB, LF, VT, FF,
CR) stay text.

`push` stops decoding and just counts length once the verdict is fixed. Because
`finish` ignores the utf8 factor when `magic` matched, a **matched** signature
fixes the verdict on its own — no need to keep validating UTF-8 over the tail (it
might stay valid forever, e.g. an ASCII PDF). A **dead** magic leaves text-vs-octet
open, so it fixes the verdict only once `utf8` can no longer be text — it reaches
its `invalid` sink **or** sees a control byte (both absorbing). Either way a large
blob costs ≈ length counting past the settling point.

### Why hand-rolled (for now)

`magic` and `utf8` are recognizers (`δ` step + `λ` verdict on the final state),
the exact shape a declarative BNF→DFA recognizer backend would generate — see
[`fjs/bnf` recognizer-backend](../../bnf/todo/recognizer-backend.md). That backend
does not exist yet, so the two factors are hand-written here: `magicStep` does
signature elimination over the `signatures` list and `utf8Step`
rides the existing `fjs/text/utf8` decoder. When the backend lands, these should
be lowered onto it; `length` (an FSM cannot count) and `finish` stay outside it
regardless. The factors are independent — adding a property (e.g. a streaming
SHA-256 for verify-on-read) is a new field, one `push` line, and one `finish`
clause, touching no existing transition.

## By extension (`detectPath`)

`detect` and `detectVec` answer "what are these bytes"; `detectPath` answers
"what does this file name claim to be", from the extension alone:

```ts
import { detectPath } from './module.f.mjs'

detectPath('index.html')   // 'text/html; charset=utf-8'
detectPath('logo.png')     // 'image/png'
detectPath('README')       // 'application/octet-stream'
```

Both questions have to be asked from somewhere, and neither answer substitutes
for the other. A server sending `Content-Type` needs the name: `text/html`,
`text/css` and `text/javascript` are byte-identical UTF-8 text, so no sniffer can
separate them, yet a browser treats them as three different things. Sniffing
stays the answer for stored bytes that carry no name at all, which is the CAS
case above.

The table is deliberately small — the types the pages under
[`fjs/website`](../../website/) are built from, plus the image formats the magic
bytes already recognize:

| extension | media type |
|-----------|------------|
| `.html`   | `text/html` |
| `.css`    | `text/css` |
| `.js`, `.mjs` | `text/javascript` |
| `.json`   | `application/json` |
| `.svg`    | `image/svg+xml` |
| `.png`    | `image/png` |
| `.jpg`, `.jpeg` | `image/jpeg` |
| `.gif`    | `image/gif` |
| `.webp`   | `image/webp` |
| `.wasm`   | `application/wasm` |
| `.txt`    | `text/plain` |

A `text/*` answer carries `; charset=utf-8`, so the result is a complete header
value; anything else — no extension, a leading-dot name, an extension not in the
table — is `application/octet-stream`.

## Consumers

- [`fjs/mcp/cas`](../../mcp/cas/) — `cas_get` classifies with the state machine on
  both paths: `detectStream` folds the read stream for the default metadata-only
  call (size-independent), and `detectVec` classifies the collected blob when
  `content: true` is requested, so the three-way verdict has a single
  implementation. The pure `detect` remains for callers that only need
  magic-byte sniffing over a `Vec` they already hold.
- [`fjs/web`](../../web/) — the static file server sends `detectPath` of the
  file it resolved as the response's `Content-Type`.
