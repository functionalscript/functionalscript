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

The `fs/media/type` detector knows nothing about CBOR. A CBOR
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
when the tier-2 validation falls through. The tier-2 refinement is the same
size-bounded decode + schema validation as the tagged-JSON path; blobs beyond
the size bound keep the generic tier-1 verdict.

#### 2. Dialect-tagged CBOR — the binary analog of tagged-JSON detection

The tagged-JSON convention carries over: an FS-designed CBOR format is a CBOR map
carrying the text key `"dialect"` with a text-string value. Detection is
semantic, matching the JSON path — no entry-order assumption, no byte-level
signature: within the size-bounded path (the 128 KiB inline cap — a limit of the
buffering decoder, not of the format), decode the blob as CBOR, transparently
unwrapping an optional tier-1 tag-55799 prefix. If the result is a map whose
`dialect` value grammar-checks (each `+`-separated segment an RFC 6838
restricted-name) and is allowlisted (`vnd.fjs.*`), validate the map against the
named dialect's schema (never a blind echo; the derivation is structurally
safe — any value yields an `application/*+cbor` type) →
`application/{dialect}+cbor`; otherwise fall through. Any CBOR map that
satisfies a dialect's schema is detected as that dialect, whatever its entry
order or encoding details.

The non-settling requirement is therefore **not** limited to tier-1 tag
matches. A canonical FS blob carries no wrapper (see the producer rule below),
so its first byte is an ordinary CBOR header (e.g. a map header such as
`0xA4`): no magic signature matches and the UTF-8 factor goes invalid almost
immediately — exactly the state today's `isSettled`
(`fs/media/type/module.f.ts`) treats as terminal `application/octet-stream`,
which would freeze the verdict before this tier ever decodes the buffer. Tier 2
must add a detector factor that keeps such streams unsettled — buffering up to
the 128 KiB cap — until the CBOR decode + schema validation succeeds or
definitively fails; only on a failed decode, a non-validating value, or a blob
exceeding the cap does the verdict fall back to `application/octet-stream` (or
generic `application/cbor` on a tier-1 tag match).

**Encoding rule for producers** (to be stated in the format specs): FS-produced
tagged CBOR MUST use RFC 8949 §4.2 core deterministic encoding (definite
lengths, keys in deterministic bytewise order) and no tag-55799 wrapper — the
dialect entry already identifies the blob, and the canonical bytes must not
fork on an optional prefix. Detection does not depend on entry order, so no
deviation from §4.2 ordering is needed. The wrapper is an input-side allowance
for externally produced blobs: the [`fs/media/cbor` codec](cbor.md) accepts and
transparently unwraps it, so a self-described dialect blob still
schema-validates.

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

- [ ] Add the tag-55799 prefix (`0xD9 0xD9 0xF7`) to the `fs/media/type` magic table →
      `application/cbor`, `type: 'base64'` — as a **non-settling** signature:
      `isSettled` must not treat this match as terminal, and `finish` checks the
      tier-2 dialect probe before emitting the generic verdict; proof cases
      including a tagged blob split across chunks and a tag-wrapped dialect map
      that must report the derived type, not generic `application/cbor`
- [ ] Specify the FS canonical tagged-CBOR form: RFC 8949 §4.2 core
      deterministic encoding (definite lengths, deterministic key order), no
      tag-55799 wrapper
- [ ] Implement tier 2: size-bounded (128 KiB inline cap) CBOR decode, with and
      without the tier-1 tag prefix; on a map, decode the `dialect` value,
      grammar-check `+`-separated segments, allowlist `vnd.fjs.*`, validate
      against the dialect's schema — no entry-order or byte-signature
      assumptions → `application/{dialect}+cbor`. Includes a tier-2 detector
      factor keeping **every** stream unsettled up to the size cap — not only
      tag-55799 matches: an unwrapped canonical dialect map (first byte an
      ordinary CBOR header, magic dead, UTF-8 invalid) must not settle as
      `application/octet-stream` before the decode runs; the fallback verdict
      applies only after a failed decode, a non-validating value, or the cap
      being exceeded — proof cases covering the unwrapped canonical map
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
- [fs/media/type detect-json](../type/todo/detect-json.md) — the JSON refinement of
  the same detector; tier 3 would be its CBOR sibling
- [fs/media/json streaming-recognizer](../json/todo/streaming-recognizer.md) —
  the payload-free recognizer pattern a tier-3 CBOR recognizer would follow
- `fs/media/type/module.f.ts` — the magic table (tier 1) and `detectStream` (tiers 2–3)
  this lands in
