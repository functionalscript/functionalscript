## lexeme-owner. Reading a UTF-16 subtree back as text belongs to the alphabet, not to the JSON parser

**Priority:** P4
**Status:** open

### Problem

This module owns the `utf16` alphabet and `units`, text to symbols. The
inverse — a parsed subtree back to its source text — is written in
`fjs/media/json/parser` as `unitAt`, `unitsUnder` and the exported
`lexeme`, and `fjs/media/datajs/parser` imports it from there. `fjs/media/markdown`,
which has no reason to depend on a JSON parser, writes its own:

```js
// fjs/media/markdown/module.f.mjs
const unitsUnder = node =>
    node instanceof Array
        ? node.flatMap(unitsUnder)
        : [symbolAt(/** @type {Meta<Utf16>} */(node)).symbol]
const lexeme = node => listToString(unitsUnder(node))
```

The copy lost the assertion the original makes, that the node's meta is
`utf16`, and replaced it with a cast. Markdown's `tryParseEntry` also
respells part of the JSON parser's `syntaxError`.

### Proposal

`lexeme` and `unitAt` move here, beside `units`:

```ts
/**
 * The source text under a parsed subtree: every leaf's code unit, in order.
 * @throws On a leaf that is not a `utf16` symbol — a mapped leaf has no source to give back, since its mapping replaced what it consumed.
 */
export const lexeme: (node: unknown) => string
```

The parameter is `unknown`, and the function is the checked boundary,
because neither caller holds a type that could carry the contract. The
JSON parser's `numberOf` holds a `Children<typeof number, Utf16,
Out<P>>`, whose output alphabet is the parser's whole `Out<P>`, so no
call site there can produce an `Ast<R, Utf16, never>` without a cast.
The markdown module holds its tree as `unknown` throughout — its `arr`
answers `readonly unknown[]` and `spanOf` and `entryOf` take `unknown`
— so an `Ast<…>` parameter of any width would need a cast at every one
of its call sites, which is what the move is meant to remove. A type
that no caller can satisfy is not a contract; the assertion at every
leaf is, and it moves here with the function, so a mapped leaf, or
anything that is not a tuple of `utf16` leaves and variant tags, is
refused rather than answered with text it does not have. Typing the
markdown tree is a separate improvement and not this issue's.

The assertion tells a leaf by its `meta.id`, so it holds only where no
output alphabet reuses the id `utf16`. That is not a new requirement
of this function but the convention every mapping already depends on:
`Meta`'s doc in `fjs/ebnf/ast/types.ts` says an alphabet's meta
carries an `id` naming that alphabet so a position typed
`Meta<I> | Meta<O>` can be told apart, and an output alphabet whose id
were `utf16` would break that for its own mapping before it ever
reached `lexeme`. The parsers' output alphabets carry their own ids —
`text`, `json` — and this module's doc states the reservation: `utf16`
names input symbols and nothing else. A leaf with that id is therefore
an input symbol by convention, and the assertion is a check of the
convention, not a substitute for it.

The JSON, DataJS and markdown parsers import it; `syntaxError` may
follow if it proves alphabet-level too. `tryLexeme`, answering `null`
instead of throwing, is the form for a caller that cannot guarantee
its subtree; none exists today, so it is not proposed.

### Tasks

- [ ] Move `lexeme` here with its proof; the three importers.
- [ ] `tsc`, `fjs test`.

### Related

- [../../../media/todo/parser-meta-accessors.md](../../../media/todo/parser-meta-accessors.md)
  — the accessors over the output alphabet; this is the input one.
