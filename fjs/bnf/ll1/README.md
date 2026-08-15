# LL(1) Parser

An LL(1) dispatch/matcher backend built over the BNF data
[`RuleSet`](../data) IR.

`dispatchMap()` compiles a `RuleSet` into a predictive dispatch map; `parser()` /
`parserRuleSet()` match input into an AST. The builder throws at build time
(`can not merge …`) when the grammar is not LL(1) — a first/first conflict.

## Repetition is not flat here

The sibling [`../descent`](../descent#repetition-is-flat) backend matches a
`Repeat` rule ([`../data`](../data#the-repeat-rule)) iteratively and emits one
flat node for it. This backend does not: `dispatchMap()` compiles a `Repeat` back
into the right-recursive chain it was folded from — dispatch on the item's first
set, then the item's own chain followed by the repeat rule again — so the AST
keeps the nested shape it always had.

The obstacle is this backend's dispatch model rather than the rule kind. A
dispatch entry *consumes* the symbol it dispatched on and continues with a chain
of rule names, so the first symbol of a nullable item is inlined into whatever
encloses it: a repetition leading a sequence (`[ws, value, ws]`) has its first
set merged into that sequence's own entries, and the rules chain those entries
carry is the only place the repetition can live on. A frame that loops cannot be
reached from there. Emitting a flat repeat node here needs a rules chain that can
name a repetition as a step — or a predictive table over a stack of rule
invocations — which is a change to the dispatch model, not to this rule kind.

## Logical EOF and the complete cursor

The caller passes physical symbols only; the matcher synthesizes the one logical
EOF after them ([`../README.md`](../README.md#logical-eof-in-parser-input)). A
rule that dispatches on `eof` consumes it at the physical end of input, once.
Internally a position is therefore a cursor over `0 .. cp.length + 1`, where
`cp.length + 1` means the synthesized EOF has been consumed — the
`(idx, eofConsumed)` pair of the shared design written as one number, because
`eofConsumed` can only be true at the physical end. The same cursor used to be a
remainder slice paired with a threaded `eofConsumed` flag; it says the same
thing, and being a number is what lets the input array be shared instead of
copied (see below).

Remainders stay physical, so consuming EOF leaves an empty remainder rather than
the `null` this backend reports when a match runs out of input. Since EOF sits
below every ordinary symbol, its dispatch entry cuts at `-2`; the dispatch map
holds decoded terminals, never stored endpoint codes.

## Matching without the JS call stack

The matcher is an explicit-stack machine, like the sibling
[`../descent`](../descent) backend's: it keeps suspended rules-chain frames on
an immutable cons-cell stack and loops, either dispatching the rule the current
task names or feeding the pending result into the innermost frame.

The JS call stack cannot do this job here. Matching recursed once per rule in a
dispatched chain, and a right-recursive rule — which is how `repeat0Plus`
encodes repetition — puts one such chain per repetition, so the depth grew with
*input length*, not grammar size: a few thousand code points were enough for
`RangeError: Maximum call stack size exceeded`. Deeply nested input reached the
same limit through the same mechanism. The explicit stack grows on the heap
instead, so depth is bounded by memory (see the `longInput` proof group).

Positions are cursors into one shared input array for the second half of the
same reason. Consuming a code point by re-slicing the remainder
(`const [, ...restCp] = cp`) copied the whole rest of the input at every step,
making a match quadratic in input length; the remainder slice a `MatchResult`
carries is materialized once, when the match returns.

LL(1) never backtracks, so a cursor only ever moves forward — which is why the
machine needs no rewind state per frame, unlike the descent backend.
