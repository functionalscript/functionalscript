## New parser: BNF descent over token symbols

**Priority:** P3
**Status:** open

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

The piece that was missing is now in place: `fjs/bnf/token_symbol` gives
multi-character operators and keywords a symbol of their own, so a token stream
can be presented to a BNF parser as a plain symbol stream.

### Proposal

A second parser over the same token stream, built on `descentParser` and kept
alongside `parseFromTokens` until it reaches parity. Call it `new_parser` for
now; the final name, and whether it replaces `fjs/djs/parser`, are deliberately
left open.

**1. Generalize the descent alphabet.** `descentParser`
(`fjs/bnf/descent/module.f.ts:58`) is already generic over metadata `T`, and its
alphabet is `CodePointMeta<T> = readonly[CodePoint, T]` where `CodePoint =
number` (`fjs/text/utf16/module.f.ts:50`). A token symbol is also a number in
the same 24-bit space, so this is a widening and a rename (`CodePointMeta` →
`SymbolMeta`, `CodePoint` → a symbol type), not a new backend. Matching goes
through `rangeContains` on a `TerminalRange` and is unchanged.

**2. Map `DjsToken` to a symbol.** Single-character operators (`{ } : , [ ] . =`)
map to themselves, token categories get one ASCII symbol each (`i` identifier,
`0` number, `s` string, …), and keywords plus anything multi-character come from
`encoding()` in [token_symbol](../token_symbol/README.md). The token's value and
source position ride along as the descent parser's metadata — instantiate it at
`T = DjsTokenWithMetadata` and nothing is lost.

**3. Write the DJS grammar and fold its AST.** The module grammar in `fjs/bnf`
combinators over that alphabet, then a fold from `AstRuleMeta<T>` to `AstModule`.

**4. Report positions from token metadata, never from `idx`.** `idx` in
`DescentMatchResult` is an index into the *symbol* array; on the parser layer one
symbol is a whole token, so the number says nothing about a position in a file.
Errors instead carry a **range of positions taken from the metadata**: every
matched symbol arrives as `readonly[symbol, DjsTokenWithMetadata]`, so a rule's
span has a first and a last token, and each token's `TokenMetadata`
(`{ path, line, column }`, `fjs/js/tokenizer/module.f.ts:158`) gives a real
position. `ParseError` (`{ message, metadata: TokenMetadata | null }`,
`fjs/djs/parser/module.f.ts:16`) widens from a single point to that range.

`idx` is not a usable fallback even for picking which token to blame. On a failed
sequence item the backend rewinds to the enclosing sequence's start —
`result = mrFail(frame.tag, [], frame.startIdx)`
(`fjs/bnf/descent/module.f.ts:161-162`) — so a failed match reports the start of
the enclosing rule rather than where matching stopped, often index 0. Making the
backend able to say where a parse stopped means tracking the furthest failure
position, and the terminals expected there, inside `fjs/bnf/descent`. That is a
separate change to the backend, worth doing for message quality but not required
by the metadata-range scheme above.

### Open questions

Deliberately unresolved — this issue exists to hold the task, not to settle these.

- **Overlap with [157](../../djs/todo/157.md) §1.** That issue extracts the
  hand-written value machine into a factory shared by `fjs/media/json/parser`
  and `fjs/djs/parser`. If a grammar replaces the machine on the DJS side, §1
  loses one of its two consumers and the extraction stops paying for itself.
  Whichever lands first should say what happens to the other.
- **Furthest-failure tracking in `fjs/bnf/descent`.** Whether to add it as part
  of this work or as its own issue — see proposal item 4. Without it the parser
  can report *that* input was rejected, with the offending rule's position range,
  but not the precise token where matching stopped.
- **Scope of the grammar.** Whether it covers module framing (`import`, `const`,
  `export default`) or only values, with the framing left to a wrapper.
- **Where the module lives** — a `fjs/djs/new_parser/` sibling, or inside
  `fjs/djs/parser/`.

### Tasks

- [ ] Generalize the descent alphabet from code points to symbols
- [ ] Map `DjsToken` to symbols, with the token as descent metadata
- [ ] Write the DJS grammar in `fjs/bnf` combinators
- [ ] Fold `AstRuleMeta` into `AstModule`
- [ ] Report errors as metadata position ranges; widen `ParseError.metadata`
      from a single `TokenMetadata` to a range
- [ ] `proof.f.ts` with full coverage; `npx tsc`, `fjs t`
- [ ] Decide the fate of `parseFromTokens` and of [157](../../djs/todo/157.md) §1

### Related

- [layered-parser](./layered-parser.md) — the architecture this implements: each
  layer a BNF transducer, tokens as the alphabet of the next one
- [tokens-with-extra-information](./tokens-with-extra-information.md) — the
  token-plus-metadata stream the parser consumes
- [../token_symbol/README.md](../token_symbol/README.md) — symbols for
  multi-character tokens
- [../descent/README.md](../descent/README.md) — the backend being generalized
- [157](../../djs/todo/157.md) — the competing direction for the same code
