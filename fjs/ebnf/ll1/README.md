# The LL(1) backend

The `ebnf/ll1/` piece of [ebnf-migration](../../todo/ebnf-migration.md): the
reference backend, a predictive parser over the data
[`RuleSet`](../data/README.md) that builds the typed AST of
[`../ast`](../ast/types.ts). It is the machine [`../map`](../map/README.md)'s
`rewrite` was written to take its input from, and it answers what that layer
and the data layer left open: which tree a backend owes, and how a bounded
repeat is matched.

- `module.f.mjs` — `firstMap`, `parserRuleSet`, `parser`;
- `types.ts` — `FirstMap`, `MatchResult`, `Parser`.

## What it does

`parser(rule)` lowers a front-end rule with `toData` and returns a
`Parser<Ast<typeof rule>>`: a function from a list of symbols to the tree the
rule matches and the index it stopped at, or the index it failed at.
`parserRuleSet(ruleSet, entry)` is the same over a set written or read by
hand, validated on entry as `../data` validates it.

```js
const digit = range('09')
const digits = repeatFrom1(digit)

const parse = parser(digits)
parse([0x31, 0x32])        // ['ok', [[0x31, 0x32], 2]]
parse([0x31, 0x78])        // ['ok', [[0x31], 1]]   — stopped before `x`
parse([])                  // ['error', 0]          — one round is forced

const value = rewrite([
    [digit, /** @type {(d: number) => number} */ (d => d - 0x30)],
    [digits, /** @type {(ds: readonly number[]) => number} */
        (ds => ds.reduce((n, d) => n * 10 + d, 0))],
])(digits)

value(unwrap(parse([0x31, 0x32]))[0])   // 12
```

The input is a list of symbols and nothing more. The alphabet is the caller's
— code points for a text grammar, token symbols for one over tokens — within
the domain the data layer's sets are drawn from, the non-negative safe
integers: an input holding anything else is refused, since `-1` in it would
read as the end of input and nothing else in it could match a set. The end
of input is synthesized once after the last symbol, so a grammar that ends
in `eof` is matched against the whole input, and one that does not stops
where its rule does, reporting the index of the first symbol it left.

## The tree is `Ast<R>`

The front-end design's Problem 8 asked how the typed AST relates to the nodes
a backend builds, and `../map` left the backend one of two choices: build
`Ast<R>` values, which `rewrite` takes as they are, or fold the map into the
parse. This backend builds the values. What it owes each data rule kind is
what `Ast<R>` gives the form it was lowered from:

| rule | node |
|---|---|
| `['set', …]` | the symbol; EOF, which has no element, the empty node `[]` |
| `['sequence', …]` | an array, one child per item |
| `['variant', …]` | `[tag, node]` of the branch taken |
| `['repeat', min, max, item]` | **one flat array** of the rounds, whatever the bounds |

Every front-end form lowers to one of those, and the rows agree with the
`Ast<R>` table row by row: a string is a sequence of one-symbol sets, so its
node is its code points; a `const` thunk is its payload under the thunk's
name, so its node is the payload's; an option is a repeat, so its node holds
zero or one item and no `some`/`none` scaffolding. The proof pins it twice:
a document's tree is written out node by node, and a larger one is taken
through `rewrite` with nothing mapped — the identity, which refuses a tree
that is not the rule's — and comes back unchanged.

There is no `{ tag, sequence }` node, no separate conversion, and no second
engine folding the map into the parse: `rewrite` is the fold, run over the
tree once it is built. The cost is the tree, allocated whole before any
mapping runs; a consumer that finds that too much is the one that asks for
the other choice, and the map's README specifies what such a fold would owe
each mapping.

## What is refused, and where

`validate` in `../data` refuses what is no grammar. `firstMap` refuses what is
a grammar but not LL(1), because another backend may accept it and the data
layer leaves it to the backend to say:

- **left recursion** — a rule that reaches itself before consuming a symbol,
  directly, through a prefix that matches empty, through a variant's branch,
  or as the item of its own repetition. No lookahead decides it, and a
  predictive match would loop at one position forever. The classical backend
  read a repetition of itself as "matches empty"; here it is refused like any
  other, since a bounded one with a forced round would loop where the
  classical, unbounded one could not.
- **first/first conflict** — two branches of a variant beginning with a
  symbol in common, EOF included. The refusal names the rule, the second
  branch, and the symbols the two share.

Both are found before any input, when the parser is built.

A **first/follow conflict** is not detected: `[option('x'), 'x']` is
accepted, and the option takes the `x` when it sees one, so the sequence
fails on the second. That is the classical backend's behaviour too, and the
grammars in `../lib` have none; a check would need follow sets, which nothing
here computes yet.

## How a repeat is matched

The data README promised a bounded repeat's semantics and left the backend to
honour them. A round is **forced** while fewer than `min` have matched, and
**optional** until `max`: an optional round starts exactly when the lookahead
is in the item's first set. So `times(3)('')` matches empty three times — the
forced rounds match empty — and `option('')` matches it zero times, since an
optional round never starts on an item whose first set is empty. An optional
round consumes at least one symbol, which is what makes an unbounded
repetition terminate; `validate` has already refused a nullable item under
one.

## Matching without the JS call stack

Nesting depth grows with the input, not the grammar: 5000 levels of brackets
are 5000 suspended sequences. A recursive matcher overflowed the JS stack at
a few thousand code points, so the machine is a loop over one state — the
frames it has suspended, as an immutable stack on the heap, and what to do
next: enter a rule at a position, or hand a node to the innermost frame. A
repetition is one frame however many rounds it collects, and its rounds
accumulate as a list rather than an array, since appending to an array per
round would copy the prefix each time and make one repetition quadratic.

LL(1) never backtracks: the lookahead decides every choice, so a position
only ever moves forward, no frame keeps rewind state, and the first failure
is the match's — it is returned as it is, from wherever it happened.

A position is a cursor into the shared input, `0 .. length` for the physical
symbols and `length + 1` once the end of input is consumed. Consuming it is
progress — a repetition over a rule that can match EOF would otherwise never
stop — but the public index reports the length for both, so a caller that
slices the input at the index gets the remainder.

## Left for later

- **Metadata.** The input carries symbols only, so the tree carries no
  positions: [metadata](./todo/metadata.md).
- **What was expected.** A failure reports where, not what: the first set of
  the rule that failed there is available and not returned.
- **Follow sets**, for the first/follow check above.
- **A fold over the map**, should a consumer want the tree never built.
