## variant-reader-from-ebnf-ast. The tokenizer's private `branch` and `items` are `ebnf/ast` readers

**Priority:** P5
**Status:** open

### Problem

Every consumer of an LL(1) tree — the JSON, DataJS and Markdown parsers,
`compiler/parser/syntax` — reads it through
[`fjs/ebnf/ast`](../../../ebnf/ast/module.f.mjs)'s `unmapped` and
`symbolAt`. [`module.f.mjs`](../module.f.mjs) is the one that keeps its
own: `items`, used by `closed` and `kindOf`, is `unmapped` but for the
value its assertion reports, and
`branch` reads a variant's `[tag, child]` pair that no module exports:

```js
// js/tokenizer items                                         // ebnf/ast unmapped
const items = node => { assert(node instanceof Array, node); return node }
                                                              export const unmapped = node => { assert(node instanceof Array); return node }
// js/tokenizer branch
const branch = node => {
    assert(node instanceof Array && node.length === 2 && typeof node[0] === 'string', node)
    return [node[0], node[1]]
}
```

### Proposal

`ebnf/ast` gains `variant`, the tag-and-child reader `branch` is now, and
the tokenizer imports `variant` and `unmapped` and drops both copies.
`unmapped`'s parameter type may need to admit `unknown` for this caller.

### Tasks

- [ ] `variant` in `ebnf/ast`, proved; the tokenizer through `variant`
      and `unmapped`.
- [ ] `tsc`, `fjs test`.

### Related

- [lexical-predicates-from-text-ascii](../../identifier/todo/lexical-predicates-from-text-ascii.md)
  — the tokenizer's other private copy, `isDigit`.
