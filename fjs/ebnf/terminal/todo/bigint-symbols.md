## Use 256-bit bigint BNF symbols

**Priority:** P5
**Status:** on-hold

### Why this is on hold

Nothing needs it. The only consumer was
[utf8-token-symbols](../../token_symbol/todo/utf8-token-symbols.md), which
needed room to derive a token symbol from the name's own bytes; that is on
hold too, and [the DJS parser](../../../djs/parser/README.md) uses the
shipped [`token_symbol`](../../token_symbol/README.md) registry instead.

The widening was never a capacity problem — a registered name's symbol is
its position past `0x110000`, and no array is long enough to run out — so
this buys a property (symbols independent of list order) that no current
consumer can observe.

It also is not free. The uint256 domain has `2^256 + 1` terminals, so the
range-set terminal over `number` boundaries cannot be reused; the migration
touches `fjs/types/range_set`, the terminal's lowering, the backend's first
sets, and every serialized grammar.
[terminal-range-representation](./terminal-range-representation.md) worked out
what the replacement should be and measured it: a packed bigint with fixed
257-bit halves, ~33% slower to decode and 8.5x larger serialized than today's
representation. That investigation stands and is where to resume from.

Revive when the trigger [`../../token_symbol/README.md`](../../token_symbol/README.md)
names actually arrives — a token symbol that has to be written to a file, where
order-independence starts to matter.

### Problem

Ordinary symbols are the non-negative safe integers: a terminal is a range
set whose boundaries are `number`s, and `b + 1` is exact only below
`2^53` ([ebnf-range-set](./ebnf-range-set.md)). The domain is:

```text
EOF              = -1
ordinary symbols = 0 .. 2^53 - 1
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

This change expands the semantic terminal domain from `2^53` values to
`2^256 + 1` values, so the `number`-boundary range set cannot be reused. Use
the representation selected by the TerminalRange investigation.

BNF data also needs bigint-precise JSON serialization. Keep that concern in the
existing bigint JSON work rather than inventing a BNF-specific encoding.

The implementation order, if this revives, is explicit: the `EOF = -1` semantics
are already shipped, so choose the bigint `TerminalRange` representation next, and
use the bigint-aware JSON representation when serialized BNF data is updated.

#### Bigint range infrastructure

Containment can compare bigint semantic endpoints directly.

The LL(1) backend reads its first sets through `fjs/types/range_set`;
parameterize that shared algebra by boundary type instead of copying it. The generic boundary
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
- [ ] `tsc`, `fjs test`.

### Related

- [`fjs/ebnf/README.md`](../../README.md#terminals-and-eof) — the shipped EOF
  semantics this migration keeps.
- [Investigate TerminalRange representation](./terminal-range-representation.md)
  — selects a representation for the expanded bigint terminal domain.
- [`fjs/media/json/extended/module.f.mjs`](../../../media/json/extended/module.f.mjs)
  — provides exact serialization for bigint-valued grammar data.
- [Separate alphabet-specific helpers](../../unicode/todo/unicode-rules.md) —
  keeps the front end independent from Unicode and byte-specific authoring
  helpers.
- [UTF-8 token symbols](../../token_symbol/todo/utf8-token-symbols.md) — uses
  the full uint256 ordinary symbol space for deterministic token mappings.
- [Layered parser](../../todo/layered-parser.md) — tokenizer output becomes
  input symbols to the next layer.
