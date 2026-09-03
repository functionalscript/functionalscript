# Current Priority Tasks

> Keep this file in the repository. It's personal notes.

- [ ] Browser Test
- [ ] FunctionalScript
  - [ ] AST to EDAG
- [ ] BNF
  - [ ] LL1 parser should support `Meta` propagation.
  - [ ] Check the `repeat` rule
  - [ ] Rule Transformers in the flow style (SHA2 and BNF.Map.Repeat)
  - [ ] Map creation helpers
  - [ ] checkMap should support `Meta`
  - [ ] rename `checkMap`.
  - [ ] Consider `checkMap` returns simplified map using DataRules. We may need root rule in this case.
  - [ ] Parser that apply map rules.
  - [ ] LL1 parser preparation should fail on non-LL1 grammar.
  - [ ] We need a `Ast<R extends Rule>` that creates an AST result type for a `Rule`.
  - [ ] Workflow: create BNF rules, create rule maps, then create a parser from
        a root rule, the metadata operations (`translate` and `reduce`) and the
        map rules. The parser is a `StateFold` over one input symbol at a time,
        RTTI-free — a validatable root output belongs to `checkMap`. Design and
        open questions:
        [43. Stateful parser](../fjs/bnf/todo/043-stateful-parser.md).
  - [ ] Considering a special repeat0+ rule in BNF.
- [ ] Website Module Browsing
  - [ ] Demo pages.
- [ ] Investigate using Git Commits instead of Evo
- [ ] Replace CHANGELOG with a generated from a Website.
  - [ ] Proposal: Create changelog during release.
- [ ] Reformulate "grab and implement" task. It should focus on priorities.
- [ ] EBNF: I think, the idea to use `string` as raw value is still attractive. Also, if we use the first item of an array as discriminant together with a sequence, it became inconsistent with all other eDSL we have. https://github.com/functionalscript/functionalscript/pull/1847
- [ ] convention for generated files, for example `gen_`
- [ ] remove copilot MCP and copying the MCP to VSCode.
