# MIME detection

Magic-byte MIME type detection: a pure table lookup over the leading bytes of a
`Vec`. No I/O, no dependencies beyond [`fs/types/bit_vec`](../types/bit_vec/).

```ts
import { detect } from './module.f.ts'

detect(pngBytes)   // 'image/png'
detect(textBytes)  // null
```

## Why detect rather than store

The content-addressable store ([`fs/cas`](../cas/)) is type-agnostic by design —
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
sits between the `RIFF` and `WEBP` markers, so it is matched as a prefix plus a
second marker at byte offset 8.

## Streaming detector (`detectStream`)

`detectVec` classifies a whole blob held in a single `Vec`, which caps at
`maxLength` bits (128 KiB). For inspecting blobs of any size without buffering,
the module also exports `detectStream` — the streaming form of the **same
byte-accepting state machine**:

```ts
import { detectStream, detectVec, push, finish, detectInit } from './module.f.ts'

// fold a CAS read stream (List<O, IoResult<Vec>>) into { length, mime_type, type }
detectStream(stream)            // Effect<O, IoResult<DetectMeta>>

// classify a whole Vec you already hold, through the same machine
detectVec(bytes)                // { length, mime_type, type }
// detectVec is just finish(push(detectInit)(bytes)); push/finish are exposed for
// driving the machine chunk-by-chunk directly.
```

`DetectState` is the product of three independent folds over the byte stream:

| factor  | what it does                                                        | absorbing                |
|---------|---------------------------------------------------------------------|--------------------------|
| length  | running byte count (`+chunkLen` per chunk)                          | never                    |
| magic   | signature elimination — the streaming form of the table above       | matched / dead (≤12 B)   |
| utf8    | UTF-8 validity DFA over `fs/text/utf8`'s decoder                     | invalid                  |

`finish` reads the same three-way verdict as the pure path: magic hit → `base64`
+ detected mime; else whole-blob-valid UTF-8 → `text` + `text/plain`; else
`base64` + `application/octet-stream`. UTF-8 classification must see **every**
byte (a blob can be valid until its last byte), so a leading-bytes buffer would
be incorrect — only the streaming validator is. Once both `magic` and `utf8`
reach absorbing states, `push` skips per-byte work and just counts length, so a
large blob costs ≈ length counting.

### Why hand-rolled (for now)

`magic` and `utf8` are recognizers (`δ` step + `λ` verdict on the final state),
the exact shape a declarative BNF→DFA recognizer backend would generate — see
[`fs/bnf` recognizer-backend](../bnf/todo/recognizer-backend.md). That backend
does not exist yet, so the two factors are hand-written here: `magicStep` does
signature elimination (the streaming form of the table above) and `utf8Step`
rides the existing `fs/text/utf8` decoder. When the backend lands, these should
be lowered onto it; `length` (an FSM cannot count) and `finish` stay outside it
regardless. The factors are independent — adding a property (e.g. a streaming
SHA-256 for verify-on-read) is a new field, one `push` line, and one `finish`
clause, touching no existing transition.

## Consumers

- [`fs/cas/mcp`](../cas/mcp/) — `cas_get` classifies with the state machine on
  both paths: `detectStream` folds the read stream for the default metadata-only
  call (size-independent), and `detectVec` classifies the collected blob when
  `content: true` is requested, so the three-way verdict has a single
  implementation. The pure `detect` remains for callers that only need
  magic-byte sniffing over a `Vec` they already hold.
