# LL(1) Parser

An LL(1) dispatch/matcher backend built over the BNF data
[`RuleSet`](../data) IR.

`dispatchMap()` compiles a `RuleSet` into a predictive dispatch map; `parser()` /
`parserRuleSet()` match input into an AST. The builder throws at build time when
the grammar is not LL(1): `can not merge …` for a first/first conflict, and
`left recursion …` for a rule reachable from itself in first position — a
grammar no lookahead can decide, whose match would loop at the same position
forever. The one self-reference with a sound reading is a `Repeat` of itself:
zero rounds match whatever the item does, so it dispatches on nothing and
matches empty.

## The AST matches the descent backend's

Both backends consume the same `RuleSet`, and the AST it implies is one
contract ([`../README.md`](../README.md#the-ast-is-one-contract)): a node per
rule *invocation*. A rule is entered *before* its first symbol is consumed —
the dispatch map only selects a variant's branch (or a repetition's next round)
by lookahead — so every rule invocation owns its node: the leading item of a
sequence keeps its own node, a nullable item that matched empty leaves an empty
node saying it was considered, a taken variant tags the branch's own node, and
grouping survives (`[[A, B], C]` and `[A, B, C]` build distinguishable ASTs).

A `Repeat` rule ([`../data`](../data#the-repeat-rule)) is matched iteratively:
one more round starts exactly while the lookahead is in the item's first set,
and the whole repetition is **one** node holding a flat sequence of the items
it matched ([`../descent`](../descent/README.md#repetition-is-flat)). The
first set of a repetition leading a sequence is still inlined into that
sequence's dispatch entry at build time — first sets compose that way — but
selection is all the entry carries, so the repetition matches as an ordinary
rule invocation wherever it appears.

The `descentEquivalence` proof group pins the shared shapes case by case —
one grammar, both backends, one expected AST — and the `parser` group asserts
the whole JSON-like test grammar produces the same AST as `bnf/descent`.

What still differs is failure handling, not the AST: `bnf/descent` backtracks
and reports a furthest-failure record, while this backend commits to every
dispatch, so a failed match's remainder is simply where matching stopped, and
running out of input is reported as a `null` remainder rather than a failure.

## What this backend does with the cursor

The position is the shared [`Cursor`](../matcher), and its mechanics live there.
What is this backend's own: LL(1) never backtracks, so a cursor only ever moves
forward — which is why the machine needs no rewind state per frame, unlike
[`../descent`](../descent). A rule that dispatches on `eof` consumes the
synthesized end-of-input symbol at the physical end, once.

Remainders stay physical, so consuming EOF leaves an empty remainder rather than
the `null` this backend reports when a match runs out of input. Since EOF sits
below every ordinary symbol, its dispatch entry cuts at `-2`; the dispatch map
holds decoded terminals, never stored endpoint codes.

The cursor used to be a remainder slice paired with a threaded `eofConsumed`
flag. It says the same thing, and being a number is what lets the input array be
shared instead of copied (see below).

## Matching without the JS call stack

The matcher is an explicit-stack machine, like the sibling
[`../descent`](../descent) backend's: it keeps suspended sequence and
repetition frames on an immutable cons-cell stack and loops, either walking the
rule the current task names or feeding the pending result into the innermost
frame.

The JS call stack cannot do this job here: nesting depth grows with *input
length*, not grammar size — 5000 bracket levels in the JSON-like test grammar
are 5000 suspended sequences — so a recursive matcher overflowed at a few
thousand code points. The explicit stack grows on the heap instead, so depth is
bounded by memory (see the `longInput` proof group). A repetition adds no depth
at all: it is matched iteratively, one frame however many items it collects.

Positions are cursors into one shared input array for the second half of the
same reason. Consuming a code point by re-slicing the remainder
(`const [, ...restCp] = cp`) copied the whole rest of the input at every step,
making a match quadratic in input length; the remainder slice a `MatchResult`
carries is materialized once, when the match returns.
