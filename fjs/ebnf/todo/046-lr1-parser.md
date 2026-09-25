## 46. Implement an LR(1) parser.

**Priority:** P3
**Status:** open

### Problem

This issue was filed because LL(1) could not handle line breaks in comments.
That reason no longer holds: the LL(1) token grammar
[`../lib/js`](../lib/js/module.f.mjs) reads a line comment up to its newline
and a block comment holding newlines, and `fjs/js/tokenizer`'s proof covers
both. An LR(1) backend needs a current motivation — a grammar in the tree
that LL(1) refuses — before it is worth building.

The parser targets the EBNF front end, [../module.f.mjs](../module.f.mjs),
and its serializable form, [../data/module.f.mjs](../data/module.f.mjs), as
a sibling of the LL(1) backend [../ll1/](../ll1/README.md). It produces the
AST every backend owes a grammar, `Ast<R, I, O>` — see
[`../ast`](../ast/README.md) for its shape.

### Related

- [GitHub issue #406](https://github.com/functionalscript/functionalscript/issues/406)
  — the original report.
- [GitHub issue #391](https://github.com/functionalscript/functionalscript/issues/391)
  — the same work, scoped to the current BNF structure.
- [`../ast`](../ast/README.md) — the AST the parser produces.
- [layered-parser](./layered-parser.md) — the transducer pipeline the parser
  sits at the top of.
