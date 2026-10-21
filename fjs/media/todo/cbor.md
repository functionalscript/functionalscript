## cbor. A CBOR serializer/parser: `fjs/media/cbor`

**Priority:** P3
**Status:** wip — a draft pull request holds the task; the implementation design below awaits the owner's decisions D1 to D9

The codec (this todo) and CBOR *detection*
([detect-cbor.md](../type/todo/detect-cbor.md)) are two different tasks: this one builds the
pure `fjs/media/cbor` module; detection consumes it (tiers 2–3) from the
`fjs/media/type` classifier.

### Problem

CBOR (RFC 8949) is the designated binary counterpart of the FJS dialect scheme
(registered `application/cbor` media type, registered `+cbor` suffix — see
[fjs/media/README.md](../README.md#dialects)):
a dialect-tagged blob is served as `application/{dialect}+cbor` exactly as its
JSON twin is served as `application/{dialect}+json`. Nothing in the repo can
read or write CBOR, so binary-encoded FJS formats cannot exist: no encoder to
produce them, no decoder for schema validation, nothing for
[detect-cbor](../type/todo/detect-cbor.md) tier 2 to decode tagged blobs with, and no
grammar for a future tier-3 recognizer to share.

By the `fjs/media/` membership rule the codec belongs here: `media/cbor/`
implements content whose identity is the media type `application/cbor`, a
sibling of `media/json/` — same bucket, same reasons, different encoding.

### Proposal

Create `fjs/media/cbor/` following the `fjs/media/json/` layout: a root
`module.f.mjs` re-exporting the pieces, `serializer/` (value → bytes) and
`parser/` (bytes → value) submodules with their `proof.f.mjs` tests, and a
README specifying the data-model mapping. Pure functions only, no store access,
no effects; errors as result values, not exceptions — matching the sibling
modules. (No `tokenizer/`: CBOR items are self-delimiting binary, so the
byte-level item reader plays the tokenizer's role inside `parser/`.)

#### Data model

Start with the JSON-compatible subset plus what FJS already needs beyond it:

| CBOR (RFC 8949)                     | FJS value                          |
| ----------------------------------- | ---------------------------------- |
| major 0/1 (int) within safe range   | `number`                           |
| major 0/1 outside safe range        | `bigint`                           |
| tags 2/3 (bignum)                   | `bigint`                           |
| major 7 float                       | `number`                           |
| `false`/`true`/`null`               | same                               |
| major 3 (text string, valid UTF-8)  | `string`                           |
| major 4 (array)                     | array                              |
| major 5 (map, text keys only)       | object                             |
| major 2 (byte string)               | later — needs an FJS `Vec` mapping |

`bigint` is required from the start: DJS adds `bigint` to JSON, and CBOR
represents it natively — the pairing is the point of having a binary encoding.
Everything else CBOR allows (non-text map keys, `undefined`, simple values,
other tags, indefinite lengths on decode) is **rejected** in the first
iteration: a small, closed model keeps encode/decode a lossless round trip and
keeps schema validation meaningful. One exception: a single leading tag 55799
(self-described CBOR, [detect-cbor](../type/todo/detect-cbor.md) tier 1) on the top-level
item is accepted and **transparently unwrapped** — it is an encoding marker,
not data, and a self-described dialect blob must not fail tier-2 schema
validation on the wrapper alone. Extensions widen the table deliberately,
per dialect (each dialect's README owns what it admits beyond the JSON model).

#### Serializer: canonical by construction

One encoding, not options:

- RFC 8949 §4.2 core deterministic encoding — shortest-form integer heads,
  definite lengths only, no duplicate keys, keys in §4.2 bytewise order
  (detection is semantic — [detect-cbor.md](../type/todo/detect-cbor.md) §2 — so no
  entry-order deviation is needed) — **with one deliberate exception, D3**: a
  `bigint` is always a bignum, where the RFC's preferred serialization writes an
  integer that fits major 0 or 1 as such. The encoding is therefore the **FJS
  deterministic profile**, and says so wherever it is named; an encoder that
  follows §4.2 to the letter writes different bytes for `5n`. Under the
  alternative answer to D3 (below) the exception goes and this is §4.2 as it
  stands;
- no tag-55799 wrapper: the canonical form is the bare item (the dialect
  entry already identifies FJS blobs, and canonical bytes must not fork on
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
  ([fjs/media/json streaming-recognizer](../json/todo/streaming-recognizer.md));
- decoding does **not** require canonical input (a synced blob from elsewhere
  may be valid CBOR without being FJS-canonical); an `isCanonical` check is a
  separate predicate so consumers that need identity guarantees (CAS dedup)
  can enforce it explicitly.

### Implementation design

Proposed, not decided: [Decisions for the owner](#decisions-for-the-owner) lists
what the owner settles before the code that depends on it is written.

#### Layout and API

```text
fjs/media/cbor/
  README.md              the data-model mapping, canonical rules, strictness rules
  module.f.mjs           serialize, parse, isCanonical, mediaType
  types.ts               Value (the extended JSON tree), Bytes, Error
  float/                 IEEE 754 half, single and double: bits <-> number
  serializer/            Value -> bytes
  parser/                bytes -> Value
```

```js
serialize:   (value: Value) => Result<List<number>, string> // bytes, lazy; refuses a lone surrogate or nesting past maxDepth
parse:       (bytes: List<number>) => Result<Value, string>  // strict, bounded, total over byte lists
isCanonical: (bytes: List<number>) => boolean
mediaType = 'application/cbor'
```

`Value` is the tree of [`fjs/media/json/extended`](../json/extended/types.ts)
(`null`, booleans, `string`, `number | bigint`, arrays, objects): the same
**type** as the JSON twin's, and the same value only for the values **both**
codecs accept and keep. Each side takes values the other does not: the JSON
serializer writes `NaN`, `Infinity` and `-Infinity` as `null`, as
`JSON.stringify` does, where CBOR keeps them as floats (`f97e00`, `f97c00`,
`f9fc00`); and the JSON serializer spells a lone surrogate, which CBOR refuses
(below). So neither is a superset of the other: CBOR is the lossless encoding of
a `number`, JSON the one that spells every string, and a dialect served as both
encodings keeps its values inside what both accept, which is its schema's to say
(D8 and D9). Every function is pure, and the errors are values with a message in
the style of the sibling parsers.

**Input admission.** `parse` and `isCanonical` read a list of numbers, and a
list can hold what no byte is: `NaN`, `-0`, `1.5`, `256`, a string. Every element
is checked **when it is read, before any arithmetic on it**: it must be an
integer in `0..255`, and `-0` is not one. JavaScript's bit operations coerce
`NaN` and `-0` to `0`, so a reader that skipped the check would decode
`[NaN]` as the byte `0` and invalid input as a valid integer. A non-byte
element **throws**, as in the other byte readers of this tree
([`fjs/git/object`](../../git/object/module.f.mjs)'s `tryRead`, `@throws If an item
of the input is not a byte`): it is a caller's mistake and not data, so it is
not a `Result` error; only bytes that are bytes and are not CBOR are. The `Vec`
adapters (D1) refuse a `Vec` that is not whole bytes the same way.

`serialize` is **not total over `Value`**: a JSON string may hold an unpaired
surrogate (`"\uD800"`), which UTF-8, and so a CBOR text string, cannot spell,
and [`fjs/text/utf8`](../../text/utf8/module.f.mjs) round-trips only strings
without one. The serializer refuses such a string, with an error that names it,
and `parse` never produces one, so everything `parse` accepts serializes
(`isCanonical` below needs that). This is D8.

The same holds for depth. `parse` refuses nesting past `maxDepth` (below), so
`serialize` refuses a `Value` nested past it too, counted the same way and with
an error that says so: otherwise it could write bytes that `parse` rejects, and
the round trip and `isCanonical` would be false for them. Both directions share
the one constant, and the serializer's own recursion is bounded by it. This is
D5.

#### The head, and the item reader

A CBOR item starts with one byte, major type (3 bits) and additional
information (5 bits): 0 to 23 is the argument itself, 24 to 27 say it follows in
1, 2, 4 or 8 bytes, 28 to 30 are reserved (not well-formed) and 31 is
indefinite length (refused by the first iteration). The parser reads
`head -> { major, argument }` once and every major type is a case on it. The
argument is a `bigint` where it can exceed a safe integer (8-byte heads), a
`number` otherwise. The serializer writes the shortest head for an argument,
which is what makes integers, lengths and tags preferred-form by construction.

#### Integers and the number/bigint identity

- A `number` that is a safe integer (not `-0`) is major 0 or 1, shortest head.
- A `bigint` is tag 2 (non-negative) or tag 3 (negative, argument `-1 - n`) over
  a minimal big-endian byte string, **always**: `5n` and `5` are different FJS
  values, so they must not share bytes (a content hash would collide). This is
  D3, and it is the one place the serializer departs from RFC 8949's preferred
  serialization (a value that fits major 0 or 1 is not written as a bignum), so
  the profile is the FJS one, not plain §4.2 core deterministic encoding.
- The parser reads major 0 and 1 as a `number` within the safe range and as a
  `bigint` outside it, and tags 2 and 3 as a `bigint` whatever the size.
- **One rule says what is canonical:** `bytes` are canonical when
  `serialize(parse(bytes))` is `bytes`. Under D3 that makes a small bignum
  canonical (`c24105` is `5n`, which the serializer writes as `c24105`), and
  makes these valid blobs **not canonical**: an integer outside the safe range
  spelled as major 0 or 1 (it parses to a `bigint`, which is written as a
  bignum), a bignum with a leading zero byte, and a bignum for zero that is not
  the empty byte string. If the owner answers D3 the other way (major 0 and 1
  for any integer that fits 64 bits), the same rule makes a small bignum
  non-canonical instead; the rule is the stable part.

#### Floats

- Finite non-integer `number`, a `number` beyond the safe range, `NaN`,
  `+-Infinity` and `-0` are major 7. Preferred serialization (RFC 8949 4.2.1):
  the shortest of half (`f9`), single (`fa`) and double (`fb`) that holds the
  value exactly. `NaN` is the one quiet `f97e00`; `-0` is `f98000`.
- `fjs/media/cbor/float/` converts between the three widths and `number`
  with exact arithmetic: sign, then a scale by powers of two (exact in binary
  floating point), then the bit fields; no typed array or `DataView`, which
  are mutable. Half and single widths are checked by decoding the candidate and
  comparing, so the "does it fit" rule has one definition.
- The parser accepts every float width, any `NaN` payload (read as `NaN`) and
  non-shortest encodings; only the canonical check looks at the form.

#### Strings, arrays, maps

- A text string is UTF-8 by [`fjs/text/utf8`](../../text/utf8/module.f.mjs);
  invalid UTF-8, a surrogate sequence included, is a parse error, and a string
  with an unpaired surrogate is a serialize error (D8). Lengths are definite.
- A map has text keys only. The serializer sorts entries by the **bytewise
  order of the encoded key** (RFC 8949 4.2.1): the length head comes first, so
  a shorter key sorts before a longer one, and it is not the code-unit order the
  JSON serializer uses. The parser refuses a duplicate key and builds the object
  with own data properties only, `__proto__` included as an ordinary key.
- An array is its items in order.

#### The parser's bounds

- One top-level item, then the end: bytes after it are an error.
- A depth cap named `maxDepth` (D5), counted like the JSON recognizer's: a
  scalar is depth 0 and an array or map adds one. `serialize` applies the same
  cap, so everything it writes parses.
- A length that the bytes left cannot hold is an error **before** anything is
  allocated, so a head claiming `2^60` items costs nothing.
- A single leading tag 55799 (`d9d9f7`) is unwrapped and recorded as
  non-canonical.

#### `isCanonical`

`isCanonical(bytes)` is `parse(bytes)` succeeding and `serialize(value)` being
`ok` with the same bytes. The serialize step cannot fail on a parsed value
(`parse` never yields an unpaired surrogate, D8), so a failure there is a bug,
not an answer. It needs no second reader and cannot disagree with the
serializer; it costs one parse and one serialize, for a predicate that is rare
(CAS dedup).

#### Proofs

- The RFC 8949 Appendix A vectors that fall inside the data model, transcribed
  with their hex: the integers (`1000000` is `1a000f4240`), the bignums
  (`18446744073709551616` is `c249010000000000000000`), the floats (`1.1` is
  `fb3ff199999999999a`, `65504.0` is `f97bff`), the strings, arrays and maps.
  The vectors outside the model are asserted **refused**, each with its reason.
  The vectors are **two lists, not one**. The RFC gives a value one example
  encoding and the serializer writes exactly one, and they differ wherever the
  RFC's example is not the canonical form here: `65504.0` and `1.0` are floats
  in the RFC and integers to the serializer (`19ffe0`, `01`), and a bignum for a
  value that fits is the RFC's major 0.
- Parser: **every** in-model vector parses to its value, including the
  non-shortest and integral-float ones; a vector the serializer would write
  differently is also reported non-canonical.
- Serializer: a second list of `value -> canonical bytes`. The vectors whose
  RFC bytes already are the canonical form are taken from the RFC as they are;
  each of the others is listed with the bytes the serializer must write, and a
  comment naming the RFC example it replaces. Then `-0`, `NaN`, the infinities,
  the half/single/double boundaries and the safe-integer edges, a string with an
  unpaired surrogate refused, and nesting at `maxDepth` written and at
  `maxDepth + 1` refused.
- Parser admission: `[NaN]`, `[-0]`, `[1.5]`, `[256]`, `[-1]` and a non-number
  element each throw, at the position they are read and after the bytes before
  them were read, and never decode as the byte `0`; a list of valid bytes that is
  no CBOR is a `Result` error.
- Parser: truncated items at every cut, trailing bytes, duplicate keys,
  indefinite lengths, reserved additional information, invalid UTF-8, an
  unsupported tag, a non-text key, depth `maxDepth` and `maxDepth + 1`, a length
  claiming more than the bytes hold, the 55799 wrapper.
- Round trip: `parse(serialize(v))` is `v` for generated trees without an
  unpaired surrogate and no deeper than `maxDepth` (`Object.is` for numbers, so
  `-0` and `NaN` are tested), and
  `isCanonical(serialize(v))` holds.
- Node has no CBOR, so there is no reference to diff against as there was for
  `fjs/zlib`; the RFC's vectors and the generated round trips are the evidence.
  An independent implementation, if one is at hand, is for a **temporary**
  comparison script, not committed.

### Decisions for the owner

Each is the session's proposal; none is built on until the owner answers.

- **D1. Bytes as a list, not a `Vec`.** `serialize` and `parse` work on
  `List<number>` bytes, as `fjs/git` does, with `Vec` adapters (`serializeVec`,
  `parseVec`) at the 128 KiB boundary. [`detect`](../type/module.f.mjs) takes
  a `Vec`, and detection of a size-bounded blob is the first consumer. The
  alternative is `Vec` only, which refuses a value that serializes to more than
  128 KiB; a list loses nothing and a `Vec` caps the model.
- **D2. Reuse the extended JSON tree as `Value`.** One data model across JSON,
  DataJS and CBOR; the alternative is a CBOR-specific tree.
- **D3. How `number` and `bigint` stay distinct on the wire.** FJS has `5` and
  `5n`, RFC 8949's preferred serialization has one form for the integer 5, and a
  content hash must tell the two FJS values apart. Three answers:
  - **(a) Every `bigint` is a bignum (tags 2 and 3); an integral `number` is
    major 0 or 1.** Proposed. The two stay distinct, a `number` is the integer
    every CBOR reader expects, and the price is the one deviation: the encoding is
    an FJS profile of §4.2, named as such, not plain core deterministic encoding.
  - **(b) Stay inside §4.2 exactly: a `bigint` is major 0 or 1 (a bignum only past
    64 bits), and every `number` is a float** (`5` is `f94500`). Injective and
    plain core deterministic, at the cost that an integral `number` is a float
    to every generic reader, and a few more bytes for the small integers.
  - **(c) Major 0 and 1 for both**, so `parse(serialize(5n))` is `5`: two distinct
    FJS values share bytes, and a hash cannot tell them apart. Not recommended.

  The sections above are written for (a). **Each answer changes the same five
  rules**, so the choice is mechanical once it is made, and none of the rules
  below may be read as holding for an answer other than the one it is listed
  under:

  | rule | (a) | (b) | (c) |
  | --- | --- | --- | --- |
  | serialize an integral safe `number` | major 0 or 1 | a float, shortest width (`5` is `f94500`) | major 0 or 1 |
  | serialize a `bigint` | tag 2 or 3, always | major 0 or 1 if it fits 64 bits, else tag 2 or 3 | major 0 or 1 if it fits 64 bits, else tag 2 or 3 |
  | parse major 0 or 1 | a `number` in the safe range, else a `bigint` | **a `bigint`**, whatever the size | a `number` in the safe range, else a `bigint` |
  | parse tag 2 or 3 | a `bigint` | a `bigint` | a `bigint` |
  | parse a float | a `number` | a `number` | a `number` |

  What follows from the table: under (b) the round trip is `5n -> 05 -> 5n` and
  `5 -> f94500 -> 5`, which is why the parser must read major 0 and 1 as
  `bigint`; under (c) it is `5n -> 05 -> 5`, which is why (c) is not injective.
  The canonical-but-not rule (`serialize(parse(bytes))` is `bytes`) is the same
  under all three and picks different cases: under (a) an integer outside the
  safe range spelled as major 0 or 1, and a bignum with a leading zero byte;
  under (b) a bignum for a value that fits 64 bits, and a bignum with a leading
  zero byte; under every answer a float in any width but the shortest. The vector
  lists (the Proofs section) are
  built per answer: for instance the RFC's `01` parses to the `number` 1 under
  (a) and (c) and to the `bigint` 1n under (b). The float rules (D4) and the
  number/bigint split of the model (D2) do not move.

  The RFC points (3.4.3 on preferred serialization of bignums, 4.2.1 on core
  deterministic encoding) are to be checked against the text before they reach
  the README; the exception in (a) rests on them. The producer rule in
  [detect-cbor.md](../type/todo/detect-cbor.md) points at the profile this
  decision settles and names none of its integer rules.
- **D4. Shortest floats.** The `todo` already says RFC 8949 4.2; the roadmap
  records the competing "always 8-byte doubles" (it is also simpler to encode).
  Shortest-form is the standard's and is recommended.
- **D5. `maxDepth`.** A number for the DoS guard, bounding the parser and the
  serializer alike. A proposal: 64, as a named constant exported by the module,
  so a caller can compare it.
- **D6. Which of `parse`'s failures are one error type.** A message string, as
  the JSON parsers do, or a small closed set of codes a consumer can branch on
  (`truncated`, `trailing`, `unsupported`, `duplicate-key`, ...), which detection
  would use to tell "not CBOR" from "CBOR outside the model". A code plus a
  message is recommended.
- **D7. Order of work and the size of the pull requests**: the stack below.
  Byte strings (major 2) as a model value, and a payload-free recognizer
  (detect-cbor tier 3), stay out of this task.
- **D8. Strings with an unpaired surrogate.** JSON can hold one and CBOR text
  cannot. Proposed: `serialize` refuses it (a `Result`, above), and `parse` never
  yields one. The alternatives are narrowing `Value` to well-formed strings,
  which changes the JSON data model this reuses (D2); or writing it as WTF-8 into
  a text string, which the parser would then have to reject as invalid UTF-8, so
  the codec would fail its own round trip. Refusing is recommended.
- **D9. Non-finite numbers.** CBOR keeps `NaN` and the infinities as floats and
  the extended JSON serializer turns them into `null`, so a value that holds one
  does not survive the JSON twin. Proposed: keep them in the CBOR model (a
  `number` stays lossless, and nothing in the codec depends on excluding them),
  state that the JSON twin does not spell them, and leave it to each dialect's
  schema to exclude them when the dialect is served as both. The alternatives are
  to exclude them from the model, which makes the serializer refuse them as it
  does a lone surrogate (D8) and loses a value a `number` can be, or to define a
  JSON representation for them, which is the JSON codec's decision and not this
  task's.

### Tasks

The stack, one pull request per bullet group, in order:

1. This pull request: the claim (`wip`), the design above and the decisions.
2. README, `types.ts` and `float/` with its proof.
3. The serializer, against the canonical vector list.
4. The parser, against every in-model vector, and the round trips.
5. `isCanonical`, the root module, the references from `fjs/media`, and the
   unblocking of detect-cbor tier 2; the pull request that takes the last step
   deletes this file.

- [ ] Create `fjs/media/cbor/README.md` — the data-model mapping table, the
      canonical-form rules (§4.2 deterministic encoding), and the strictness rules
- [ ] `fjs/media/cbor/serializer/module.f.mjs` — canonical encoder over the
      data-model subset, `bigint` included; proof cases against the RFC 8949
      Appendix A test vectors that fall inside the model
- [ ] `fjs/media/cbor/parser/module.f.mjs` — strict decoder (well-formedness,
      single item, no duplicate keys, UTF-8-valid text, depth cap), result-typed
      errors; proof cases including truncated items, trailing bytes, duplicate
      keys, indefinite lengths (rejected), a tag-55799-wrapped item (accepted,
      unwrapped, reported non-canonical), and round trips through the serializer
- [ ] `isCanonical` predicate (or a decode flag reporting canonicity) for
      consumers that require byte-identity
- [ ] Root `fjs/media/cbor/module.f.mjs` re-exporting serializer/parser and the
      `application/cbor` constant; reference the module from `fjs/media` docs
- [ ] Unblock [detect-cbor](../type/todo/detect-cbor.md) tier 2: the strict parser's full
      decode of a size-bounded (128 KiB) blob is the detection primitive — tier 2
      decodes the whole blob and looks up the `dialect` key in the resulting map;
      no leading-entry or partial-decode helper is needed
- [ ] Later: byte strings (major 2) once an FJS `Vec` mapping is decided; a
      payload-free O(depth) recognizer sharing this grammar (detect-cbor tier 3)

### Related

- [detect-cbor.md](../type/todo/detect-cbor.md) — detection; consumes this codec in tiers 2–3
- [fjs/media/README.md](../README.md)
  — the dialect naming rule and the `fjs/media/` membership rule placing the codec
- [fjs/media/revision/README.md](../revision/README.md) — the tagged-format
  convention whose binary twin this enables
- `fjs/media/json/` (`serializer/`, `parser/`) — the sibling module
  whose layout and purity conventions this follows
- [fjs/media/json streaming-recognizer](../json/todo/streaming-recognizer.md) —
  the payload-free recognizer pattern for the future tier-3 sibling
