## Investigate TerminalRange representation

**Priority:** P3
**Status:** open — investigation complete, proposal awaiting review

### Problem

The current BNF `TerminalRange` packs two 24-bit endpoint codes into one
JavaScript `number`:

```text
range = start * 2^24 + end
```

Moving semantic EOF from `2^24 - 1` to `-1` does not require changing this
representation. The same 24-bit stored EOF code can continue to represent EOF,
and ordinary symbols remain `0 .. 2^24 - 2`.

The representation question becomes necessary when BNF ordinary symbols later
expand to the full uint256 domain:

```text
EOF              = -1
ordinary symbols = 0 .. 2^256 - 1
```

That domain has `2^256 + 1` semantic terminal values, so a single 256-bit unsigned
endpoint code cannot represent all terminals.

### Alternatives to investigate

Use a simple deterministic representation. Candidates include:

- an order-preserving non-negative encoding:

  ```text
  encodeTerminal(value) = value + 1
  decodeTerminal(value) = value - 1
  ```

  giving encoded endpoints `0 .. 2^256`; a fixed-width form therefore needs
  257 bits per endpoint;
- a structural range storing signed semantic endpoints directly;
- a canonical variable-width bigint encoding;
- other simple representations that preserve the same semantic domain.

A structural representation may require changing the surrounding BNF rule/data
representation so terminal ranges remain unambiguous from sequences and variants.

`TerminalRange` is serialized BNF data and may be content-addressed, so the chosen
representation must be canonical and stable rather than an incidental runtime
optimization.

### Proposal

**Use a packed bigint with fixed 257-bit halves and an order-preserving
`value + 1` endpoint encoding.**

```text
encodeTerminal(v) = v + 1n          // [-1, 2^256 - 1] -> [0, 2^256]
range             = encodeTerminal(a) << 257n | encodeTerminal(b)
```

257 bits per half because `encodeTerminal` reaches `2^256`, which needs bit 256
set. `eof` stays the singleton `[-1, -1]`; `fullRange` stays `[0, 2^256 - 1]` and
holds ordinary symbols only, so complements still never produce EOF.

#### A terminal must stay one scalar

This is the constraint that decides the question, and it comes from the IR rather
than from the range codec. [`../data/types.ts`](../data/types.ts) discriminates
the four rule kinds **by JavaScript type alone** — a number is a `TerminalRange`,
an array a `Sequence`, an object a `Variant`, a string a `Repeat` — so that no
shape has to be probed to tell one kind from another.

A structural range is therefore not a local change to the codec. `[start, end]`
collides with `Sequence`, `{ start, end }` collides with `Variant`, and a string
form collides with `Repeat`; any of them forces every rule kind to become
explicitly tagged, rewriting `RuleSet`, both backends, `toData`, and every
serialized grammar. A bigint keeps the discriminator a one-word change
(`typeof rule === 'number'` becomes `'bigint'`) at the six sites that test it:
[`../data/module.f.mjs`](../data/module.f.mjs) ×3,
[`../ll1/module.f.mjs`](../ll1/module.f.mjs) ×2, and
[`../descent/module.f.mjs`](../descent/module.f.mjs) ×1.

**Structural representations are rejected on this ground alone**, independently of
size or speed.

#### Canonicity decides between the two scalar forms

That leaves two bigint encodings: fixed-width packing, and a canonical
variable-width (varint) pair of `(a + 1, b - a)`.

Fixed-width packing is canonical by construction: the map between pairs and
bigints is injective in both directions, and a bigint either decodes to exactly
one in-domain pair or is out of domain.

A varint pair is not. `0x80 0x00` and `0x00` denote the same value, so the same
range has more than one spelling unless canonicity is separately specified *and
validated on decode*. For data that is content-addressed, two encodings of one
range are two different addresses for one grammar — a defect the fixed-width form
cannot express. Requiring a validator to restore the property is a strictly worse
position than not being able to violate it.

#### Measurements

Decode throughput (2M iterations, `[0x30, 0x39]`), and `rangeDecode`'s share of a
real parse — measured by instrumenting it and tokenizing 24,576 characters of DJS,
which calls it **703,556 times, 28.6× per input character**:

| representation | decode | share of parse time |
| --- | --- | --- |
| current, 24-bit in a `number` | 32.6 M ops/s | 10.7% |
| packed bigint, 257-bit halves | 22.0 M ops/s | 15.9% |
| canonical varint pair | 15.4 M ops/s | 22.7% |

Serialized size of the 55 terminal ranges in the DJS tokenizer grammar (165 rules,
33% of them terminals):

| representation | chars | vs current |
| --- | --- | --- |
| current | 512 | 1x |
| packed bigint | 4356 | 8.5x |
| canonical varint | 221 | 0.4x |

Packing costs 8.5x on serialized size, and that is the one real argument against
it. It is accepted because the absolute number is small — under 4KB for a whole
grammar — and because grammars are build-time artifacts, not payloads. The varint
form wins size precisely where it is cheap to lose, and loses canonicity and hot
decode speed where they are expensive.

#### Hoist the decode, regardless of representation

`rangeDecode` runs 28.6 times per input character because
[`../descent/module.f.mjs`](../descent/module.f.mjs) decodes `ruleSet[name]` on
**every terminal match attempt**, re-decoding the same handful of rules
throughout a parse.

Decoding each terminal once when the parser is constructed — beside the
`emptyTags` pass that already walks the whole `RuleSet` — removes that from the
hot path entirely. Then the +5pp this migration would otherwise cost disappears,
and the representation stops being a parse-speed decision at all.

This is worth doing **before** the bigint migration, so the migration is measured
against a parser that does not re-decode: it is a win at the current 24-bit
representation too, and it is the difference between the bigint move being a
regression and being free.

### Tasks

- [x] Use the bigint terminal domain `[-1] | [0, 2^256 - 1]` as the required
      semantic domain.
- [x] Compare fixed-width 257-bit endpoint encoding with simpler structural or
      variable-width alternatives.
- [x] Require deterministic, canonical, lossless encode/decode semantics.
- [x] Compare serialized size and containment/range-operation cost for EOF,
      bytes, Unicode, token symbols, and values near `2^256 - 1`.
- [x] If using a structural representation, specify how `Rule` / `DataRule`
      remain unambiguous and serializable. Not applicable — structural forms are
      rejected because they collide with `Sequence` / `Variant` / `Repeat`.
- [x] Choose one representation for the bigint-symbol migration and document any
      serialized/public format migration it requires.

Follow-on work, for [bigint-symbols](./bigint-symbols.md) rather than this issue:

- [ ] Hoist terminal decoding out of the descent match loop into parser
      construction, and re-measure, before migrating the representation.
- [ ] Migrate serialized grammars: every existing `TerminalRange` changes both
      type and value, so there is no compatibility layer — regenerate, exactly as
      the `EOF = -1` change required.

### Related

- [`fjs/bnf/README.md`](../README.md#terminals-and-eof) — the shipped `EOF = -1`
  semantics over the existing 24-bit stored representation.
- [256-bit bigint BNF symbols](./bigint-symbols.md) — expands the terminal domain
  and consumes the representation selected here.
- [`fjs/bnf/module.f.mjs`](../module.f.mjs) — current 24-bit packed range codec.
