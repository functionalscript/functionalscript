## New parser: BNF descent over token symbols

**Priority:** P3
**Status:** blocked
**Blocked by:** [256-bit bigint BNF symbols](./bigint-symbols.md), [UTF-8 token symbols](./utf8-token-symbols.md)

### Problem

`parseFromTokens` (`fjs/djs/parser/module.f.ts:526`) folds a
`List<DjsTokenWithMetadata>` into an `AstModule` with a hand-written state
machine: a nine-state value alphabet (`'' | '[' | '[v' | '[,' | '{' | '{k' |
'{:' | '{v' | '{,'`) plus module framing, about 570 lines with its helpers. The
grammar it implements is written down nowhere — it lives in the control flow of
`parseValueOp`…`parseObjectCommaOp`, so the only way to know what DJS accepts is
to read the machine.

The layer below already went the other way. `fjs/djs/tokenizer` is a BNF grammar
consumed by `descentParser`, and code points are its alphabet. The parser layer
is the odd one out, even though [layered-parser](./layered-parser.md) has both
layers reusing the same BNF engine — the tokenizer emitting one symbol per
token, the parser above consuming those symbols as its alphabet.

The current `fjs/bnf/token_symbol` registration API is not the basis for this
parser anymore. [256-bit bigint BNF symbols](./bigint-symbols.md) changes the
parser alphabet to the shared bigint `Symbol` type, and
[UTF-8 token symbols](./utf8-token-symbols.md) replaces registration-based IDs
with a deterministic fallible mapping from token names to ordinary BNF symbols.
This TODO must land after those migrations rather than preserve the current
24-bit encoding API.

### Proposal

A second parser over the same token stream, built on `descentParser` and kept
alongside `parseFromTokens` until it reaches parity. Call it `new_parser` for
now; the final name, and whether it replaces `fjs/djs/parser`, are deliberately
left open.

**1. Consume the generic BNF `Symbol` alphabet.** The bigint-symbol migration
already generalizes parser backends from Unicode code-point `number` values to
the shared 256-bit bigint `Symbol` type. This parser should consume that API as-is
rather than introduce another token-specific backend or another symbol type.
Metadata remains generic, so the parser layer uses token symbols paired with
`DjsTokenWithMetadata`.

**2. Map `DjsToken` names to symbols through the shared fallible mapping.** Define
a finite token-name alphabet for this parser layer (`{`, `}`, `:`, `,`, `[`, `]`,
`.`, `=`, `identifier`, `number`, `string`, keywords, operators, and any other
categories the grammar needs). Map those names with the deterministic
`tryTokenSymbol(name): Nullable<Symbol>` API from
[UTF-8 token symbols](./utf8-token-symbols.md).

Do not preserve the current distinction where single-character tokens use their
ASCII/code-point numbers while multi-character names go through
`token_symbol.encoding()`. Token symbols belong to a separate parser alphabet;
every configured token name uses the same mapping rule.

Because the mapping is fallible, construct/validate the parser's complete finite
token alphabet before parsing. Parser setup must fail if any required token name
maps to `null` or if the configured mapping otherwise fails the domain/injectivity
requirements defined by the token-symbol task. Once validated, tokenizer and
parser can compute the same `Symbol` independently from the same token name.
The token's value and source position ride along as descent metadata, so no token
information is lost.

**3. Write the DJS grammar and fold its AST.** Express the module grammar in
`fjs/bnf` combinators over the validated token-symbol alphabet, then fold
`AstRuleMeta<DjsTokenWithMetadata>` to `AstModule`.

**4. Report positions from token metadata, never from `idx`.** `idx` in
`DescentMatchResult` is an index into the *symbol* array; on the parser layer one
symbol is a whole token, so the number says nothing about a position in a file.
Errors instead carry a **range of positions taken from the metadata**: every
matched symbol arrives with `DjsTokenWithMetadata`, so a rule's span has a first
and a last token, and each token's `TokenMetadata`
(`{ path, line, column }`, `fjs/js/tokenizer/module.f.ts:158`) gives a real
position. `ParseError` (`{ message, metadata: TokenMetadata | null }`,
`fjs/djs/parser/module.f.ts:16`) widens from a single point to that range.

**The backend side of failure reporting is already available.** A failed match
still returns an empty sequence and a rewound public input position, so neither
can locate the error by itself, but the result also carries a `DescentFailure` —
the furthest physical input position at which a terminal was rejected, plus the
terminals expected there (see
[../descent/README.md](../descent/README.md#failure-reporting)). Pair that token
index with token metadata to obtain the source position/range. The bigint-symbol
migration keeps public positions in the physical input domain even when a grammar
consumes synthesized EOF, so token-index callers do not need a special
post-EOF `input.length + 1` case.

### Open questions

Deliberately unresolved — this issue exists to hold the task, not to settle these.

- **Overlap with [157](../../djs/todo/157.md) §1.** That issue extracts the
  hand-written value machine into a factory shared by `fjs/media/json/parser`
  and `fjs/djs/parser`. If a grammar replaces the machine on the DJS side, §1
  loses one of its two consumers and the extraction stops paying for itself.
  Whichever lands first should say what happens to the other.
- **Scope of the grammar.** Whether it covers module framing (`import`, `const`,
  `export default`) or only values, with the framing left to a wrapper.
- **Where the module lives** — a `fjs/djs/new_parser/` sibling, or inside
  `fjs/djs/parser/`.

### Tasks

- [ ] Depend on the generic bigint `Symbol` descent API; do not reintroduce a
      token-specific or 24-bit symbol representation.
- [ ] Define the finite token-name alphabet consumed by the DJS parser grammar.
- [ ] Map every configured token name through the shared fallible token-symbol
      mapping; do not use `fjs/bnf/token_symbol.encoding()` or raw ASCII numeric
      identities as a separate path.
- [ ] Validate the complete token alphabet before parser use and fail setup if a
      required name cannot produce a valid ordinary `Symbol` or the configured
      mapping is not injective over the alphabet.
- [ ] Map each `DjsToken` to its validated symbol, carrying the token as descent
      metadata.
- [ ] Write the DJS grammar in `fjs/bnf` combinators.
- [ ] Fold `AstRuleMeta` into `AstModule`.
- [ ] Report errors as metadata position ranges; widen `ParseError.metadata`
      from a single `TokenMetadata` to a range, using the `DescentFailure` the
      backend returns.
- [ ] `proof.f.ts` with full coverage; `npx tsc`, `fjs t`.
- [ ] Decide the fate of `parseFromTokens` and of [157](../../djs/todo/157.md) §1.

### Related

- [256-bit bigint BNF symbols](./bigint-symbols.md) — supplies the generic
  `Symbol` parser alphabet and EOF semantics this parser consumes.
- [UTF-8 token symbols](./utf8-token-symbols.md) — supplies the deterministic
  fallible token-name mapping and replaces `fjs/bnf/token_symbol`.
- [layered-parser](./layered-parser.md) — the architecture this implements: each
  layer a BNF transducer, tokens as the alphabet of the next one.
- [tokens-with-extra-information](./tokens-with-extra-information.md) — the
  token-plus-metadata stream the parser consumes.
- [../descent/README.md](../descent/README.md) — the backend being reused.
- [../descent/README.md](../descent/README.md#failure-reporting) — the
  `DescentFailure` record errors are located from.
- [157](../../djs/todo/157.md) — the competing direction for the same code.
