## New parser: BNF descent over token symbols

**Priority:** P3
**Status:** open

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

This parser uses the shipped [`fjs/bnf/token_symbol`](../token_symbol/) registration
API. It was previously blocked on replacing that API with 256-bit bigint symbols
derived from token names ([bigint-symbols](./bigint-symbols.md),
[utf8-token-symbols](./utf8-token-symbols.md)); both are parked, and this parser
no longer waits on them — see
[Why the registered alphabet is enough](#why-the-registered-alphabet-is-enough).

There is also an EOF-boundary mismatch to adapt deliberately. The existing DJS
tokenizer emits a physical final `{ kind: 'eof' }` token with the final source
metadata, while the [BNF parser contract](../README.md#logical-eof-in-parser-input)
requires callers to supply only ordinary physical symbols and makes each parser
backend synthesize its one logical EOF. Feeding the tokenizer's EOF token into the symbol mapper would
therefore create a second end marker; dropping it without preserving its metadata
would lose the source position needed for failures exactly at physical end.

### Why the registered alphabet is enough

The widening was never a capacity problem. `token_symbol` holds **15,663,103**
names (`0x110000`–`0xFFFFFE`); this parser's alphabet is **21**. The 256 bits were
for a different property: deriving a symbol from the name's own UTF-8 bytes, so
producer and consumer compute it independently and no ordered list exists. A
31-byte name needs 248 bits, which is where the number came from — the length of
a *name*, not the number of names.

[`../token_symbol/README.md`](../token_symbol/README.md) already weighed that
trade and accepted the registry, including its one cost:

> The cost is that the list is append-only — inserting or reordering names shifts
> every symbol after the edit. That is acceptable because nothing persists a token
> symbol: symbols are built with the grammar, live as long as a parse, and are
> never serialized. Should they ever be written to a file, order independence
> would matter and the hash strategy is the way back.

That condition still holds here. This parser builds its encoding at construction
from one list, uses it for the length of a parse, and serializes no symbol — so
order-dependence costs it nothing, and the migration would buy it nothing it can
observe. Verified against the real alphabet: all 21 names round-trip, symbols are
injective and inside the ordinary domain, each is usable as a `oneEncode`
terminal, and names far longer than any keyword encode fine — the case that
motivated deriving symbols from bytes is already covered by a registry entry
having no length limit.

Revisit only if the trigger the README names actually arrives: a token symbol
that has to be written to a file.

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

**1. Consume the existing symbol alphabet.** Parser backends take `number`
symbols, and `token_symbol` produces `number` symbols above the Unicode range, so
this parser needs no new backend and no new symbol type. Metadata remains generic,
so ordinary parser-layer symbols are paired with their `DjsTokenWithMetadata`
values.

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
specified by [the shipped EOF contract](../README.md#logical-eof-in-parser-input).

This does **not** fabricate metadata for the logical EOF. `eofMetadata` is the
real physical-end metadata already produced by the tokenizer and is held by the
DJS parser adapter only for diagnostics. The synthesized EOF contributes no
ordinary token metadata leaf to the BNF AST.

**3. Map ordinary `DjsToken` names to symbols through the shared fallible
mapping.** Define a finite token-name alphabet for this parser layer (`{`, `}`,
`:`, `,`, `[`, `]`, `.`, `=`, `identifier`, `number`, `string`, keywords,
operators, and any other ordinary categories the grammar needs). `eof` is not a
member of that mapped alphabet. Map the names with
[`token_symbol.encoding(names)`](../token_symbol/module.f.mjs).

Every ordinary token name goes through that one encoding. Do not give
single-character tokens their ASCII/code-point numbers and multi-character names
a registered symbol: token symbols belong to a separate parser alphabet from the
code points below, and one rule for the whole alphabet is what keeps them from
colliding with it.

`encoding()` builds the alphabet once and asserts what the mapping needs —
capacity and no duplicate names — so parser setup fails on a bad alphabet rather
than a parse failing later. The token's value and source position ride along as
descent metadata, so no ordinary token information is lost.

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
shipped contract keeps public positions in the physical input domain
(`0 <= idx <= input.length`) even when a grammar consumes synthesized EOF, so
token-index callers do not need a special post-EOF `input.length + 1` case.

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

- [x] Use the shipped `number` descent API and `fjs/bnf/token_symbol`; do not
      introduce another symbol type or another token-specific backend.
- [ ] Add the DJS token-stream adapter that requires and removes exactly one
      final physical `eof` token, preserving its `TokenMetadata` separately as
      `eofMetadata` for diagnostics.
- [ ] Define the finite ordinary token-name alphabet consumed by the DJS parser
      grammar; exclude `eof` from the mapped alphabet.
- [ ] Build the alphabet's encoding once with `token_symbol.encoding(names)` at
      parser construction, and map every ordinary token name through it; do not
      give single-character names raw ASCII identities as a separate path.
- [ ] Map each ordinary `DjsToken` to its symbol, carrying the token as descent
      metadata; never feed the tokenizer's physical `eof` token to the BNF symbol
      stream.
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

- [`fjs/bnf/token_symbol`](../token_symbol/README.md) — the token-name-to-symbol
  mapping this parser uses, and where the registry's trade-offs are argued.
- [`fjs/bnf/README.md`](../README.md#logical-eof-in-parser-input) — the shipped
  EOF contract this adapter is written against.
- [256-bit bigint BNF symbols](./bigint-symbols.md) — parked; would replace the
  symbol type, and this parser no longer waits on it.
- [UTF-8 token symbols](./utf8-token-symbols.md) — parked; would replace
  `token_symbol` with name-derived symbols.
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
