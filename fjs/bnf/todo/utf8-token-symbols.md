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
used directly as a BNF symbol. Add the inverse of `fromSentinel` to
`fjs/types/bit_vec`, conceptually:

```ts
const toSentinel = (v: Vec): bigint => {
    const { length, uint } = unpack(v)
    return (1n << length) | uint
}
```

For a successfully encoded UTF-8 vector, the candidate is exactly:

```text
encoded = toSentinel(vec)
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
    const encoded = toSentinel(vec)
    return encoded < eofSymbol ? encoded : null
}
```

Use `tryUtf8`, not the throwing `utf8` wrapper: a token name may exceed the
bit-vector representation before a BNF-domain candidate can be produced. The
`tryTokenSymbol` contract must return `null` for that case as well as for a
candidate outside the ordinary BNF symbol domain.

`eofSymbol` is the maximal 256-bit value reserved by BNF. Thus a successful
direct mapping is always an ordinary BNF symbol and can never collide with EOF.
The validation is against the actual encoded candidate, not against an estimated
or precomputed source size.

For the current UTF-8 sentinel encoding, the 31-byte boundary remains a useful
derived property rather than a preflight rule: byte-aligned names up to 31 UTF-8
bytes produce values below the ordinary-symbol limit, while a 32-byte name puts
the sentinel at bit 256 and therefore returns `null`. Proofs should cover that
boundary, but implementation should branch on the actual `tryUtf8` / encoded
results.

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
returns `null`, or if any result is reserved EOF. Producer and consumer may still
compute symbols independently after that alphabet has been validated; no ordered
registration ID is introduced.

Different parser layers have different symbol alphabets, so the same numeric
symbol does not need a global meaning across byte, code-point, token, and later
layers. A mapping only needs to be deterministic and agreed upon by the producer
and consumer of that layer, injective over that layer's token names, and exclude
the BNF EOF value `2^256 - 1`. These constraints stay local to the mapping and do
not introduce a special EOF representation in BNF parsers.

### Tasks

- [ ] Add `toSentinel` to `fjs/types/bit_vec` as the inverse representation of
      `fromSentinel`, with proofs that preserve logical length and unsigned data.
- [ ] Add a fallible `tryTokenSymbol(name): Nullable<Symbol>` (name may follow
      local naming conventions) that calls `tryUtf8(name)`, propagates `null`,
      computes `toSentinel(vec)` only for a successful vector, and validates the
      produced value against the ordinary BNF symbol domain.
- [ ] Return `null` when UTF-8/bit-vector encoding fails or when the encoded
      candidate is outside the ordinary symbol domain/reserved EOF; do not use a
      UTF-8 length preflight check.
- [ ] Prove injectivity for every successful direct encoding, including
      preservation of leading zero bytes/bits.
- [ ] Prove the derived current boundary: 31-byte UTF-8 names succeed and 32-byte
      names return `null`, while keeping the implementation result-driven.
- [ ] Keep the mapping API independent from BNF internals so alternative mappings,
      including cryptographic hashes, can produce the same `Symbol` type.
- [ ] Require every token mapping to be injective over the concrete token alphabet
      used by a parser layer. For mappings without a mathematical injectivity
      guarantee, validate the complete configured token-name set and reject
      duplicate symbols, `null`, and reserved EOF before the layer is used.
- [ ] Reserve `2^256 - 1` for EOF in every token-symbol mapping.
- [ ] Replace callers of `fjs/bnf/token_symbol` with the UTF-8 mapping and handle
      the nullable result explicitly.
- [ ] Remove `fjs/bnf/token_symbol` after all callers migrate.
- [ ] Update layered-parser examples/documentation to use descriptive token names
      instead of registered numeric IDs where useful.
- [ ] Add proof coverage for empty names, punctuation, keywords, embedded NUL /
      leading-zero bytes, multi-byte UTF-8 names, the 31/32-byte boundary,
      bit-vector overflow, BNF-domain overflow, determinism, EOF non-collision,
      and rejection of colliding alternative mappings.
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
  length-bearing `Vec`, `unpack`, and existing `fromSentinel` representation.
