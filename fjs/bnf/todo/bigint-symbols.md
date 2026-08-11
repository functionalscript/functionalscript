## Use 256-bit bigint BNF symbols

**Priority:** P3
**Status:** blocked
**Blocked by:** [Use `-1` as the BNF EOF symbol](./eof-minus-one.md), [Bigint-aware JSON parse/serialize](../../media/json/todo/bigint-parse-serialize.md), [Separate alphabet-specific BNF helpers](./unicode-rules.md), [Investigate TerminalRange representation](./terminal-range-representation.md)

### Problem

BNF symbols are currently limited to 24 bits so two range endpoints can be packed
into one safe JavaScript `number`. This keeps `TerminalRange` compact, but it also
makes the physical symbol alphabet an implementation limit of the parser.

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

The current terminal-range encoding also depends on the 24-bit symbol width. The
representation of `TerminalRange` therefore needs a separate design decision
before this migration.

### Proposal

Use one fixed 256-bit unsigned physical input-symbol representation backed by
`bigint`:

```ts
type Symbol = bigint
```

with the invariant:

```text
0 <= symbol <= 2^256 - 1
```

Do not reserve any uint256 value for EOF. The preceding
[EOF task](./eof-minus-one.md) defines EOF independently as:

```text
EOF = -1
```

Thus the semantic terminal domain is:

```text
EOF              = -1
ordinary symbols = 0 .. 2^256 - 1
```

while physical parser inputs contain ordinary symbols only. Parser backends
already synthesize exactly one logical EOF according to the prerequisite task;
this migration must preserve that behavior rather than reintroducing a
width-dependent reserved value.

`fullRange` covers the complete ordinary uint256 domain, while `eof` remains the
singleton `-1 .. -1`. Complements over ordinary symbols do not include EOF.

#### `TerminalRange` representation

Do **not** decide the final `TerminalRange` representation in this task. Resolve
[Investigate TerminalRange representation](./terminal-range-representation.md)
first.

The EOF prerequisite defines the semantic-to-storage endpoint mapping:

```text
encodeTerminal(value) = value + 1
decodeTerminal(value) = value - 1
```

Therefore encoded endpoints are non-negative and, after this migration, occupy:

```text
EOF                    -> 0
ordinary 0             -> 1
ordinary 2^256 - 1     -> 2^256
```

A fixed-width packing baseline must consequently allocate 257 bits per encoded
endpoint, not 256. Other candidate representations may avoid paying that fixed
width for small endpoints.

If the chosen representation is not a primitive bigint, the BNF rule/data format
may need a broader redesign so terminal ranges remain unambiguous from sequences
and variants.

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

Then make the core range-map entries/ranges generic over `B`, and route all
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
semantic terminal domain. A range-map entry stores an upper cut point, and
`fromRange` may need a cut point immediately below a valid terminal value.

For an ordinary range beginning at `0n`, the cut point is `-1n`:

```text
[0n, b] -> [[default, -1n], [value, b]]
```

After the EOF migration, `-1n` is also the semantic EOF value. That coincidence is
valid: range-map cut points are raw boundaries, while the meaning of a lookup
value still comes from the terminal domain. If a cut point below the EOF singleton
is needed, it is `-2n`.

LL(1) lookup inputs remain valid semantic terminals (`-1n` for logical EOF or a
uint256 ordinary symbol). No terminal endpoint should be converted to `number`
merely to reuse an existing utility.

The parameterized core should accept a generic inclusive boundary pair
`readonly [B, B]` rather than depending internally on the existing number-only
`fjs/types/range.Range`. The current public number wrapper can continue to accept
that existing `Range` type. This keeps `fjs/types/range` itself number-specific
while avoiding duplication in `range_map`.

Generic BNF terminal containment does not need a range map and should simply use
bigint endpoint comparisons (`start <= symbol && symbol <= end`) after obtaining
the decoded endpoints from the chosen `TerminalRange` representation.

Unicode code points and bytes are possible physical symbol alphabets supplied
through alphabet-specific helpers; the generic BNF core itself should know
neither Unicode nor byte-stream semantics. Those adapters convert their values
into the new bigint ordinary-symbol domain. Metadata carried alongside physical
symbols is unchanged.

A 256-bit symbol also leaves a natural path for token mappings whose input may be
arbitrarily large and whose output is a cryptographic hash. Because EOF is `-1`,
the entire uint256 hash output space remains available to ordinary symbols.

### Tasks

- [ ] Introduce a BNF `Symbol` type backed by `bigint` with the full uint256
      invariant `0 <= symbol <= 2^256 - 1`.
- [ ] Preserve `EOF = -1` and the logical EOF synthesis semantics established by
      [the EOF prerequisite](./eof-minus-one.md); do not reserve a uint256 value.
- [ ] Define `fullRange` over the complete ordinary uint256 domain and keep `eof`
      as the singleton `-1 .. -1` terminal range.
- [ ] Adopt the `TerminalRange` representation selected by
      [the representation investigation](./terminal-range-representation.md),
      using the prerequisite task's `value + 1` / `value - 1` endpoint mapping.
- [ ] Update generic `rangeEncode`, `rangeDecode`, `oneEncode`, complement/range
      helpers, and their callers for bigint terminals and the selected range
      format.
- [ ] Replace BNF use of number-only `fjs/types/range.contains` with direct bigint
      endpoint comparison; do not convert endpoints to `number`.
- [ ] Parameterize the core `fjs/types/range_map` algorithm by boundary type and
      explicit comparison/predecessor operations; make entry/range boundaries and
      lookup values generic over that boundary type.
- [ ] Preserve the current number `rangeMap(...)` API as a thin instantiation of
      the generic core so existing number callers keep their current behavior.
- [ ] Instantiate the shared range-map core for BNF with raw `bigint` boundaries;
      support `-1n` as both the EOF value and the cut point immediately below
      ordinary symbol `0n`, and `-2n` when a cut point below EOF is required.
- [ ] Keep `fjs/types/range` itself number-specific; the parameterized range-map
      core may use a generic internal `readonly [B, B]` boundary pair while the
      number wrapper continues accepting `Range`.
- [ ] Add shared `range_map` proofs showing that the generic implementation
      preserves existing number behavior and works with bigint boundaries,
      including `-2n`, `-1n`, `0n`, and endpoints above
      `Number.MAX_SAFE_INTEGER`.
- [ ] Update BNF data, parsers, recognizers, AST/meta inputs, and proofs to consume
      bigint ordinary symbols while preserving logical EOF behavior.
- [ ] Update alphabet-specific helpers so their input values are converted to the
      full uint256 ordinary-symbol domain at the BNF boundary; keep source-domain
      APIs unchanged.
- [ ] Verify range complement, containment, shared range-map merge/lookup, and
      ordering semantics across EOF, minimum/maximum ordinary symbols, and the
      encoded endpoint `2^256`.
- [ ] Add BNF proof coverage for minimum/maximum ordinary symbols, EOF,
      singleton/general ranges, complements, bigint dispatch-map lookup/merge,
      alphabet-adapter boundaries, and preserved one-time EOF semantics.
- [ ] `npx tsc`, `fjs test`.

### Related

- [Use `-1` as the BNF EOF symbol](./eof-minus-one.md) — prerequisite that
  decouples EOF from symbol width and defines logical EOF parser behavior plus
  unsigned endpoint encoding.
- [Bigint-aware JSON parse/serialize](../../media/json/todo/bigint-parse-serialize.md)
  — exact JSON-compatible parse/serialize support required by bigint-valued BNF
  data.
- [Separate alphabet-specific BNF helpers](./unicode-rules.md) — makes the core
  BNF symbol algebra independent of Unicode and byte-stream semantics before its
  representation changes.
- [Investigate TerminalRange representation](./terminal-range-representation.md)
  — chooses how the offset terminal endpoints are represented.
- [UTF-8 token symbols](./utf8-token-symbols.md) — replace registered 24-bit token
  IDs with deterministic token-name-derived symbols after this task lands.
- [Layered parser](./layered-parser.md) — tokenizer output becomes input symbols to
  the next BNF layer.
- [`fjs/bnf/module.f.mjs`](../module.f.mjs) — current 24-bit symbol/range encoding.
- [`fjs/types/range/module.f.mjs`](../../types/range/module.f.mjs) — remains the
  existing number-boundary helper used by current number callers.
- [`fjs/types/range_map/module.f.mjs`](../../types/range_map/module.f.mjs) — shared
  range-map algorithm to parameterize for number and bigint boundaries instead of
  duplicating it in BNF.
