## cbor. A CBOR serializer/parser: `fs/media/cbor`

**Priority:** P3
**Status:** open

The codec (this todo) and CBOR *detection*
([detect-cbor.md](detect-cbor.md)) are two different tasks: this one builds the
pure `fs/media/cbor` module; detection consumes it (tiers 2–3) from the
`fs/media/type` classifier.

### Problem

CBOR (RFC 8949) is the designated binary counterpart of the FS dialect scheme
(registered `application/cbor` media type, registered `+cbor` suffix — see
[fs/todo group-fs-subdirectories-by-concern](../../todo/group-fs-subdirectories-by-concern.md)):
a dialect-tagged blob is served as `application/{dialect}+cbor` exactly as its
JSON twin is served as `application/{dialect}+json`. Nothing in the repo can
read or write CBOR, so binary-encoded FS formats cannot exist: no encoder to
produce them, no decoder for schema validation, nothing for
[detect-cbor](detect-cbor.md) tier 2 to decode a dialect entry with, and no
grammar for a future tier-3 recognizer to share.

By the `fs/media/` membership rule the codec belongs here: `media/cbor/`
implements content whose identity is the media type `application/cbor`, a
sibling of `media/json/` — same bucket, same reasons, different encoding.

### Proposal

Create `fs/media/cbor/` following the `fs/media/json/` layout: a root
`module.f.ts` re-exporting the pieces, `serializer/` (value → bytes) and
`parser/` (bytes → value) submodules with their `proof.f.ts` tests, and a
README specifying the data-model mapping. Pure functions only, no store access,
no effects; errors as result values, not exceptions — matching the sibling
modules. (No `tokenizer/`: CBOR items are self-delimiting binary, so the
byte-level item reader plays the tokenizer's role inside `parser/`.)

#### Data model

Start with the JSON-compatible subset plus what FS already needs beyond it:

| CBOR (RFC 8949)                     | FS value                          |
| ----------------------------------- | --------------------------------- |
| major 0/1 (int) within safe range   | `number`                          |
| major 0/1 outside safe range        | `bigint`                          |
| tags 2/3 (bignum)                   | `bigint`                          |
| major 7 float                       | `number`                          |
| `false`/`true`/`null`               | same                              |
| major 3 (text string, valid UTF-8)  | `string`                          |
| major 4 (array)                     | array                             |
| major 5 (map, text keys only)       | object                            |
| major 2 (byte string)               | later — needs an FS `Vec` mapping |

`bigint` is required from the start: DJS adds `bigint` to JSON, and CBOR
represents it natively — the pairing is the point of having a binary encoding.
Everything else CBOR allows (non-text map keys, `undefined`, simple values,
other tags, indefinite lengths on decode) is **rejected** in the first
iteration: a small, closed model keeps encode/decode a lossless round trip and
keeps schema validation meaningful. One exception: a single leading tag 55799
(self-described CBOR, [detect-cbor](detect-cbor.md) tier 1) on the top-level
item is accepted and **transparently unwrapped** — it is an encoding marker,
not data, and a self-described dialect blob that passes the tier-2 prefix check
must not then fail schema validation on the wrapper alone. Extensions widen the table deliberately,
per dialect (each dialect's README owns what it admits beyond the JSON model).

#### Serializer: canonical by construction

One encoding, not options:

- RFC 8949 §4.2 core deterministic encoding — shortest-form integer heads,
  definite lengths only, no duplicate keys;
- the FS canonical tagged form from [detect-cbor.md](detect-cbor.md) §2 on top:
  when the value carries a `dialect` entry, that entry is encoded **first** and
  the remaining keys follow in §4.2 bytewise order — the documented deviation
  from pure §4.2 sorting that buys a stable detection prefix;
- no tag-55799 wrapper: the canonical form is the bare item (the dialect
  signature already identifies FS blobs, and canonical bytes must not fork on
  an optional wrapper — the parser accepts the tag on input, but a wrapped blob
  is non-canonical).

A canonical-only serializer makes "same value ⇒ same bytes ⇒ same CAS hash"
hold by construction — in a content-addressed store the encoder *is* the
identity function, so encoding options would silently fork identities.

#### Parser: strict, bounded, total

- reject non-well-formed items, trailing bytes after the single top-level item,
  duplicate map keys, invalid UTF-8 in text strings, and (first iteration)
  everything outside the data-model table above — after transparently unwrapping
  an optional single leading tag 55799;
- a max-depth cap as a DoS guard, like the JSON recognizer's
  ([fs/media/json streaming-recognizer](../json/todo/streaming-recognizer.md));
- decoding does **not** require canonical input (a synced blob from elsewhere
  may be valid CBOR without being FS-canonical); an `isCanonical` check is a
  separate predicate so consumers that need identity guarantees (CAS dedup,
  detect-cbor's prefix assumption) can enforce it explicitly.

### Tasks

- [ ] Create `fs/media/cbor/README.md` — the data-model mapping table, the
      canonical-form rules (§4.2 + dialect-first), and the strictness rules
- [ ] `fs/media/cbor/serializer/module.f.ts` — canonical encoder over the
      data-model subset, `bigint` included; proof cases against the RFC 8949
      Appendix A test vectors that fall inside the model
- [ ] `fs/media/cbor/parser/module.f.ts` — strict decoder (well-formedness,
      single item, no duplicate keys, UTF-8-valid text, depth cap), result-typed
      errors; proof cases including truncated items, trailing bytes, duplicate
      keys, indefinite lengths (rejected), a tag-55799-wrapped item (accepted,
      unwrapped, reported non-canonical), and round trips through the serializer
- [ ] `isCanonical` predicate (or a decode flag reporting canonicity) for
      consumers that require byte-identity
- [ ] Root `fs/media/cbor/module.f.ts` re-exporting serializer/parser and the
      `application/cbor` constant; reference the module from `fs/media` docs
- [ ] Unblock [detect-cbor](detect-cbor.md) tier 2: expose a way to decode just
      the leading `dialect` entry within the 128 KiB bound
- [ ] Later: byte strings (major 2) once an FS `Vec` mapping is decided; a
      payload-free O(depth) recognizer sharing this grammar (detect-cbor tier 3)

### Related

- [detect-cbor.md](detect-cbor.md) — detection; consumes this codec in tiers 2–3
- [fs/todo group-fs-subdirectories-by-concern](../../todo/group-fs-subdirectories-by-concern.md)
  — the dialect naming rule and the `fs/media/` membership rule placing the codec
- [fs/cas revision-content-format](../../cas/todo/revision-content-format.md) —
  the tagged-format convention whose binary twin this enables
- `fs/media/json/` (`serializer/`, `parser/`, `tokenizer/`) — the sibling module
  whose layout and purity conventions this follows
- [fs/media/json streaming-recognizer](../json/todo/streaming-recognizer.md) —
  the payload-free recognizer pattern for the future tier-3 sibling
