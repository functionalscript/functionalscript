# The LL(1) backend

The `ebnf/ll1/` piece of [ebnf-migration](../../todo/ebnf-migration.md): the
reference backend, a predictive parser over the data
[`RuleSet`](../data/README.md) that builds the typed AST of
[`../ast`](../ast/README.md) and folds a rewrite set into the parse. It
answers what the data layer left open — which tree a backend owes, and how
a bounded repeat is matched — and it is the mapping layer: a mapped rule's
node is handed to its mapping as it comes into existence, and the mapping's
result stands in its place.

- `module.f.mjs` — `firstMap`, `parserRuleSet`, `parser`, `mapping`;
- `types.ts` — `FirstMap`, `MatchResult`, `Parser`, `Mapping`,
  `RewriteSet`, `Mappings`.

## What it does

`parser(rule, set)` lowers a front-end rule with `toData`, folds the rewrite
set `set` into the machine, and returns a
`Parser<Ast<typeof rule, I, O>, I>`: a function from a list of symbols, each
carrying its metadata `I`, to the tree the rule matches — every mapped
rule's node replaced by the `Meta<O>` its mapping returned — and the index
it stopped at, or the index it failed at. `parserRuleSet(ruleSet, entry)` is
the same over a set written or read by hand, validated on entry as `../data`
validates it, with nothing mapped.

```js
const digit = range('09')
const digits = repeatFrom1(digit)

/** @type {Mappings<Cp, Int>} */
const int = mapping

const parse = parser(digits, [
    int(digit, d => ({ symbol: 0, meta: { id: 'int', value: d.symbol - 0x30 } })),
    int(digits, ds => ({ symbol: 0, meta: { id: 'int', value: ds.reduce((n, d) => n * 10 + value(d), 0) } })),
])

const cp = { id: 'cp' }
parse([{ symbol: 0x31, meta: cp }, { symbol: 0x32, meta: cp }])
// ['ok', [{ symbol: 0, meta: { id: 'int', value: 12 } }, 2]]
parse([])                  // ['error', 0]          — one round is forced
```

The input is a list of `Meta` symbols and nothing more: the alphabet is the
caller's — code points for a text grammar, token symbols for one over
tokens — within the domain the data layer's sets are drawn from, the
non-negative safe integers, and the metadata is whatever the caller knows
about each symbol that the grammar does not. An input holding a symbol
outside the domain is refused, since `-1` in it would read as the end of
input and nothing else in it could match a set. The end of input is
synthesized once after the last symbol, so a grammar that ends in `eof` is
matched against the whole input, and one that does not stops where its
rule does, reporting the index of the first symbol it left.

## The tree is `Ast<R, I, O>`

The front-end design's Problem 8 asked how the typed AST relates to the
nodes a backend builds. This backend builds `Ast<R, I, O>` values, form by
form, and what it owes each data rule kind is what that type gives the form
it was lowered from:

| rule | node |
|---|---|
| `['set', …]` | the input symbol, as it arrived, metadata and all; EOF, which has no element, the empty node `[]` |
| `['sequence', …]` | an array, one child per item |
| `['variant', …]` | `[tag, node]` of the branch taken |
| `['repeat', min, max, item]` | **one flat array** of the rounds, whatever the bounds |

Every front-end form lowers to one of those, and the rows agree with the
`Ast` table row by row: a string is a sequence of one-symbol sets, so its
node is its code points; a `const` thunk is its payload under the thunk's
name, so its node is the payload's; an option is a repeat, so its node holds
zero or one item and no `some`/`none` scaffolding. A leaf is the input's own
element, so whatever the caller knows about a symbol is in the tree where
the symbol is, and nothing was allocated to put it there. The proof pins
the tree twice: a document's tree is written out node by node, and the tree
under the empty rewrite set is the tree under none.

## The rewrite set, and how it is folded

A **mapping** is a rule the author holds and a function from what the rule
matches — the rules under it already mapped — to one symbol of an alphabet,
a `Meta<O>`, that stands in the node's place. A **rewrite set** is a list of
them, one per rule, in any order. **The goal is one transformation: fold a
sequence into a symbol of another alphabet.** The code points of a number
into one `number` token; the tokens of a statement into one node; so that
the layer above parses something compact. Nothing else is the mapping's
job — not errors, not whether a name resolves, not recovery. Those belong to
the layer above, which holds the whole compact stream. A mapping reports no
errors and does not throw in normal control flow: it is a transformation
from one alphabet to another, and a `throw` in one is a panic for a broken
invariant, as [`fjs/AGENTS.md`](../../AGENTS.md) §1.5 says, and nothing
else.

`mapping(rule, f)` is the constructor of the pair, and it is bound once per
layer to the layer's metadata types by annotating a binding of it:

```js
/** @type {Mappings<Cp, Tok>} */
const tok = mapping
tok(digit, d => …)             // `d` is `Children<typeof digit, Cp, Tok>`
```

`digit` carries only its rule type and says nothing of `Cp` or `Tok`, so they
are bound where a layer begins and read from there; with them bound, a call
types `f`'s parameter as `Children<R, Cp, Tok>` from the rule, where a
function inside a list literal gets no contextual type at all. A binding
rather than a factory call, because TypeScript infers the two from the
annotation through the `Children` alias cheaply and from a call's return
type by unrolling it, past its instantiation limit (TS2589). The set is an
array, so it is assembled across modules — a grammar's mappings for its own
scaffolding beside a consumer's — and nothing in its type depends on the
whole: a part's output type is carried into the union, so a set of
`Mapping<Cp, Int>` spreads into one whose output is `Int | List`.

**What a mapping receives** is `Children<R, I, O>`, the `Ast` table with
the rule's own mapping left out, so its top is the node the machine built
and every child position may be a symbol some mapping returned:

| rule | the mapping receives |
|---|---|
| `null`, EOF | `readonly []` — no leaf |
| `n`, a symbol | `Meta<I, n>` |
| `'text'` | its symbols, `readonly Ast<number, I, O>[]` |
| `Tuple` | a tuple, one `Ast` per element |
| `Variant` | `[tag, Ast]` of the branch taken |
| `() => ['const', c]` | what a mapping of `c` would receive — the thunk *is* the rule `c` spells, and the two are one rule to the data layer |
| `() => ['set', …]` | `Meta<I>` |
| `() => ['repeat', min, max, r]` | a `BoundedArray<min, max, Ast<r, I, O>>`, one entry per round |

A value at a child position is one of two things, told apart by one test.
Not an array: a symbol, and `meta.id` says which alphabet. An array: built
by the machine from the rule at that position, so its shape is the rule's
by construction. There are no shape asserts in the fold; the asserts are the
mappings' own, on `meta.id` where a mapping expects a symbol and on
`instanceof Array` where it knows a position is unmapped — the scaffolding a
combinator like `join` builds and hands to nobody. `symbolAt` and `unmapped`
in [`../ast/module.f.mjs`](../ast/module.f.mjs) are those two tests.
[`../ast`](../ast/README.md) holds the argument.

**The parser takes the set and folds it.** The machine builds bottom-up, and
a node comes into existence at five sites — in `enter`, a set's leaf and the
empty sequence (the empty string lowers to one, so it is this site too);
and in `resume`, the end of a sequence, the variant wrap, and `round`
closing a repetition. Each hands the node to `emit` first, which applies
the rule's mapping where it has one, and frames hand `emit`'s result up
instead of the node, so `done` and `rounds` hold mapped values and the only
structure that ever exists is the unmapped region between a mapping and
the mappings below it. Frames carry their own rule name for that, which is
the whole change the fold made to the machine.

**Keyed by identity**, through the `RuleNameMap` `toData` returns:
`parser(rule, set)` translates each `[a, f]` to `[names.get(a), f]` at
build time and refuses, before any input, where the machine refuses
everything else — a rule the grammar does not hold, and a rule mapped
twice. The second matters because the set is assembled from several
sources; a `Map` built naively would let the later entry win, and the
output would depend on assembly order. Three consequences, all to keep:

- **Identity, not spelling.** The `RuleNameMap` is keyed by `===`, so a
  tuple spelled twice is two names and only the held instance is mapped: map
  the rule you hold. A rule built inside a combinator and returned to
  nobody — the `[',', item]` pair `join` makes — is not mappable, and a
  combinator that wants its scaffolding mapped returns the mappings beside
  the rule; one whose scaffolding is only ever read returns a reader of its
  shape instead — `joined` beside `join`, `items` beside `cj` in
  [`../lib/json`](../lib/json/module.f.mjs). A rule a reader wants to map is
  exported from its grammar so that it can be held: JSON's `character` and
  `escape` are, and [`fjs/media/json/parser`](../../media/json/parser/module.f.mjs)
  keys a mapping by each.
- **A string's symbol and a bare number are one rule** in the data layer,
  so mapping `97` maps the code point inside `'a'` too. Documented, not
  fought: a grammar that wants them apart spells the string as a set.
- **A `const` thunk and its payload are one rule.** `toData` lowers the
  payload under the thunk's own name and does not name the payload for it,
  so the key is the thunk. A payload held nowhere else has no name, and
  offered as a key is refused as a rule the grammar does not hold; a payload
  also reached directly elsewhere has its own name there, and a mapping
  keyed by it applies to that occurrence and not to the one under the thunk
  — the first bullet again.

**A layer boundary** is a mapping like any other. A layer's mappings return
symbols of the next alphabet; a consumer reads them out of the entry's node
— the one test, at the positions it knows were mapped — and hands them to
the next layer's parser as they are, no rename and no re-tagging, since the
`id` already says which alphabet they are. The proof's `layers` entry is a
tokenizer over text feeding a list grammar over tokens, and
[`fjs/media/json/parser`](../../media/json/parser/module.f.mjs) folds a whole
grammar, JSON's, to a JSON value in one layer — a mapping per rule the
grammar holds, and a `Result` in the output symbol for the one thing a
mapping cannot make a value of.

### Why a fold, and not a rewrite over the built tree

A separate bottom-up rewrite of `Ast<R>` values, keyed by rules and typed
per mapping, shipped first as `ebnf/map/` and is retired by the fold, for
reasons that are worth keeping:

- **The tree had to exist whole**, allocated before any mapping ran; and the
  walk recursed per node, so nesting overflowed the JS stack at a thousand
  levels where the machine parses five thousand. The fold applies a mapping
  where the node is built, in the machine's own loop, so it adds no depth
  and holds no more than the unmapped region.
- **The map had to be whole too.** Each mapping's input type depended on
  every other mapping, so a map could not be assembled from a grammar's own
  mappings and a consumer's, a mapping could not be written for a rule
  before the rest of the set existed, and a recursive rule could not be a
  key at all. With every mapping returning a `Meta<O>`, a mapping's input
  depends on `I` and `O` alone, and the set is a list.
- **Keys were matched by spelling**, as the types see it — a data rule by
  its parts, a set by its phantom spelling, a thunk by itself — which took a
  type-level walk that had to refuse a key whose type did not say its parts,
  a union, a widened bound, a set spelled from a variable; a look-alike rule
  at runtime had to be refused too, since the types could not say whether
  two were one. Identity keying through the lowering's own map has no such
  question.
- **The rewrite validated the rule it walked**, restating the lowering's
  refusals one reviewer comment at a time and only for what the tree
  exercised. The fold reads no rule: the machine already runs over the
  validated set.

What it gave up is a mapped rule's output type, which the old types could
name per rule (`Mapped<R, M>`) and these cannot: a mapped position is typed
`Meta<O>` for the layer's whole `O`, and its `id` recovers the rest. That is
the trade the data structure makes, and [`../ast`](../ast/README.md) says
why.

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
  branch, and the symbols the two share. A repetition of at most zero
  rounds begins with nothing, so it conflicts with no branch: its item is
  never entered.

The parser refuses one more, over the rules its entry reaches, from the
follow sets it computes for them — the symbols that may come right after a
match of each rule, by the standard fixpoint, with nothing required after
the entry since a match stops where its rule does:

- **first/follow conflict** — a rule whose own decision is made on a symbol
  that may also follow it. One symbol cannot decide it: the lookahead takes
  the step where the grammar also allows the rule to end and leave the
  symbol to what follows, so `[option('x'), 'x']` would never match `x`, and
  the classical backend accepted it and failed on that input. The refusal
  names the rule and the symbols.

  A rule has such a decision in two ways, and a repetition from zero has
  both, its two sets being one. It **can match empty**, so entering it at
  all is decided on what it begins with — the textbook `FIRST` against
  `FOLLOW`. Or it is a **repetition with a round to spare**, `max > min`,
  so one more round is decided on what its item begins with, even where it
  must match once and is no nullable rule: `[repeat(1, 2)('x'), 'x']` is
  refused, as `[option('x'), 'x']` is. A round below `min` is forced and a
  `max`th round impossible, so neither decides anything, and
  `[times(2)('x'), 'x']` is a grammar this backend parses.

All are found before any input, when the parser is built. A rule the entry
does not reach is dead, not wrong, as the data layer says, so a parser
leaves it alone; `firstMap` over a whole set analyses every rule of it,
dead ones included, and has no entry to compute follow sets from.

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

- **A repetition mapped as a fold** over its rounds as they arrive, so a
  top-level `repeat(statement)` holds one result at a time rather than one
  per statement until it closes:
  [repeat-fold-mapping](./todo/repeat-fold-mapping.md).
- **A precheck** of what each mapping receives, computed per name over the
  finite `RuleSet` from the mappings' declared alphabets, so a mismatch is
  refused at build: [mapping-precheck](./todo/mapping-precheck.md).
- **What was expected.** A failure reports where, not what: the first set of
  the rule that failed there is available and not returned.
- **Streaming input**, a parser as a fold over one symbol at a time, which
  [043-stateful-parser](../../bnf/todo/043-stateful-parser.md) proposes for
  the classical backend and stays open here.
