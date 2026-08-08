## Encode token names as BNF symbols

**Priority:** P3
**Status:** blocked
**Blocked by:** [256-bit bigint BNF symbols](./bigint-symbols.md)

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
    return 0n <= encoded && encoded < eofSymbol ? encoded : null
}
```

Use `tryUtf8`, not the throwing `utf8` wrapper: a token name may exceed the
bit-vector representation before a BNF-domain candidate can be produced. Then
propagate `tryToSentinel` failure as well: a UTF-8 value at the exact bit-vector
limit is a valid `Vec`, but its positive sentinel form is not representable on all
supported runtimes. The `tryTokenSymbol` contract must return `null` for both
cases, as well as for any candidate outside the ordinary BNF symbol domain.

`eofSymbol` is the maximal 256-bit value reserved by BNF. Thus a successful
direct mapping is always an ordinary BNF symbol and can never collide with EOF.
The final validation is against the complete actual symbol-domain invariant,
`0n <= encoded && encoded < eofSymbol`, not merely against the exact EOF value or
an estimated/precomputed source size.

For the current UTF-8 sentinel encoding, the 31-byte boundary remains a useful
derived property rather than a preflight rule: byte-aligned names up to 31 UTF-8
bytes produce values below the ordinary-symbol limit, while a 32-byte name puts
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
`0n <= symbol && symbol < eofSymbol`. This rejects negative values, values wider
than the 256-bit domain, and reserved EOF uniformly. Producer and consumer may
still compute symbols independently after that alphabet has been validated; no
ordered registration ID is introduced.

Different parser layers have different symbol alphabets, so the same numeric
symbol does not need a global meaning across byte, code-point, token, and later
layers. A mapping only needs to be deterministic and agreed upon by the producer
and consumer of that layer, injective over that layer's token names, and produce
only ordinary BNF symbols. These constraints stay local to the mapping and do not
introduce a special EOF representation in BNF parsers.

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
      `0n <= encoded && encoded < eofSymbol`; do not use a UTF-8 length preflight
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
      duplicate symbols, `null`, negative/out-of-width bigints, and reserved EOF
      before the layer is used.
- [ ] Reserve `2^256 - 1` for EOF in every token-symbol mapping; every successful
      mapping result must be in `0 .. EOF - 1`.
- [ ] Replace callers of `fjs/bnf/token_symbol` with the UTF-8 mapping and handle
      the nullable result explicitly.
- [ ] Remove `fjs/bnf/token_symbol` after all callers migrate.
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

- [256-bit bigint BNF symbols](./bigint-symbols.md) — provides the symbol space
  used by this mapping.
- [Layered parser](./layered-parser.md) — tokenizer output feeds the next BNF
  parser as one symbol per token plus metadata.
- [`fjs/bnf/token_symbol`](../token_symbol/README.md) — registration-based mapping
  to replace.
- [`fjs/text/module.f.ts`](../../text/module.f.ts) — existing `tryUtf8` helper and
  throwing `utf8` wrapper.
- [`fjs/types/bit_vec/module.f.ts`](../../types/bit_vec/module.f.ts) — signed
  length-bearing `Vec`, `maxLength`, `unpack`, and existing `fromSentinel`
  representation.
- [`fjs/types/bigint/module.f.ts`](../../types/bigint/module.f.ts) — defines the
  cross-runtime bigint `maxLength` and documents Bun's exact-limit behavior.
