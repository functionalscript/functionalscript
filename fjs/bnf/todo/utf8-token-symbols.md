## Encode token names as BNF symbols

**Priority:** P5
**Status:** on-hold

### Why this is on hold

The registry it would replace is enough for every current consumer.
[`../token_symbol/README.md`](../token_symbol/README.md) already weighed this
exact trade and accepted the registry, on a condition that still holds:

> The cost is that the list is append-only — inserting or reordering names shifts
> every symbol after the edit. That is acceptable because nothing persists a token
> symbol: symbols are built with the grammar, live as long as a parse, and are
> never serialized. Should they ever be written to a file, order independence
> would matter and the hash strategy is the way back.

[new-parser](./new-parser.md), the consumer this was written for, builds its
encoding at construction, uses it for one parse, and serializes no symbol. The
length limit that motivated deriving symbols from bytes is also not a live
problem: a registered name has no length limit, so `instanceof` is already one
symbol today.

This depends on [bigint-symbols](./bigint-symbols.md), which is on hold for the
same reason, so reviving this means reviving both.

Revive when a token symbol has to be written to a file.

### Problem

`fjs/bnf/token_symbol` currently assigns a 24-bit symbol to each token name from
its position in a registered alphabet. This works for small token sets, but it
adds an extra mapping layer and makes a token's numeric identity depend on the
ordered registration list.

In a layered parser, a tokenizer should be able to emit descriptive token types
such as `{`, `}`, `number`, `string`, `true`, or `false`, and the next BNF parser
should consume their symbols directly. The token's payload and source information
remain metadata and are not visible to the BNF grammar.

### Proposal

Replace the registration-based `fjs/bnf/token_symbol` mapping with a deterministic
mapping from a token name to the 256-bit BNF `Symbol` introduced by
[bigint-symbols](./bigint-symbols.md).

The default mapping derives the symbol from the token name's UTF-8 encoding,
reusing the existing `tryUtf8` / bit-vector representation rather than maintaining
a separate alphabet. Short descriptive token names therefore have stable
identities that depend only on the name itself and can be shared independently by
tokenizer and parser.

A UTF-8 `Vec` is signed and length-bearing; its bigint representation must not be
used directly as a BNF symbol. Add a fallible positive-sentinel conversion to
`fjs/types/bit_vec`, conceptually:

```ts
const tryToSentinel = (v: Vec): Nullable<bigint> => {
    const { length, uint } = unpack(v)
    if (length >= maxLength) { return null }
    return (1n << length) | uint
}
```

The sentinel form needs one more bit than the vector itself. `Vec` may legally
have exactly `maxLength` bits, but the corresponding positive sentinel value would
need `maxLength + 1` bits. Bun cannot represent that value and may throw while
evaluating `1n << maxLength`. Therefore sentinel conversion itself is fallible;
it must reject the exact `maxLength` vector before performing the unsupported
shift. This is an exact representability boundary of the `Vec -> bigint`
conversion, not a source-size estimate.

For vectors whose sentinel form is representable, `tryToSentinel` is the natural
inverse representation of `fromSentinel`: it preserves both logical length and
unsigned data. If a throwing convenience `toSentinel` is useful elsewhere, it may
be implemented as an unwrap of `tryToSentinel`, but bounded/fallible callers such
as token-symbol mapping must use the `try*` form directly.

For a successfully encoded UTF-8 vector and sentinel conversion, the candidate is
exactly:

```text
encoded = tryToSentinel(vec)
```

The highest `1` bit is an explicit length sentinel, so the mapping preserves
leading zero bits and is injective. For example, `"A"` and `"\0A"` have the same
unsigned payload prefix only if length is ignored; their sentinel positions differ,
so their encoded values remain distinct.

Do not precompute the UTF-8 length to predict whether the candidate fits the BNF
symbol domain. Follow the repository's bounded-encoding convention and propagate
failure through the complete encoding pipeline:

```ts
const tryTokenSymbol = (name: string): Nullable<Symbol> => {
    const vec = tryUtf8(name)
    if (vec === null) { return null }
    const encoded = tryToSentinel(vec)
    if (encoded === null) { return null }
    return 0n <= encoded && encoded < (1n << 256n) ? encoded : null
}
```

Use `tryUtf8`, not the throwing `utf8` wrapper: a token name may exceed the
bit-vector representation before a BNF-domain candidate can be produced. Then
propagate `tryToSentinel` failure as well: a UTF-8 value at the exact bit-vector
limit is a valid `Vec`, but its positive sentinel form is not representable on all
supported runtimes. The `tryTokenSymbol` contract must return `null` for both
cases, as well as for any candidate outside the ordinary BNF symbol domain.

BNF EOF is `-1`, outside the non-negative uint256 input-symbol domain. Therefore a
successful direct mapping can use the complete ordinary-symbol range
`0 .. 2^256 - 1` and cannot collide with EOF. The final validation is against the
complete actual symbol-domain invariant, `0n <= encoded && encoded < 2^256`, not
against a reserved maximal value or an estimated/precomputed source size.

For the current UTF-8 sentinel encoding, the 31-byte boundary remains a useful
derived property rather than a preflight rule: byte-aligned names up to 31 UTF-8
bytes produce values inside the uint256 symbol domain, while a 32-byte name puts
the sentinel at bit 256 and therefore returns `null` at the BNF-domain check.
Proofs should cover that boundary, but implementation should branch on the actual
`tryUtf8`, `tryToSentinel`, and symbol-domain results.

Do not make UTF-8 the only possible token mapping. The BNF layer should only care
about the resulting 256-bit `Symbol`; callers may use another deterministic
mapping when appropriate. In particular, a future mapping may represent
arbitrarily long token names with a cryptographic hash whose output fits the same
256-bit symbol type.

A token mapping must also be injective over the concrete token alphabet consumed
by a parser layer. The direct UTF-8 sentinel mapping already has this property for
every successful encoding. A mapping such as a cryptographic hash cannot prove
global injectivity, so construction/configuration of a layer that uses such a
mapping must map its complete finite set of token names and reject the
configuration if two distinct names produce the same symbol, if any mapping
returns `null`, or if any produced bigint is outside the ordinary symbol domain
`0n <= symbol && symbol < 2^256`. This rejects negative values and values wider
than the 256-bit domain uniformly. Because EOF is `-1`, restricting mappings to
that non-negative domain also excludes EOF automatically. Producer and consumer
may still compute symbols independently after that alphabet has been validated;
no ordered registration ID is introduced.

Different parser layers have different symbol alphabets, so the same numeric
symbol does not need a global meaning across byte, code-point, token, and later
layers. A mapping only needs to be deterministic and agreed upon by the producer
and consumer of that layer, injective over that layer's token names, and produce
only ordinary BNF symbols. These constraints stay local to the mapping and do not
introduce a special EOF representation in BNF parsers.

### Dependent parser designs

Any open parser design that still consumes `fjs/bnf/token_symbol` must be rebased
before that module is removed. In particular,
[new-parser](./new-parser.md) is blocked by this task and the bigint-symbol
migration. It now defines its complete DJS token-name alphabet up front, maps all
of those names through the same fallible `Symbol` mapping, validates the alphabet
before parser use, and no longer assigns raw ASCII numbers to single-character
tokens or calls `token_symbol.encoding()` for multi-character names.

### Tasks

- [ ] Add `tryToSentinel(v): Nullable<bigint>` to `fjs/types/bit_vec` as the
      fallible positive-sentinel representation corresponding to `fromSentinel`.
- [ ] Make `tryToSentinel` return `null` when the vector has exactly `maxLength`
      bits, because the sentinel form requires `maxLength + 1` bits and must not
      evaluate the unsupported Bun shift.
- [ ] Add proofs that `tryToSentinel` preserves logical length/unsigned data for
      representable vectors, round-trips with `fromSentinel` on its representable
      domain, and returns `null` without throwing for an exact-`maxLength` vector.
- [ ] If a throwing `toSentinel` convenience is added, implement it only as an
      unwrap of `tryToSentinel`; fallible encoding paths must not call it.
- [ ] Add a fallible `tryTokenSymbol(name): Nullable<Symbol>` (name may follow
      local naming conventions) that calls `tryUtf8(name)`, propagates `null`,
      calls `tryToSentinel(vec)`, propagates `null` again, and validates the
      produced value against the ordinary BNF symbol domain.
- [ ] Return `null` when UTF-8/bit-vector encoding fails, sentinel conversion
      fails, or the encoded candidate does not satisfy
      `0n <= encoded && encoded < 2^256`; do not use a UTF-8 length preflight
      check.
- [ ] Prove injectivity for every successful direct encoding, including
      preservation of leading zero bytes/bits.
- [ ] Prove the derived current boundary: 31-byte UTF-8 names succeed and 32-byte
      names return `null`, while keeping the implementation result-driven.
- [ ] Keep the mapping API independent from BNF internals so alternative mappings,
      including cryptographic hashes, can produce the same `Symbol` type.
- [ ] Require every token mapping to be injective over the concrete token alphabet
      used by a parser layer. For mappings without a mathematical injectivity
      guarantee, validate the complete configured token-name set and reject
      duplicate symbols, `null`, negative/out-of-width bigints, and other values
      outside `0 .. 2^256 - 1` before the layer is used.
- [ ] Treat EOF as `-1`; token mappings produce only non-negative uint256 symbols,
      so the full `0 .. 2^256 - 1` domain is available and EOF is excluded
      automatically.
- [ ] Keep dependent parser designs, including [new-parser](./new-parser.md),
      blocked until their token-name alphabets use this fallible `Symbol` mapping
      instead of `token_symbol.encoding()` or raw 24-bit/ASCII identities.
- [ ] Replace callers of `fjs/bnf/token_symbol` with the UTF-8 mapping and handle
      the nullable result explicitly.
- [ ] Remove `fjs/bnf/token_symbol` only after all callers and dependent designs
      have migrated.
- [ ] Update layered-parser examples/documentation to use descriptive token names
      instead of registered numeric IDs where useful.
- [ ] Add proof coverage for empty names, punctuation, keywords, embedded NUL /
      leading-zero bytes, multi-byte UTF-8 names, the 31/32-byte boundary,
      exact `bit_vec.maxLength`, bit-vector overflow, sentinel overflow,
      negative/too-wide alternative mapping results, BNF-domain overflow,
      determinism, EOF non-collision, and rejection of colliding alternative
      mappings.
- [ ] `npx tsc`, `fjs test`.

### Related

- [256-bit bigint BNF symbols](./bigint-symbols.md) — provides the full uint256
  ordinary-symbol space used by this mapping; BNF EOF remains `-1`.
- [`fjs/bnf/README.md`](../README.md#terminals-and-eof) — EOF is outside the
  physical symbol domain.
- [New parser](./new-parser.md) — consumes a validated finite token-name alphabet
  through this mapping rather than the current 24-bit registration API.
- [Layered parser](./layered-parser.md) — tokenizer output feeds the next BNF
  parser as one symbol per token plus metadata.
- [`fjs/bnf/token_symbol`](../token_symbol/README.md) — registration-based mapping
  to replace after all callers/designs migrate.
- [`fjs/text/module.f.mjs`](../../text/module.f.mjs) — existing `tryUtf8` helper and
  throwing `utf8` wrapper.
- [`fjs/types/bit_vec/module.f.mjs`](../../types/bit_vec/module.f.mjs) — signed
  length-bearing `Vec`, `maxLength`, `unpack`, and existing `fromSentinel`
  representation.
- [`fjs/types/bigint/module.f.mjs`](../../types/bigint/module.f.mjs) — defines the
  cross-runtime bigint `maxLength` and documents Bun's exact-limit behavior.
