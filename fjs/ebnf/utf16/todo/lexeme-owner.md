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
/** The source text under a node parsed over the `utf16` alphabet. */
export const lexeme: <R extends Rule>(node: Ast<R, Utf16, { readonly id: string }>) => string
```

with `Ast` from `fjs/ebnf/ast/types.ts` and `Rule` from
`fjs/ebnf/types.ts` — the type the JSON parser's `lexeme` already
takes, generalised over the rule so a markdown node fits as a JSON node
does. The JSON, DataJS and markdown parsers import it; `syntaxError`
may follow if it proves alphabet-level too.

### Tasks

- [ ] Move `lexeme` here with its proof; the three importers.
- [ ] `tsc`, `fjs test`.

### Related

- [../../../media/todo/parser-meta-accessors.md](../../../media/todo/parser-meta-accessors.md)
  — the accessors over the output alphabet; this is the input one.
