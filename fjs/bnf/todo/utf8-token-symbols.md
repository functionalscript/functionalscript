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

The default mapping should derive the symbol from the token name's UTF-8 encoding,
reusing the existing `utf8` / bit-vector representation rather than maintaining a
separate alphabet. Short descriptive token names therefore have stable identities
that depend only on the name itself and can be shared independently by tokenizer
and parser.

The exact packing from UTF-8 into the unsigned 256-bit symbol domain must be
canonical and injective for every name it accepts, including names whose UTF-8
bytes contain leading zero bits. It should reject names that do not fit instead
of silently truncating them. The practical inline-name limit will be slightly
below 32 UTF-8 bytes once the representation preserves length/tag information.

Do not make UTF-8 the only possible token mapping. The BNF layer should only care
about the resulting 256-bit `Symbol`; callers may use another deterministic
mapping when appropriate. In particular, a future mapping may represent
arbitrarily long token names with a cryptographic hash whose output fits the same
256-bit symbol type.

Different parser layers have different symbol alphabets, so the same numeric
symbol does not need a global meaning across byte, code-point, token, and later
layers. A mapping only needs to be deterministic and agreed upon by the producer
and consumer of that layer. It must still respect BNF's reserved EOF value.

### Tasks

- [ ] Define a deterministic token-name-to-`Symbol` mapping based on UTF-8.
- [ ] Specify and prove the canonical packing, including preservation of length
      and leading zero bits.
- [ ] Reject token names that cannot be represented inline in the 256-bit symbol.
- [ ] Keep the mapping API independent from BNF internals so alternative mappings,
      including cryptographic hashes, can produce the same `Symbol` type.
- [ ] Replace callers of `fjs/bnf/token_symbol` with the UTF-8 mapping.
- [ ] Remove `fjs/bnf/token_symbol` after all callers migrate.
- [ ] Update layered-parser examples/documentation to use descriptive token names
      instead of registered numeric IDs where useful.
- [ ] Add proof coverage for punctuation, keywords, multi-byte UTF-8 names,
      boundary-length names, overflow, determinism, and EOF non-collision.
- [ ] `npx tsc`, `fjs test`.

### Related

- [256-bit bigint BNF symbols](./bigint-symbols.md) — provides the symbol space
  used by this mapping.
- [Layered parser](./layered-parser.md) — tokenizer output feeds the next BNF
  parser as one symbol per token plus metadata.
- [`fjs/bnf/token_symbol`](../token_symbol/README.md) — registration-based mapping
  to replace.
- [`fjs/text/module.f.ts`](../../text/module.f.ts) — existing `utf8` helper.
