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
/** The source text under a node of the `utf16` alphabet. */
export const lexeme: (node: AstNode<Utf16>) => string
```

The JSON, DataJS and markdown parsers import it; `syntaxError` may
follow if it proves alphabet-level too.

### Tasks

- [ ] Move `lexeme` here with its proof; the three importers.
- [ ] `tsc`, `fjs test`.

### Related

- [../../../media/todo/parser-meta-accessors.md](../../../media/todo/parser-meta-accessors.md)
  — the accessors over the output alphabet; this is the input one.
