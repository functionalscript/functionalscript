## detect-cbor. Detect CBOR content

**Priority:** P3
**Status:** open

Detection (this todo) and the CBOR codec itself ([cbor.md](cbor.md), the
`fs/media/cbor` serializer/parser) are two different tasks: tier 1 below needs no
CBOR machinery at all, while tiers 2–3 consume the codec once it lands.

### Problem

CBOR (RFC 8949) is the designated binary counterpart of the FS dialect scheme: it is
the only binary JSON-family encoding with both a registered media type
(`application/cbor`) and a registered structured-syntax suffix (`+cbor`, plus
`+cbor-seq` for sequences, RFC 8742). The dialect naming rule
(see [fs/todo group-fs-subdirectories-by-concern](../../todo/group-fs-subdirectories-by-concern.md))
therefore extends mechanically to a binary encoding: the same encoding-neutral
dialect name is served as `application/{dialect}+json` when the blob is JSON and
`application/{dialect}+cbor` when the blob is CBOR — the suffix names the
encoding, the dialect names the format, and a system that does not know the
dialect still has the correct generic fallback per encoding (`application/json` /
`application/cbor`).

The `fs/mime` detector (the future `media/type/`) knows nothing about CBOR. A CBOR
blob is binary, so today it falls through to `application/octet-stream`, and a
dialect-tagged CBOR blob cannot be recognized or served with its derived media
type the way tagged JSON can (see
[fs/cas revision-content-format](../../cas/todo/revision-content-format.md),
the tagged-JSON detection convention).

### Proposal

Recognize CBOR in three tiers, most reliable first. Tiers 1–2 are signature-based
and cheap; tier 3 is structural and deliberately deferred.

#### 1. Self-described CBOR — a true magic-byte signature

RFC 8949 §3.4.6 defines tag 55799 as CBOR's magic number: the encoded tag is the
byte prefix `0xD9 0xD9 0xF7`, chosen so it is not valid UTF-8 and collides with no
known format. A blob starting with it is CBOR by declaration → `application/cbor`,
`type: 'base64'`.

Unlike the existing magic entries, though, this signature must **not settle** the
detector: a tag-55799-wrapped dialect map (tier 2) starts with the same three
bytes, and an early-exit magic hit (`isSettled` treating `matched` as terminal,
magic-first `finish`) would freeze the verdict at generic `application/cbor`
before the dialect probe ever sees the map. The rule: tier 2 is checked
**before** the tier-1 verdict — generic `application/cbor` is the answer only
when no dialect signature follows the tag, or when the tier-2 validation falls
through. The cost of keeping the verdict open is bounded: deciding whether a
dialect map follows takes at most the map header (≤ 9 bytes) plus the 8-byte
key; the full dialect decode + schema validation is the same 128 KiB
size-bounded refinement as the tagged-JSON path.

#### 2. Dialect-tagged CBOR — the binary analog of `{"dialect":"` prefix matching

The tagged-JSON convention carries over: an FS-designed CBOR format is a CBOR map
whose **first** entry is the text key `"dialect"` with a text-string value. The
signature is a definite-length map header followed immediately by the fixed key
bytes `0x67 'd' 'i' 'a' 'l' 'e' 'c' 't'`, optionally preceded by the tag-55799
prefix from tier 1. The header is not a single fixed byte: it is `0xA0+n` for
n < 24 entries, or `0xB8`/`0xB9`/`0xBA`/`0xBB` followed by 1/2/4/8 length bytes
for larger maps — so the detector parses the header (at most 9 bytes, a bounded
decode, not a fixed-offset compare) and then matches the key. Still a cheap
prefix check, just header-aware, and it accepts every valid FS-produced map size
rather than only maps with fewer than 24 entries. On a hit: decode the
dialect value, grammar-check each `+`-separated segment as an RFC 6838
restricted-name, and apply the same allowlist + schema-validation +
128 KiB size-bound rules as the JSON path (never a blind echo; the derivation is
structurally safe — any value yields an `application/*+cbor` type) →
`application/{dialect}+cbor`; otherwise fall through.

**Encoding rule for producers** (to be stated in the format specs): FS-produced
tagged CBOR MUST use definite lengths with the `dialect` entry first, and no
tag-55799 wrapper — the dialect signature already identifies the blob, and the
canonical bytes must not fork on an optional prefix. The wrapper is an
input-side allowance for externally produced blobs: the
[`fs/media/cbor` codec](cbor.md) accepts and transparently unwraps it, so a
self-described dialect blob still schema-validates. Note that
RFC 8949 §4.2 core deterministic encoding sorts map keys by the bytewise order of
their encodings — shorter keys sort first, ties by content. The `revision` schema
happens to satisfy "dialect first" under that order (no key is shorter than 7
chars, and `dialect` is bytewise-first among the 7-char keys), but that is luck,
not a guarantee: any future dialect with a shorter key (or a 7-char key starting
`a`–`c`) would displace it. The FS canonical form is therefore **dialect-first,
remaining keys in RFC 8949 deterministic order** — a documented, deliberate
deviation from pure §4.2 ordering, in exchange for a stable detection prefix.

#### 3. Generic untagged CBOR — deferred

A bare CBOR item without tier 1/2 markers has no signature, and structural
detection is false-positive-prone by construction: almost any short byte string
decodes as *some* valid CBOR item (every byte `0x00`–`0x17` alone is a valid
unsigned integer). A trustworthy verdict needs a streaming, payload-free CBOR
recognizer (accept/reject, O(depth), the analog of
[fs/media/json streaming-recognizer](../json/todo/streaming-recognizer.md)) plus a
policy gate like detect-json's "object/array top level only" — e.g. accept only a
single complete map/array item spanning the whole blob. Out of scope for the first
iteration; without it, untagged CBOR stays `application/octet-stream`, which is
the honest answer.

### Tasks

- [ ] Add the tag-55799 prefix (`0xD9 0xD9 0xF7`) to the `fs/mime` magic table →
      `application/cbor`, `type: 'base64'` — as a **non-settling** signature:
      `isSettled` must not treat this match as terminal, and `finish` checks the
      tier-2 dialect probe before emitting the generic verdict; proof cases
      including a tagged blob split across chunks and a tag-wrapped dialect map
      that must report the derived type, not generic `application/cbor`
- [ ] Specify the FS canonical tagged-CBOR form: definite lengths, `dialect`
      entry first, remaining keys in RFC 8949 §4.2 order; document the deliberate
      deviation from pure deterministic ordering and the reason (stable prefix)
- [ ] Implement tier 2: parse the definite-length map header (`0xA0`–`0xB7`
      immediate, `0xB8`–`0xBB` with 1/2/4/8 length bytes — not a fixed-offset
      compare) and match the `"dialect"` key right after it (with and
      without the tier-1 tag prefix), decode the dialect value, grammar-check
      `+`-separated segments, allowlist `vnd.fjs.*`, validate against the
      dialect's schema, size-bounded to the 128 KiB inline cap →
      `application/{dialect}+cbor`
- [ ] Surface the derived type in `cas_get` / resource read alongside the JSON
      path (same rules, different suffix); extend the optional `dialect`
      field/header to CBOR blobs — see
      [fs/cas/mcp cas-get-mcp-resource-response](../../cas/mcp/todo/cas-get-mcp-resource-response.md)
- [ ] Decide per dialect what CBOR-only values (bigint, byte strings, non-string
      keys) are admitted beyond the JSON data model — each dialect's README owns
      this; the JSON-compatible subset is the default
- [ ] Later: the tier-3 streaming CBOR recognizer and its top-level policy gate,
      as a separate todo when generic CBOR detection is actually needed

### Related

- [cbor.md](cbor.md) — the `fs/media/cbor` serializer/parser this detection
  consumes (tier 2 decodes the dialect entry and validates the map; tier 3 would
  share the codec's grammar payload-free)
- [fs/todo group-fs-subdirectories-by-concern](../../todo/group-fs-subdirectories-by-concern.md)
  — the dialect naming rule and fall-back chain convention this extends to a
  binary encoding
- [fs/cas revision-content-format](../../cas/todo/revision-content-format.md) —
  the tagged-JSON detection convention tier 2 mirrors, and the serving rules
  (allowlist, schema validation, size bound) it reuses
- [fs/mime detect-json](../../mime/todo/detect-json.md) — the JSON refinement of
  the same detector; tier 3 would be its CBOR sibling
- [fs/media/json streaming-recognizer](../json/todo/streaming-recognizer.md) —
  the payload-free recognizer pattern a tier-3 CBOR recognizer would follow
- `fs/mime/module.f.ts` — the magic table (tier 1) and `detectStream` (tiers 2–3)
  this lands in
