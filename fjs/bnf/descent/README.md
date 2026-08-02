# Recursive Descent Parser

A recursive descent matcher backend built over the BNF data
[`RuleSet`](../data) IR, a sibling of [`../ll1`](../ll1).

`descentParser()` walks the grammar by recursive descent and preserves
per-code-point metadata, producing a metadata-aware AST. Nullability (whether
each rule can match empty input) is computed once by `emptyTagMap()` in
[`../data`](../data).

## Failure reporting

A match result's own index is not where matching stopped: a failing sequence
item rewinds it to the sequence's start, and nested failures rewind repeatedly,
so a rejected input can report index 0. The result therefore also carries a
`DescentFailure` — the furthest position any terminal was rejected at, plus the
terminals that would have allowed progress there. That high-water mark never
rewinds, which is what makes it usable for "expected X or Y at N" diagnostics.

It is meaningful on a *successful* match too: a variant branch that failed
further along than the branch that eventually matched is still recorded, which
is what a caller needs when a parse succeeds but stops before the end of input.

**Why a fourth tuple element rather than a result record.** A record
(`{ ast, success, idx, failure }`) reads better at a call site than a 4-tuple,
but every consumer here indexes positionally (`mr[0]`, `mr[1]`, `mr[2]`), so
appending an element changed no existing code while a record would have churned
~74 call sites across two proof files for one added field. If the result grows
again, revisit — the tuple is at the width where a record starts winning.

Terminals have no empty-match case: `emptyTagOf` in [`../data`](../data) returns
`undefined` for every terminal, so a terminal either consumes one symbol or
fails. The matcher used to branch on a nullable terminal anyway; that branch was
unreachable and has been removed.
