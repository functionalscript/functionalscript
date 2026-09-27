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
 * The source text under a subtree that holds no mapped leaf.
 * @throws On a mapped leaf: its mapping replaced the source it consumed, so there is none to give back.
 */
export const lexeme: <R extends Rule>(node: Ast<R, Utf16, { readonly id: string }>) => string
```

with `Ast` from `fjs/ebnf/ast/types.ts` and `Rule` from
`fjs/ebnf/types.ts`, generalised over the rule so a markdown node fits
as a JSON node does. The parameter type is the wide one the JSON
parser's `lexeme` takes today, and the contract is the run-time
assertion `unitAt` makes at every leaf, because the types cannot
carry it: a caller such as `numberOf` holds a `Children<typeof number,
Utf16, Out<P>>`, whose output alphabet is the parser's whole `Out<P>`,
so no call site can produce an `Ast<R, Utf16, never>` without a cast,
and a type that no caller can satisfy is not a contract. The assertion is one, and it moves here with the function: a mapped
leaf is refused, never answered with text it does not have.

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
convention, not a substitute for it. `tryLexeme`,
answering `null` instead, is the form for a caller that cannot
guarantee its subtree; none exists today, so it is not proposed. The JSON, DataJS and markdown parsers import it; `syntaxError`
may follow if it proves alphabet-level too.

### Tasks

- [ ] Move `lexeme` here with its proof; the three importers.
- [ ] `tsc`, `fjs test`.

### Related

- [../../../media/todo/parser-meta-accessors.md](../../../media/todo/parser-meta-accessors.md)
  — the accessors over the output alphabet; this is the input one.
