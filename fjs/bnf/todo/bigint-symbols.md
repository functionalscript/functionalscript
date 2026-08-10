## Use 256-bit bigint BNF symbols

**Priority:** P3
**Status:** blocked
**Blocked by:** [Bigint-aware JSON parse/serialize](../../media/json/todo/bigint-parse-serialize.md), [Separate alphabet-specific BNF helpers](./unicode-rules.md), [Investigate TerminalRange representation](./terminal-range-representation.md)

### Problem

BNF symbols are currently limited to 24 bits so two range endpoints can be packed
into one safe JavaScript `number`. This keeps `TerminalRange` compact, but it also
makes the symbol alphabet an implementation limit of the parser.

Layered parsing needs a much larger symbol space. A tokenizer should be able to
emit a token symbol that the next BNF parser consumes directly, including symbols
derived from descriptive token names or, later, cryptographic hashes.

Changing BNF data from `number` to `bigint` also means the data representation can
no longer round-trip through native `JSON.parse` / `JSON.stringify`. The bigint-
precise JSON parse/serialize task provides the JSON-compatible representation this
change needs.

The generic BNF core should also be separated from alphabet-specific rule
construction first, so changing the symbol representation does not preserve or
reinforce the current assumption that BNF symbols are Unicode code points.

The current terminal-range encoding also depends on the 24-bit symbol width. A
naive uint256 version would shift the first endpoint by 256 bits, making even
small ranges serialize as very large integers. The representation of
`TerminalRange` therefore needs a separate design decision before this migration.

### Proposal

Use one fixed 256-bit unsigned symbol representation backed by `bigint`:

```ts
type Symbol = bigint
```

with the invariant:

```text
0 <= symbol < 2^256
```

Reserve the maximal value for EOF:

```text
EOF = 2^256 - 1
```

Ordinary input symbols occupy `0 .. EOF - 1`. EOF is represented as a normal
BNF symbol/range value rather than as a separate terminal kind. This keeps one
representation throughout the parser stack: scanners, parsers, recognizers,
serialized BNF data, and range operations do not need a second EOF case in their
APIs.

Do **not** decide the `TerminalRange` representation in this task. Resolve
[Investigate TerminalRange representation](./terminal-range-representation.md)
first. The investigation includes fixed-width bigint packing, bit-interleaved
bigint packing, other variable-width bigint encodings, and structural
representations. If the chosen representation is not a primitive bigint, the BNF
rule/data format may need a broader redesign so terminal ranges remain
unambiguous from sequences and variants.

Regardless of the chosen representation, define `fullRange` over ordinary input
symbols only, `0 .. EOF - 1`, while `eof` represents the singleton `EOF .. EOF`.
Complements over ordinary symbols therefore do not include EOF, while grammars can
still refer to EOF through the normal terminal-range abstraction.

#### EOF in parser input

Alphabet adapters and callers provide only physical input symbols. They do **not**
append the reserved EOF value or invent metadata for it. Every parser backend
instead synthesizes exactly one logical EOF symbol immediately after the last
physical input symbol.

Keep the public parser position in the physical input domain:

```text
0 <= idx <= input.length
```

The parser's internal state must separately record whether the synthesized EOF has
already been consumed. Conceptually:

```text
idx < input.length
    -> match the physical input symbol
idx == input.length && !eofConsumed
    -> match the synthesized EOF symbol
idx == input.length && eofConsumed
    -> no symbol remains
```

Matching EOF marks that logical symbol as consumed but does **not** expose a
physical position beyond the input. Indexed parser results such as
`DescentMatchResult.idx` therefore report `input.length` after a successful EOF
match, not `input.length + 1`. Remainder-based public results likewise continue to
report the empty physical remainder. The extra EOF-consumed state is internal to
the parser and exists only to prevent a second EOF match.

This preserves the meaning of existing public parser positions and callers that
check complete consumption with `idx === input.length`, including the DJS
tokenizer. Parser implementations may choose any internal representation for the
EOF-consumed bit/state, but must normalize public positions and remainders back to
the physical input domain.

The synthesized EOF has no physical source element and therefore contributes no
ordinary symbol/metadata leaf to the AST. Diagnostics that reject a terminal at
EOF still point at the physical end position (`input.length`). This avoids
requiring a generic metadata type `T` to manufacture EOF metadata while keeping
EOF itself in the same `Symbol` / terminal-range abstraction as every other
terminal.

This is parser end-of-stream semantics, not a second EOF type. Alphabet adapters
must never produce the reserved EOF value as ordinary input; mappings whose
natural output can reach it must reject or remap it at their boundary.

#### Bigint range infrastructure

BNF terminal containment can compare decoded bigint endpoints directly, but the
LL(1) backend also needs the existing range-map merge/lookup algorithm. Do not
copy that algorithm into a BNF-local module. Instead, parameterize the existing
`fjs/types/range_map` implementation by its ordered boundary type so both number
and bigint users share the same splitting, ordering, and merge invariants.

The range-map algorithm currently has only two boundary-specific operations:

- comparison/order, used by merge and lookup;
- predecessor, currently written as `a - 1` by `fromRange`.

Factor those into boundary properties, conceptually:

```ts
type BoundaryOps<B> = {
    readonly compare: Compare<B>
    readonly previous: (value: B) => B
}
```

Then make the core range-map entries/ranges generic over `B`, and route **all**
boundary ordering and predecessor arithmetic through those operations. The exact
factory/type names should follow local conventions, but the architecture should
be equivalent to:

```ts
rangeMapBy(boundaryOps)(valueOps)
```

Preserve the existing number-oriented `rangeMap(valueOps)` API as a thin
instantiation/wrapper using number comparison and `value => value - 1`, so current
callers do not need an unrelated migration.

For BNF, instantiate the shared range-map boundary type as raw `bigint`, not the
semantic `Symbol` domain. A range-map entry stores an **upper cut point**, and
`fromRange` may need a cut point immediately below the first valid symbol. Thus a
BNF range beginning at `0n` legitimately produces the internal cut point `-1n`:

```text
[0n, b] -> [[default, -1n], [value, b]]
```

`-1n` is not a BNF symbol and must never be accepted from an alphabet adapter or
terminal range. It exists only inside the range-map representation. The `Symbol`
invariant applies to parser input and terminal endpoints, not to these internal
cut points. LL(1) lookup still receives a valid `Symbol`; because `Symbol` is
backed by `bigint`, it can be passed to the bigint range-map lookup without
converting it to `number`.

This distinction avoids making predecessor fallible and avoids inventing a fake
BNF symbol below zero. It also matches the existing number range-map semantics,
where `fromRange([0, b])` already creates an internal `-1` cut point even when the
consumer's meaningful input domain starts at zero.

The parameterized core should accept a generic inclusive boundary pair
`readonly [B, B]` rather than depending internally on the existing number-only
`fjs/types/range.Range`. The current public number wrapper can continue to accept
that existing `Range` type. This keeps `fjs/types/range` itself number-specific
while avoiding duplication in `range_map`.

Generic BNF terminal containment does not need a range map and should simply use
bigint endpoint comparisons (`start <= symbol && symbol <= end`) after obtaining
the endpoints from the chosen `TerminalRange` representation. No BNF symbol/range
endpoint should ever be converted to `number` merely to reuse an existing utility.

Unicode code points and bytes are possible symbol alphabets supplied through
alphabet-specific helpers; the generic BNF core itself should know neither
Unicode nor byte-stream semantics. Those adapters convert their values into the
new bigint symbol domain. Metadata carried alongside physical symbols is
unchanged.

A 256-bit symbol also leaves a natural path for token mappings whose input may be
arbitrarily large and whose output is a cryptographic hash. Such mappings must
avoid the single reserved EOF value. That constraint belongs to the mapping
boundary, not to BNF parsers.

### Tasks

- [ ] Introduce a BNF `Symbol` type backed by `bigint` with the 256-bit invariant.
- [ ] Reserve `2^256 - 1` as EOF; ordinary symbols are smaller values.
- [ ] Adopt the `TerminalRange` representation selected by
      [the representation investigation](./terminal-range-representation.md);
      do not assume fixed-width `(start << 256n) | end` packing here.
- [ ] Define `fullRange` over ordinary symbols only and `eof` as the singleton
      maximal-symbol range using the selected terminal-range representation.
- [ ] Update generic `rangeEncode`, `rangeDecode`, `oneEncode`, complement/range
      helpers, and their callers for bigint symbols and the selected range format.
- [ ] Replace BNF use of number-only `fjs/types/range.contains` with direct
      `Symbol` endpoint comparison; do not convert bigint endpoints to `number`.
- [ ] Parameterize the core `fjs/types/range_map` algorithm by boundary type and
      explicit comparison/predecessor operations; make entry/range boundaries and
      lookup values generic over that boundary type.
- [ ] Preserve the current number `rangeMap(...)` API as a thin instantiation of
      the generic core so existing number callers keep their current behavior.
- [ ] Instantiate the shared range-map core for BNF with raw `bigint` cut-point
      boundaries, not the semantic `Symbol` domain; allow the internal `-1n` cut
      point required for a range beginning at the minimum symbol `0n`.
- [ ] Keep BNF range-map lookup inputs restricted to valid `Symbol` values even
      though the map's internal bigint cut points may lie outside the symbol
      domain.
- [ ] Keep `fjs/types/range` itself number-specific; the parameterized range-map
      core may use a generic internal `readonly [B, B]` boundary pair while the
      number wrapper continues accepting `Range`.
- [ ] Add shared `range_map` proofs showing that the generic implementation
      preserves existing number behavior and works with bigint boundaries,
      including a BNF range starting at `0n`, its internal `-1n` cut point, and
      endpoints above `Number.MAX_SAFE_INTEGER`.
- [ ] Update every parser/recognizer backend to synthesize exactly one logical EOF
      after physical input and track whether it has been consumed in internal
      parser state; do not require callers to append EOF.
- [ ] Keep public parser positions/remainders in the physical input domain after
      EOF consumption: indexed results report `input.length`, never
      `input.length + 1`, and remainder-based results report the empty physical
      remainder.
- [ ] Keep synthesized EOF out of ordinary AST metadata leaves; preserve end-of-
      input diagnostics at the physical end position.
- [ ] Update BNF data, parsers, recognizers, AST/meta inputs, and proofs to consume
      bigint symbols without introducing a separate EOF representation.
- [ ] Update alphabet-specific helpers so their input values are converted to
      bigint ordinary symbols only at their BNF boundary and never emit reserved
      EOF; keep source-domain APIs unchanged.
- [ ] Verify range complement, containment, shared range-map merge/lookup, and
      ordering semantics over the 256-bit domain, including the boundary
      immediately below EOF.
- [ ] Add BNF proof coverage for minimum/maximum ordinary symbols, EOF, singleton
      ranges, general ranges, complements, bigint dispatch-map lookup/merge,
      alphabet-adapter boundaries, explicit EOF on empty/non-empty input, failure
      before physical end, one-time EOF consumption, and public result positions
      normalized to the physical input length.
- [ ] `npx tsc`, `fjs test`.

### Related

- [Bigint-aware JSON parse/serialize](../../media/json/todo/bigint-parse-serialize.md)
  — exact JSON-compatible parse/serialize support required by bigint-valued BNF
  data.
- [Separate alphabet-specific BNF helpers](./unicode-rules.md) — makes the core
  BNF symbol algebra independent of Unicode and byte-stream semantics before its
  representation changes.
- [Investigate TerminalRange representation](./terminal-range-representation.md)
  — chooses how bigint range endpoints are represented without assuming a
  fixed-width 512-bit packed integer.
- [UTF-8 token symbols](./utf8-token-symbols.md) — replace registered 24-bit token
  IDs with deterministic token-name-derived symbols after this task lands.
- [Layered parser](./layered-parser.md) — tokenizer output becomes input symbols to
  the next BNF layer.
- [`fjs/bnf/module.f.ts`](../module.f.ts) — current 24-bit symbol/range encoding.
- [`fjs/types/range/module.f.mjs`](../../types/range/module.f.mjs) — remains the
  existing number-boundary helper used by current number callers.
- [`fjs/types/range_map/module.f.mjs`](../../types/range_map/module.f.mjs) — shared
  range-map algorithm to parameterize for number and bigint boundaries instead of
  duplicating it in BNF.
