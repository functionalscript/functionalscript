## Investigate TerminalRange representation

**Priority:** P3
**Status:** open

### Problem

The current BNF `TerminalRange` packs two 24-bit endpoints into one JavaScript
`number`:

```text
range = start * 2^24 + end
```

The preceding [EOF migration](./eof-minus-one.md) separates semantic terminal
values from their stored endpoint representation:

```text
encodeTerminal(value) = value + 1
decodeTerminal(value) = value - 1
```

This maps EOF (`-1`) to encoded endpoint `0` and keeps all stored endpoints
non-negative. After BNF ordinary symbols move to the full uint256 domain, encoded
endpoints therefore occupy:

```text
0 .. 2^256
```

A direct fixed-width continuation would consequently need 257 bits per endpoint:

```text
range = encodedStart * 2^257 + encodedEnd
```

That representation is simple and fixed-width, but even a range with very small
endpoints becomes a very large integer. The current compact-number motivation for
packing the pair therefore no longer obviously applies.

This is not only a runtime-performance question. `TerminalRange` is part of the
serializable BNF rule representation, so choosing the fixed-width layout during
the uint256 migration would also choose the persistent representation emitted by
JSON/DJS and stored or hashed as BNF data. Changing that representation later may
therefore be a format migration rather than a local optimization.

The fixed-width 257-bit-per-endpoint form is the **baseline** because it is the
simplest continuation of the current encoding plus the EOF offset. Compare other
representations against that baseline and choose one only if it provides a clear
enough benefit to justify extra complexity.

Before the bigint symbol migration chooses a `TerminalRange` representation,
investigate whether the range should remain one `bigint` or become a different
rule representation.

### Alternatives to investigate

At minimum, compare:

- fixed-width bigint packing, equivalent to
  `(encodedStart << 257n) | encodedEnd`; this is the simplest baseline and should
  be preferred unless another representation has a clear advantage;
- bigint bit interleaving, for example storing bits from one encoded endpoint in
  even bit positions and bits from the other in odd bit positions, so small
  endpoints remain small;
- another self-delimiting / variable-width bigint encoding whose size follows the
  actual endpoint sizes rather than the full 257-bit encoded-endpoint width;
- a non-bigint structural representation for a range.

Do not choose one of these representations in this investigation TODO yet.
Additional simple representations may be considered if they make the rule model
clearer.

A structural range representation has a wider consequence: today primitive
numeric values distinguish terminal ranges from arrays/sequences and
objects/variants. If `TerminalRange` stops being a primitive bigint, the other BNF
rule representations may also need to change so every rule kind remains
unambiguous and serializable. Treat that as part of the comparison rather than
assuming that only `TerminalRange` changes.

### Evaluation criteria

- [ ] Use fixed-width `(encodedStart << 257n) | encodedEnd` as the baseline and
      compare actual encoded/serialized sizes before choosing a more complex
      representation.
- [ ] Apply the `value + 1` / `value - 1` endpoint mapping from the EOF task at the
      representation boundary; semantic range operations use decoded values.
- [ ] Compare encoded size for EOF, bytes, ASCII, Unicode code-point ranges, and
      ranges near the uint256 boundary, including encoded endpoint `2^256`.
- [ ] Require a deterministic, canonical, lossless representation with simple
      encode/decode semantics.
- [ ] Compare containment/range-operation cost; avoid conversions through
      JavaScript `number`.
- [ ] Consider JSON/DJS serialization size and debuggability. The current packed
      range is already not meaningfully human-readable, so readability alone is
      not a reason to preserve primitive packing.
- [ ] Treat representation stability as part of the decision because serialized
      BNF data may be persisted/content-addressed; avoid knowingly choosing a
      temporary wire representation merely to defer the comparison.
- [ ] Preserve `EOF = -1`, `eof` as the EOF singleton, and `fullRange` over the
      complete ordinary input-symbol domain from the EOF/bigint-symbol designs.
- [ ] If considering a structural representation, specify how `Rule`, `DataRule`,
      sequences, variants, lazy rules, and serialized BNF data remain
      unambiguous.
- [ ] Consider migration complexity for BNF core, data conversion, descent/LL(1)
      parsers, and proofs.
- [ ] Choose the representation before implementing the uint256 BNF-symbol
      migration.

### Related

- [Use `-1` as the BNF EOF symbol](./eof-minus-one.md) — defines the semantic EOF
  value and unsigned endpoint offset used by every candidate representation.
- [256-bit bigint BNF symbols](./bigint-symbols.md) — blocked on this representation
  decision.
- [Separate alphabet-specific BNF helpers](./unicode-rules.md) — keeps the range
  representation independent from Unicode-specific syntax.
- [`fjs/bnf/module.f.mjs`](../module.f.mjs) — current 24-bit packed range encoding and
  rule representation.
