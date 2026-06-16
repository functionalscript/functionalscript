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
| `image/gif`       | `47 49 46 38` (`"GIF8"`, covers 87a/89a) |
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

## Consumers

- [`fs/cas/mcp`](../cas/mcp/) — `cas_get` calls `detect` on the retrieved bytes
  and returns an MCP `EmbeddedResource` (with `mimeType`) when a type is
  recognised, falling back to a plain text block on `null`.
