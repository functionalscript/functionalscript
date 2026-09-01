# Current Priority Tasks

> Keep this file in the repository.

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
  - [ ] Workflow:
    - Create BNF Rules.
    - Create Rule Maps.
    - Create a parser.
      - Parameters:
        - Root BNF rule.
        - A default Meta monoid.
        - Map rules.
      - Return: a parser.
    - A parser (firstly LL1) has:
      - an output root RTTI `RttiOutput` that can be validated
      - A StateFold object:
        - `init: ParserState`
        - `update: (state: ParserState, terminal: Meta<MI, number>) => ParserState`
        - `end: (state: ParserState) => Ts<RttiOutput>`
- [ ] Website Module Browsing
- [ ] NiX. Should `run.sh` have `--extra-experimental-features 'nix-command flakes'`? I think yes.
