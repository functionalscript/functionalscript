# LL(1) Parser

An LL(1) dispatch/matcher backend built over the BNF data
[`RuleSet`](../data) IR.

`dispatchMap()` compiles a `RuleSet` into a predictive dispatch map; `parser()` /
`parserRuleSet()` match input into an AST. The builder throws at build time
(`can not merge …`) when the grammar is not LL(1) — a first/first conflict.

## Logical EOF

The caller passes physical symbols only; the matcher synthesizes the one logical
EOF after them ([`../README.md`](../README.md#logical-eof-in-parser-input)). A
rule that dispatches on `eof` consumes it at the physical end of input, once —
the match threads an `eofConsumed` flag alongside the remainder, which is the
`(idx, eofConsumed)` cursor in this backend's remainder-shaped form.

Remainders stay physical, so consuming EOF leaves an empty remainder rather than
the `null` this backend reports when a match runs out of input. Since EOF sits
below every ordinary symbol, its dispatch entry cuts at `-2`; the dispatch map
holds decoded terminals, never stored endpoint codes.
