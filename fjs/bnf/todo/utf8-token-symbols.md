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
reusing the existing `utf8` / bit-vector representation rather than maintaining a
separate alphabet. Short descriptive token names therefore have stable identities
that depend only on the name itself and can be shared independently by tokenizer
and parser.

`utf8(name)` returns a signed, length-bearing `Vec`; its bigint representation
must not be used directly as a BNF symbol. Add the inverse of `fromSentinel` to
`fjs/types/bit_vec`, conceptually:

```ts
const toSentinel = (v: Vec): bigint => {
    const { length, uint } = unpack(v)
    return (1n << length) | uint
}
```

Then define the direct token mapping exactly as:

```text
tokenSymbol(name) = toSentinel(utf8(name))
```

The highest `1` bit is an explicit length sentinel, so the mapping preserves
leading zero bits and is injective. For example, `"A"` and `"\0A"` have the same
unsigned payload prefix only if length is ignored; their sentinel positions differ,
so their symbols remain distinct.

Because UTF-8 vectors are byte-aligned, a 256-bit `Symbol` can directly encode at
most 31 UTF-8 bytes: 31 bytes use 248 data bits plus one sentinel bit (249 bits),
while 32 bytes require a sentinel at bit 256 and therefore 257 bits. Reject names
whose UTF-8 encoding exceeds 31 bytes instead of truncating them.

The direct encoding cannot collide with EOF. Its largest result is below `2^249`,
while BNF reserves `2^256 - 1` for EOF.

Do not make UTF-8 the only possible token mapping. The BNF layer should only care
about the resulting 256-bit `Symbol`; callers may use another deterministic
mapping when appropriate. In particular, a future mapping may represent
arbitrarily long token names with a cryptographic hash whose output fits the same
256-bit symbol type.

Different parser layers have different symbol alphabets, so the same numeric
symbol does not need a global meaning across byte, code-point, token, and later
layers. A mapping only needs to be deterministic and agreed upon by the producer
and consumer of that layer. It must reserve the BNF EOF value `2^256 - 1`; any
mapping whose natural output can equal that value must define how it avoids that
single reserved result. This stays local to the mapping and does not introduce a
special EOF representation in BNF parsers.

### Tasks

- [ ] Add `toSentinel` to `fjs/types/bit_vec` as the inverse representation of
      `fromSentinel`, with proofs that preserve logical length and unsigned data.
- [ ] Implement `tokenSymbol(name) = toSentinel(utf8(name))` for names whose UTF-8
      encoding is at most 31 bytes.
- [ ] Reject token names longer than 31 UTF-8 bytes.
- [ ] Prove injectivity for the supported direct encoding, including preservation
      of leading zero bytes/bits.
- [ ] Keep the mapping API independent from BNF internals so alternative mappings,
      including cryptographic hashes, can produce the same `Symbol` type.
- [ ] Reserve `2^256 - 1` for EOF in every token-symbol mapping.
- [ ] Replace callers of `fjs/bnf/token_symbol` with the UTF-8 mapping.
- [ ] Remove `fjs/bnf/token_symbol` after all callers migrate.
- [ ] Update layered-parser examples/documentation to use descriptive token names
      instead of registered numeric IDs where useful.
- [ ] Add proof coverage for empty names, punctuation, keywords, embedded NUL /
      leading-zero bytes, multi-byte UTF-8 names, 31-byte names, 32-byte rejection,
      determinism, and EOF non-collision.
- [ ] `npx tsc`, `fjs test`.

### Related

- [256-bit bigint BNF symbols](./bigint-symbols.md) — provides the symbol space
  used by this mapping.
- [Layered parser](./layered-parser.md) — tokenizer output feeds the next BNF
  parser as one symbol per token plus metadata.
- [`fjs/bnf/token_symbol`](../token_symbol/README.md) — registration-based mapping
  to replace.
- [`fjs/text/module.f.ts`](../../text/module.f.ts) — existing `utf8` helper.
- [`fjs/types/bit_vec/module.f.ts`](../../types/bit_vec/module.f.ts) — signed
  length-bearing `Vec`, `unpack`, and existing `fromSentinel` representation.
