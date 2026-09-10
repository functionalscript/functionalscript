## 46. Implement an LR(1) parser.

**Priority:** P3
**Status:** open

Implement an LR(1) parser because LL(1) can't handle break lines in comments.

The parser targets the EBNF front end, [../module.f.mjs](../module.f.mjs),
and its serializable form, [../data/module.f.mjs](../data/module.f.mjs), as
a sibling of the LL(1) backend [../ll1/](../ll1/README.md). It needs an AST
structure derived from that grammar — see
[parser-structure](./parser-structure.md) for the AST shape.

### Related

- [GitHub issue #406](https://github.com/functionalscript/functionalscript/issues/406)
  — the original report.
- [GitHub issue #391](https://github.com/functionalscript/functionalscript/issues/391)
  — the same work, scoped to the current BNF structure.
- [parser-structure](./parser-structure.md) — the AST the parser produces.
- [layered-parser](./layered-parser.md) — the transducer pipeline the parser
  sits at the top of.
