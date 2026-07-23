# LL(1) Parser

An LL(1) dispatch/matcher backend built over the BNF data
[`RuleSet`](../data) IR.

`dispatchMap()` compiles a `RuleSet` into a predictive dispatch map; `parser()` /
`parserRuleSet()` match input into an AST. The builder throws at build time
(`can not merge …`) when the grammar is not LL(1) — a first/first conflict.
