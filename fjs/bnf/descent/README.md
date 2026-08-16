# Recursive Descent Parser

A recursive descent matcher backend built over the BNF data
[`RuleSet`](../data) IR, a sibling of [`../ll1`](../ll1).

`descentParser()` walks the grammar by recursive descent and preserves
per-code-point metadata, producing a metadata-aware AST. `descentParserRuleSet()`
is the same matcher over an already materialized `RuleSet`. Nullability (whether
each rule can match empty input) is computed once by `emptyTagMap()` in
[`../data`](../data).

## Repetition is flat

A `Repeat` rule ([`../data`](../data#the-repeat-rule)) is matched by iterating
its item rather than by descending into the rule again per item, so a repetition
produces **one** AST node holding a flat sequence of the items it matched:

```text
[{tag: ' ', …}, {tag: ' ', …}]     not     {tag: 'some', sequence: [' ', {tag: 'some', sequence: [' ', …]}]}
```

Per-item tags survive the change — each item keeps the node it always had, and
what disappears is the `some`/`none` scaffolding of the encoding, along with the
`none` node that used to terminate the chain. A repetition that matched nothing
is an empty node rather than a `none`-tagged one.

A round that fails ends the repetition instead of failing it, rewinding to where
that round began; the rounds before it stand. A round that succeeds without
consuming anything would repeat forever, so it is kept once and ends the
repetition — `toData()` never folds a nullable item into a `repeat`, so only a
hand-written rule set reaches that.

Rounds accumulate as a list and become an array once, when the repetition ends.
Appending to an array per round would copy the whole prefix each time, which is
what makes the obvious spelling of a flat repetition quadratic in the number of
items it matched.

The sibling [`../ll1`](../ll1#the-ast-diverges-from-the-descent-backends) backend
does *not* match this shape, for repetition or for four other constructs. Do not
write a consumer that reads "the AST" from whichever backend is at hand until
`../todo/ll1-ast-divergence.md` settles whether the two are one contract.

## What this backend does with the cursor

The position is the shared [`Cursor`](../matcher), and its mechanics live there.
What is this backend's own: it backtracks, so a cursor moves *backwards* as well
as forwards — to a frame's start when a sequence item fails, and to a round's
start when a repetition ends. One number is enough to order every comparison that
needs, as a plain `<`: progress inside a variant, the rewind, and the
furthest-failure high-water mark that outlives it.

Treating consumption of the end-of-input symbol as progress is load-bearing here
rather than bookkeeping: a variant counts a zero-consumption success as its empty
result and keeps trying later branches, so if EOF matched "without moving",
`repeat0Plus` over a rule that can match EOF would take that branch forever.

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
