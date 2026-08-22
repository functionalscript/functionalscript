## New parser: BNF descent over token symbols

**Priority:** P3
**Status:** blocked
**Blocked by:** [256-bit bigint BNF symbols](./bigint-symbols.md), [UTF-8 token symbols](./utf8-token-symbols.md)

### Problem

`parseFromTokens` (`fjs/djs/parser/module.f.mjs:501`) folds a
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

There is also an EOF-boundary mismatch to adapt deliberately. The existing DJS
tokenizer emits a physical final `{ kind: 'eof' }` token with the final source
metadata, while the bigint BNF parser contract requires callers to supply only
ordinary physical symbols and makes each parser backend synthesize its one
logical EOF. Feeding the tokenizer's EOF token into the symbol mapper would
therefore create a second end marker; dropping it without preserving its metadata
would lose the source position needed for failures exactly at physical end.

### Proposal

Replace the hand-written implementation behind the existing `parseFromTokens`
API with a BNF/descent implementation. During development, keep a private second
implementation in `fjs/djs/parser/module.f.mjs` only long enough to run parity
proofs against the current state machine. Do not introduce a permanent
`new_parser` public surface or a new published parser module.

The BNF grammar covers the **full current DJS module grammar**, including value
syntax and module framing (`import`, `const`, `export default`). The cutover is
therefore one parser replacement rather than a value-only parser wrapped by the
old framing machine.

**1. Consume the generic BNF `Symbol` alphabet.** The bigint-symbol migration
already generalizes parser backends from Unicode code-point `number` values to
the shared 256-bit bigint `Symbol` type. This parser should consume that API as-is
rather than introduce another token-specific backend or another symbol type.
Metadata remains generic, so ordinary parser-layer symbols are paired with their
`DjsTokenWithMetadata` values.

**2. Adapt the tokenizer's physical EOF before mapping token names.** Treat the
current tokenizer's final `eof` token as a boundary record, not as a parser-layer
symbol. The adapter must split the token stream into:

```ts
{
    readonly tokens: readonly DjsTokenWithMetadata[] // ordinary physical tokens only
    readonly eofMetadata: TokenMetadata
}
```

Require the tokenizer contract to contain exactly one final `eof` token; reject a
missing or non-final EOF as an adapter/tokenizer contract error. Remove that EOF
from `tokens`, preserve its metadata as `eofMetadata`, and never pass the token
name `eof` through the ordinary token-symbol mapping. The BNF backend then sees
only physical ordinary symbols and synthesizes its single logical EOF exactly as
specified by [256-bit bigint BNF symbols](./bigint-symbols.md).

This does **not** fabricate metadata for the logical EOF. `eofMetadata` is the
real physical-end metadata already produced by the tokenizer and is held by the
DJS parser adapter only for diagnostics. The synthesized EOF contributes no
ordinary token metadata leaf to the BNF AST.

**3. Map ordinary `DjsToken` names to symbols through the shared fallible
mapping.** Define a finite token-name alphabet for this parser layer (`{`, `}`,
`:`, `,`, `[`, `]`, `.`, `=`, `identifier`, `number`, `string`, keywords,
operators, and any other ordinary categories the grammar needs). `eof` is not a
member of that mapped alphabet. Map the names with the deterministic
`tryTokenSymbol(name): Nullable<Symbol>` API from
[UTF-8 token symbols](./utf8-token-symbols.md).

Do not preserve the current distinction where single-character tokens use their
ASCII/code-point numbers while multi-character names go through
`token_symbol.encoding()`. Token symbols belong to a separate parser alphabet;
every configured ordinary token name uses the same mapping rule.

Because the mapping is fallible, construct/validate the parser's complete finite
ordinary-token alphabet before parsing. Parser setup must fail if any required
token name maps to `null` or if the configured mapping otherwise fails the
domain/injectivity requirements defined by the token-symbol task. Once validated,
tokenizer and parser can compute the same `Symbol` independently from the same
token name. The token's value and source position ride along as descent metadata,
so no ordinary token information is lost.

**4. Write the full DJS grammar and fold its AST.** Express the complete current
module grammar in `fjs/bnf` combinators over the validated token-symbol alphabet,
including module framing as well as values, then fold
`AstRuleMeta<DjsTokenWithMetadata>` to `AstModule`.

**5. Report positions from token metadata, never from `idx`.** `idx` in
`DescentMatchResult` is an index into the *physical symbol* array; on the parser
layer one symbol is a whole ordinary token, so the number says nothing about a
position in a file. Errors instead use metadata:

- if `DescentFailure.idx < tokens.length`, use the metadata of the rejected
  physical token at that index;
- if `DescentFailure.idx === tokens.length`, the failure is at physical EOF, so
  use the separately preserved `eofMetadata`.

For matched spans, every ordinary matched symbol arrives with
`DjsTokenWithMetadata`, so a rule's span has a first and last token and each
`TokenMetadata` (`{ path, line, column }`, `fjs/js/tokenizer/types.ts:99-103`)
gives a real position. `ParseError` (`{ message, metadata: TokenMetadata | null }`,
`fjs/djs/parser/types.ts:10`) widens from a single point to the required range
where applicable.

**The backend side of failure reporting is already available.** A failed match
still returns an empty sequence and a rewound public input position, so neither
can locate the error by itself, but the result also carries a `DescentFailure` —
the furthest physical input position at which a terminal was rejected, plus the
terminals expected there (see
[../descent/README.md](../descent/README.md#failure-reporting)). Pair that token
index with ordinary token metadata or `eofMetadata` using the rule above. The
bigint-symbol migration keeps public positions in the physical input domain even
when a grammar consumes synthesized EOF, so token-index callers do not need a
special post-EOF `input.length + 1` case.

### Transition and cutover

The transition is intentionally temporary and has a concrete completion
boundary.

- **Location:** keep both implementations in the existing
  `fjs/djs/parser/module.f.mjs` during parity work. The BNF implementation may use
  private helpers there, but this task does not add a temporary published
  `new_parser` module or API.
- **Scope:** the BNF implementation parses the complete token stream currently
  accepted by `parseFromTokens`, including module framing. It is not considered
  complete after value-only parity.
- **Success parity:** for every existing successful parser proof and representative
  grammar feature, both implementations must produce structurally the same
  `AstModule`.
- **Failure parity:** both implementations must reject the existing malformed
  parser corpus and new boundary cases. Exact wording of error messages need not
  be byte-identical, but the BNF error must identify the furthest relevant token
  or EOF through `TokenMetadata` and preserve the public `ParseError` contract.
- **Public API:** callers continue to use `parseFromTokens`; no consumer migration
  to a temporary parser name is required.
- **Cutover:** once the parity proofs pass, make `parseFromTokens` use the BNF
  implementation and delete the old nine-state value/module state machine and
  helpers in the same task. Do not leave two production parser implementations.

This also settles the overlap with [157](../../djs/todo/157.md) §1. The BNF
cutover supersedes the **DJS side** of that proposed shared hand-written
value-machine extraction. If §1 lands first, its DJS instantiation is temporary
and is removed at this cutover; keep the extracted factory afterward only if the
JSON side still benefits from it. If this BNF parser lands first, do not later
implement §1 as a JSON/DJS shared machine solely to recreate a DJS consumer; rebase
that parser sub-task to the remaining JSON need or mark that sub-task irrelevant.
The serializer and other independent parts of TODO 157 are unaffected.

### Tasks

- [ ] Depend on the generic bigint `Symbol` descent API; do not reintroduce a
      token-specific or 24-bit symbol representation.
- [x] Add the DJS token-stream adapter that requires and removes exactly one
      final physical `eof` token, preserving its `TokenMetadata` separately as
      `eofMetadata` for diagnostics.
- [ ] Define the finite ordinary token-name alphabet consumed by the DJS parser
      grammar; exclude `eof` from the mapped alphabet.
- [ ] Map every configured ordinary token name through the shared fallible
      token-symbol mapping; do not use `fjs/bnf/token_symbol.encoding()` or raw
      ASCII numeric identities as a separate path.
- [ ] Validate the complete ordinary-token alphabet before parser use and fail
      setup if a required name cannot produce a valid ordinary `Symbol` or the
      configured mapping is not injective over the alphabet.
- [ ] Map each ordinary `DjsToken` to its validated symbol, carrying the token as
      descent metadata; never feed the tokenizer's physical `eof` token to the
      BNF symbol stream.
- [ ] Implement the complete DJS module grammar, including module framing, in the
      existing `fjs/djs/parser/module.f.mjs`; do not create a temporary public
      parser module/API.
- [ ] Fold `AstRuleMeta` into `AstModule`.
- [ ] Report errors as metadata position ranges; widen `ParseError.metadata`
      from a single `TokenMetadata` to a range where required, using ordinary
      token metadata for `idx < tokens.length` and `eofMetadata` for
      `idx === tokens.length`.
- [ ] Add differential success proofs requiring structurally identical
      `AstModule` output from the hand-written and BNF implementations across the
      existing parser corpus and every module/value grammar feature.
- [ ] Add failure-parity proofs for the existing malformed corpus plus empty
      input, failure at EOF, missing/non-final physical tokenizer EOF, and no
      duplicate EOF symbol.
- [ ] After parity passes, switch the existing `parseFromTokens` implementation
      to BNF and delete the old hand-written parser state machine/helpers; do not
      leave both production implementations.
- [ ] Rebase [157](../../djs/todo/157.md) §1 according to which parser work lands
      first; do not recreate a shared DJS hand-written value machine after the BNF
      cutover.
- [ ] `proof.f.mjs` with full coverage; `npx tsc`, `fjs t`.

### Related

- [256-bit bigint BNF symbols](./bigint-symbols.md) — supplies the generic
  `Symbol` parser alphabet and parser-synthesized EOF semantics this adapter
  consumes.
- [UTF-8 token symbols](./utf8-token-symbols.md) — supplies the deterministic
  fallible ordinary-token-name mapping and replaces `fjs/bnf/token_symbol`.
- [layered-parser](./layered-parser.md) — the architecture this implements: each
  layer a BNF transducer, tokens as the alphabet of the next one.
- [tokens-with-extra-information](./tokens-with-extra-information.md) — the
  token-plus-metadata stream the parser consumes.
- [../descent/README.md](../descent/README.md) — the backend being reused.
- [../descent/README.md](../descent/README.md#failure-reporting) — the
  `DescentFailure` record errors are located from.
- [157](../../djs/todo/157.md) — its parser §1 may temporarily precede this task,
  but the DJS side is superseded when this BNF parser cuts over; its independent
  serializer work is unaffected.
