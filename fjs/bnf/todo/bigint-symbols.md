## Use 256-bit bigint BNF symbols

**Priority:** P3
**Status:** open

### Problem

BNF ordinary symbols are currently limited to 24 bits because `TerminalRange`
packs two endpoint codes into one safe JavaScript `number`.

After moving semantic EOF to `-1`, the current domain is:

```text
EOF              = -1
ordinary symbols = 0 .. 2^24 - 2
```

Layered parsing needs a much larger ordinary-symbol space so tokenizer output can
be consumed directly by another BNF layer.

### Proposal

Use bigint ordinary symbols over the full uint256 domain:

```ts
type Symbol = bigint
```

```text
EOF              = -1n
ordinary symbols = 0n .. 2^256 - 1n
```

No uint256 value is reserved for EOF. Physical parser input contains ordinary
symbols only; parser backends preserve the logical one-time EOF behavior defined
by the EOF task.

`fullRange` covers `0n .. 2^256 - 1n`; `eof` is the singleton `-1n` range.

This change expands the semantic terminal domain from `2^24` values to
`2^256 + 1` values, so the current 24-bit `TerminalRange` representation cannot
be reused. Use the representation selected by the TerminalRange investigation.

BNF data also needs bigint-precise JSON serialization. Keep that concern in the
existing bigint JSON work rather than inventing a BNF-specific encoding.

#### Bigint range infrastructure

BNF containment can compare bigint semantic endpoints directly.

The LL(1) backend also uses `fjs/types/range_map`; parameterize that shared
algorithm by boundary type instead of copying it into BNF. The generic boundary
operations need comparison and predecessor, conceptually:

```ts
type BoundaryOps<B> = {
    readonly compare: Compare<B>
    readonly previous: (value: B) => B
}
```

Preserve the existing number-oriented `rangeMap(...)` API as a thin wrapper.
For BNF, use raw bigint boundaries. `-1n` may be both semantic EOF and the cut
point immediately below ordinary `0n`; use `-2n` when a cut point below EOF is
needed.

### Tasks

- [ ] Change BNF ordinary `Symbol` values to bigint with invariant
      `0n <= symbol <= 2^256 - 1n`.
- [ ] Keep logical EOF at `-1n`; do not reserve any uint256 ordinary value.
- [ ] Define `fullRange` over the complete uint256 ordinary domain and keep `eof`
      as the `-1n` singleton.
- [ ] Adopt the bigint `TerminalRange` representation selected by
      [Investigate TerminalRange representation](./terminal-range-representation.md).
- [ ] Update range encode/decode, containment, complement helpers, BNF data,
      parsers, recognizers, AST/meta inputs, and proofs for bigint terminals.
- [ ] Parameterize `fjs/types/range_map` by boundary type and comparison /
      predecessor operations.
- [ ] Preserve the existing number `rangeMap(...)` API as a wrapper over the
      generic implementation.
- [ ] Instantiate the shared range-map implementation for bigint boundaries,
      including `-2n`, `-1n`, `0n`, and values above `Number.MAX_SAFE_INTEGER`.
- [ ] Keep Unicode/byte/token adapters responsible for mapping their source values
      into the ordinary uint256 symbol domain.
- [ ] Use bigint-aware JSON parse/serialize for serialized BNF data.
- [ ] Add proofs for EOF, ordinary minimum/maximum values, ranges, complements,
      range-map lookup/merge, and one-time logical EOF behavior.
- [ ] `npx tsc`, `fjs test`.

### Related

- [Use `-1` as the BNF EOF symbol](./eof-minus-one.md) — separates logical EOF
  from the non-negative physical symbol space without expanding the current
  24-bit terminal count.
- [Investigate TerminalRange representation](./terminal-range-representation.md)
  — selects a representation for the expanded bigint terminal domain.
- [Bigint-aware JSON parse/serialize](../../media/json/todo/bigint-parse-serialize.md)
  — provides exact serialization for bigint-valued BNF data.
- [Separate alphabet-specific BNF helpers](./unicode-rules.md) — keeps core BNF
  independent from Unicode and byte-specific authoring helpers.
- [UTF-8 token symbols](./utf8-token-symbols.md) — uses the full uint256 ordinary
  symbol space for deterministic token mappings.
- [Layered parser](./layered-parser.md) — tokenizer output becomes input symbols to
  the next BNF layer.
