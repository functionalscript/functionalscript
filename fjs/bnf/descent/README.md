# Recursive Descent Parser

A recursive descent matcher backend built over the BNF data
[`RuleSet`](../data) IR, a sibling of [`../ll1`](../ll1).

`descentParser()` walks the grammar by recursive descent and preserves
per-code-point metadata, producing a metadata-aware AST. Nullability (whether
each rule can match empty input) is computed once by `emptyTagMap()` in
[`../data`](../data).

## Logical EOF and the complete cursor

The caller passes physical code points only; the matcher synthesizes the one
logical EOF after them ([`../README.md`](../README.md#logical-eof-in-parser-input)).
Internally a position is therefore a cursor over `0 .. cp.length + 1`, where
`cp.length + 1` means the synthesized EOF has been consumed — the
`(idx, eofConsumed)` pair of the shared design, written as one number because
`eofConsumed` can only be true at the physical end. One number is enough to make
every ordering the matcher needs a plain `<`: progress inside a variant,
backtracking to a frame's start, and the furthest-failure high-water mark.

The public `idx` clamps that cursor back to `input.length`, so consuming EOF
never moves a reported position, and the EOF leaf never reaches the AST.

Treating EOF consumption as progress is load-bearing, not bookkeeping: a variant
counts a zero-consumption success as its empty result and keeps trying later
branches, so if EOF matched "without moving", `repeat0Plus` over a rule that can
match EOF would take that branch forever.

## Failure reporting

A failed match's own index is not where matching stopped: a failing sequence
item rewinds it to the sequence's start, and nested failures rewind repeatedly,
so a rejected input can report index 0. A failed result therefore carries a
`DescentFailure` — the furthest position any terminal was rejected at, plus the
terminals that would have allowed progress there. That high-water mark never
rewinds, which is what makes it usable for "expected X or Y at N" diagnostics.

**`failure` is present exactly when `success` is `false`.** A successful match
has nothing to diagnose, and its own `idx` already says where matching stopped.
One case pays for that: a match can succeed *without consuming all input*, and
there `idx` still locates the stopping position but the terminals that would have
let it continue are not reported. Reporting a failure alongside a success was the
alternative, and it made every consumer ask "did this actually fail?" of a field
that was always there.

**Why a record rather than a tuple.** The result used to be
`[ast, success, idx]`, read positionally (`mr[0]`, `mr[1]`, `mr[2]`). Adding a
fourth field would have made every diagnostic consumer remember that `failure`
is element 3, so the result became `{ ast, success, idx, failure? }` and the call
sites were migrated with it. A tuple is fine at two or three elements where the
order is obvious; a fourth field carrying a nested optional record is where
naming stops being optional. One record type covers a match in progress as well,
where `failure` is likewise absent.

Terminals have no empty-match case: `emptyTagOf` in [`../data`](../data) returns
`undefined` for every terminal, so a terminal either consumes one symbol or
fails. The matcher used to branch on a nullable terminal anyway; that branch was
unreachable and has been removed.
