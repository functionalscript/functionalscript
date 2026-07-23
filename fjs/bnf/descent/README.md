# Recursive Descent Parser

A recursive descent matcher backend built over the BNF data
[`RuleSet`](../data) IR, a sibling of [`../ll1`](../ll1).

`descentParser()` walks the grammar by recursive descent and preserves
per-code-point metadata, producing a metadata-aware AST. Nullability (whether
each rule can match empty input) is computed once by `emptyTagMap()` in
[`../data`](../data).
