## Investigate TerminalRange representation

**Priority:** P3
**Status:** open

### Problem

The current BNF `TerminalRange` packs two 24-bit endpoints into one JavaScript
`number`:

```text
range = start * 2^24 + end
```

If BNF symbols move to a 256-bit `bigint` domain, directly preserving this layout
would become:

```text
range = start * 2^256 + end
```

That representation is simple and fixed-width, but even a range with very small
endpoints becomes a very large integer. The current compact-number motivation for
packing the pair therefore no longer obviously applies.

Before the bigint symbol migration chooses a `TerminalRange` representation,
investigate whether the range should remain one `bigint` or become a different
rule representation.

### Alternatives to investigate

At minimum, compare:

- fixed-width bigint packing, equivalent to `(start << 256n) | end`;
- bigint bit interleaving, for example storing bits from one endpoint in even bit
  positions and bits from the other endpoint in odd bit positions, so small
  endpoints remain small;
- another self-delimiting / variable-width bigint encoding whose size follows the
  actual endpoint sizes rather than the full 256-bit symbol width;
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

- [ ] Compare encoded size for common small ranges such as bytes, ASCII, and
      Unicode code-point ranges, as well as ranges near the uint256 boundary.
- [ ] Require a deterministic, canonical, lossless representation with simple
      encode/decode semantics.
- [ ] Compare containment/range-operation cost; avoid conversions through
      JavaScript `number`.
- [ ] Consider JSON/DJS serialization size and debuggability. The current packed
      range is already not meaningfully human-readable, so readability alone is
      not a reason to preserve primitive packing.
- [ ] Preserve the reserved EOF symbol and `fullRange` semantics from the bigint
      symbol design.
- [ ] If considering a structural representation, specify how `Rule`, `DataRule`,
      sequences, variants, lazy rules, and serialized BNF data remain
      unambiguous.
- [ ] Consider migration complexity for BNF core, data conversion, descent/LL(1)
      parsers, and proofs.
- [ ] Choose the representation before implementing the uint256 BNF-symbol
      migration.

### Related

- [256-bit bigint BNF symbols](./bigint-symbols.md) — blocked on this representation
  decision.
- [Separate alphabet-specific BNF helpers](./unicode-rules.md) — keeps the range
  representation independent from Unicode-specific syntax.
- [`fjs/bnf/module.f.ts`](../module.f.ts) — current 24-bit packed range encoding and
  rule representation.
