## ebnf-range-set. A range-set terminal instead of a variant of ranges

**Priority:** P3
**Status:** open
**Blocked by:** nothing for the value type and the algebra; the terminal form
lands with [ebnf-front-end](./ebnf-front-end.md) and shares its Problem 1
(the IR carrier) — see [Decide with the bounded repeat](#decide-with-the-bounded-repeat).

### Problem

A terminal is one packed range, so a *set* of ranges is spelled as a choice.
`remove`, `not` and `notSet` in `fjs/bnf/module.f.mjs` return a `RangeVariant`
keyed by hex strings, and `set('abc')` a variant keyed by characters. The
author means a set; the parser sees a variant. That costs four things:

- **AST pollution.** Every character matched through
  `remove(range(...), set('"\\'))` in `fjs/bnf/lib/json` and the `djs`
  tokenizer becomes its own node tagged `0x000020_000021` or similar — a
  generated name in the AST contract, one node per character.
- **IR bloat.** `toData` turns each range of a complement into an anonymous
  rule plus a variant: a three-range complement is four serialized rules.
- **Set algebra in the wrong module.** `removeOne` is a hand-rolled range
  difference over packed numbers inside the grammar front end, while
  `fjs/types/range_set` has only `fromRange`, `merge` and `get` — no
  complement, no difference, no way back to ranges.
- **An implicit universe.** `not` complements over `fullRange`, which is every
  ordinary symbol including token symbols above Unicode. Harmless for
  code-point input, silently over-broad for the token-symbol alphabet
  `fjs/djs/parser` feeds through the same matcher. The stale note at
  `fjs/djs/tokenizer/module.f.mjs:249` about `not` versus
  `remove(unicodeRange, …)` is the same confusion surfacing.

The packed `TerminalRange` also does not survive the bigint domain
([terminal-range-representation](./terminal-range-representation.md)).

### Proposal

**What this issue fixes, and what it leaves open.** Fixed: the value's
meaning — a canonical toggle list over the number line — and the terminal's
contract: ordinary symbols only, one symbol leaf, validated before the
algebra sees it, clipped to the domain, safe-integer boundaries. Open, and
the implementer's: export names and lists (`fjs/types/range_set` already
ships `rangeSet` with `isRangeSet`, `empty` and `full` in
[#1874](https://github.com/functionalscript/functionalscript/pull/1874),
and that is the validating constructor a lowering calls), the order of
checks beyond what soundness needs, helper signatures, and how proofs are
grouped. Where this text and shipped code disagree, the code and its proof
are the record, and this issue is corrected to match rather than the other
way round.

#### The value: a toggle list

A range set is a strictly increasing list of boundaries over the universe
`-Infinity..Infinity`. Reading from `-Infinity` the set starts *off*; each
boundary toggles it.

```ts
type RangeSet = readonly number[]   // strictly increasing
```

| set | meaning |
|---|---|
| `[]` | empty |
| `[-Infinity]` | the universe |
| `[0.5, 1.5]` | the reals `0.5 <= x < 1.5` |
| `[0]` | every ordinary symbol; today's `fullRange` |
| `[-1, 0]` | EOF only; today's `eof` |
| `[0x30, 0x3A]` | `0..9`; today's `range('09')` |
| `[0, 0x110000]` | Unicode; today's `unicodeRange` |

**No operation takes a universe.** The generic module is over the whole number
line, so `complement` is the toggle at `-Infinity`, and union, intersection,
difference and `contains` never needed one. A *domain* is just a set value the
consumer intersects with — see [Two complements](#two-complements-two-names).

**The boundaries are any numbers but `NaN`, not just integers.** A run is
half-open, `[a, b)`, and the algebra only ever *compares* boundaries — it
never adds one — so nothing in `range_set` knows what the successor of a
number is. Integer-ness enters in exactly three places, and all three are the
terminal layer's: the closed range `a..b` and the singleton `x`, which need
`b + 1` and `x + 1`; `toRangeMap`, because `range_map` entries carry an
*inclusive* upper bound, so `[a, b)` becomes `b - 1`; and the domain, whose
lowering demands integer boundaries. Those are three helpers in
`fjs/ebnf/terminal/`, not a second range-set module: EBNF is the only
consumer that cares, and `fjs/media/nix` builds its sets from `[a, b + 1]`
directly.

**Boundaries are half-open**: a boundary starts the next run, so a closed
range `a..b` is `[a, b + 1]`, and every packed literal in the tree today reads
inclusive. State this once, in the module doc, and nowhere else.

Properties, each one a reason to prefer this over a list of ranges:

- **Canonical by construction.** One spelling per set, so structural equality
  is set equality and content addressing works without a normalization pass.
  Validation is the whole guarantee: strictly increasing, which rejects
  `[5, 5]` and `[5, 4]`; plus no `NaN`, checked explicitly — a lone `[NaN]`
  is never compared with anything, so ordering alone would let it through —
  no `Infinity` (a run starting there is empty, so `[Infinity]` would be a
  second spelling of `[]`) and no `-0` (a second spelling of `0` under
  `Object.is`). `-Infinity` needs no rule: strictly increasing already
  confines it to the first position.
- **Complement is one toggle.** Adding or removing a leading `-Infinity`.
  Union, intersection and difference are one parity merge over two sorted
  lists. Membership is a binary search plus the parity of the position.
- **Open above for free.** An odd-length set runs to `Infinity`, so
  `fullRange`, `unicodeMax` and the 24-bit codec leave grammars, and no module
  needs to know the domain maximum: an open tail converts to a `range_map`
  entry whose upper bound is `Infinity`, which `get` already handles.
- **The cost.** `-Infinity` is not JSON and has no bigint. It never reaches
  the IR — lowering intersects with the domain, below — but a bigint range
  set later cannot toggle at a bottom it cannot spell, so it takes its own
  bottom or ships without a generic complement. That is that module's
  problem, not this one's.

`fjs/types/range_set` **is** this type — the `RangeMap<boolean>` that used to
be there is gone, along with its one consumer's use of it
(`fjs/media/nix/module.f.mjs`, which builds its sets from `[a, b + 1]`), and
there are not two. The module exports the algebra (`contains`, `union`,
`intersection`, `complement`, `difference`), the half-open `fromRange`, and
`rangeSet`, `empty` and `full` with `isRangeSet` for the validation they panic
on; `toRangeMap`, which is what the LL(1) dispatch map is built from, is the
terminal layer's. A probe outside the universe panics too — `contains(s)(NaN)`
and `contains(s)(Infinity)` — since no set can say whether such a value is a
member, and answering `false` would put it in neither a set nor its
complement.

**The empty set is a value, not a rule.** As a value it is the identity for
union and belongs in the algebra. As a terminal it is a rule that can never
match — a grammar error, like a nullable body under an unbounded repeat — and
the lowering rejects it.

#### The terminal form

In [ebnf-front-end](./ebnf-front-end.md) the `Info` row `['range', a, b]` is
**replaced**, not joined, by

```ts
type Info =
    | readonly ['const', Const]
    | readonly ['set', ...RangeSet]                 // ordinary symbols in the set
    | readonly ['repeat', number, number, Rule]
```

`() => ['set']` is the empty set, and rejected as a terminal — but see
**Amended** below, where it becomes the lowering's call. A bare `number`
stays as sugar: `0x61` means `['set', 0x61, 0x62]` and has the same AST row.
`string` is unchanged.

**Authors never write the tuple** — constructors are the API, as
ebnf-front-end says of every `Info` form.

**Amended.** This issue proposed one injection from a set value to a rule:

```js
export const oneOf = s => () => ['set', ...s]
```

so that `range`, `set` and `not` would return *values* and a grammar would
write `oneOf(range('09'))`. The shipped front end does not have `oneOf`:
`range`, `set`, `union` and `remove` each return the terminal rule directly,
and the JSON string body is `repeatFrom0({ c: remove(range(…), set('"\\')), … })`
rather than a `oneOf` around a difference.

The hazard the split was for is real and is handled by the carrier rather
than by a constructor: a raw set as an element of a `Sequence` would read as
its boundaries, two symbols in a row. A `Set` here is a thunk, and a thunk is
never a sequence element by mistake — `['set', …]` only ever arrives as
something's return value, so there is no bare boundary list for a `Sequence`
to swallow. That is what makes the injection unnecessary rather than skipped.

The empty set moves with it. `['set']` is constructible — it is `union()`'s
identity and what `remove(a, a)` returns, so refusing it at construction
would make the algebra partial and every fold need a special case. Whether an
empty *terminal* is legal in a grammar is the lowering's question, and the
lowering does not exist yet; when it does, it is the place to decide, since
it is the first code that can tell a terminal that matches nothing from one
that was never meant to match.

**A set holds ordinary symbols only; `eof` is not a set.** That is the rule
ebnf-front-end already states for `['range', a, b]` — both endpoints
ordinary, never spanning EOF — carried over unchanged. EOF stays the bare
`-1` rule that issue defines, with the no-leaf behaviour
[eof-as-ordinary-symbol](./eof-as-ordinary-symbol.md) records and
`fjs/bnf/matcher/module.f.mjs:86` implements. "Newline or end of input", the
terminator of a line comment, is spelled as the variant `{ nl, eof }` it is
today: a choice with a tag, not a set.

**So the AST row is `number` — one symbol leaf — unconditionally.** It is a
function of the form alone, which is the contract that issue's AST table
demands, and it holds for a widened `readonly number[]` spread into the tuple
as much as for a literal, because the lowering guarantees no set terminal can
match EOF.

#### Why EOF is not a set member

An earlier draft allowed it, with the row `readonly [number?]` for a set
containing EOF, and tried to carry membership at the type level. Review
showed that cannot be made sound without one of two things this tree
refuses: a phantom on `readonly number[]` is not structural, so
`RangeSet<false>` is assignable to `RangeSet<true>` unless every constructor
casts, and spreading the set into `['set', ...]` loses the parameter anyway;
or the flag becomes a runtime field, which is a different value type. Reading
membership off a literal is not sound either — `['set', -2, 0]` contains
`-1` although its first element is not `-1`, and boundary parity is not
computable over TypeScript numeric literals. The conservative alternative,
an optional leaf for every set whose membership cannot be proven, would
apply to every adapter result, which is nearly every set in a real grammar.

Forbidding EOF costs one spelling — the union of a set and `eof` as a single
terminal — and buys an unconditional row, no phantom, no cast, and the same
carrier the author writes. The variant spelling remains, with a tag, and
that is what every grammar in the tree uses today.

#### Two complements, two names

The generic `complement` is over the whole number line, which no grammar ever
means. The terminal domain is a set value, `[0]`, owned by `fjs/ebnf/terminal/`
([ebnf-migration](../../todo/ebnf-migration.md), the `ebnf/terminal/` piece),
and the lowering intersects every set with it: that clips a `-Infinity` a generic
complement produced back to `0`, drops EOF and anything below it, and so
restores canonicity before the IR. It also requires every boundary to be a
safe integer: `[0.5, 1.5]` and `[1, 2]` are the same set of symbols, and only
one of them may reach content-addressed data; the safety half is the next
paragraph's.

**There is no top end.** The last ordinary symbol, `2 ** 24 - 2`, is a fact
about the packed codec — two 24-bit halves in one number — and it leaves with
the codec. The domain `[0]` is open above: every non-negative integer is an
ordinary symbol, so no lowering rule clips, drops or rejects a boundary for
being large, and "every ordinary symbol" is `[0]` with nothing to
canonicalize. Which symbols an input can actually carry is its alphabet's
contract — code points end at `0x10FFFF`, token symbols occupy the range
`token_symbol/` assigns above them — and a set terminal matches whatever the
adapter delivers, exactly as a packed range does today: neither validates the
input against the domain, and neither should, because the adapter is the one
that knows the alphabet.

What does have a ceiling is `number` arithmetic. `b + 1`, `x + 1` and
`toRangeMap`'s `b - 1` are exact only for safe integers — `2 ** 53 + 1` is
`2 ** 53`, and `2 ** 54 - 1` is `2 ** 54` — so **every boundary of a terminal
set is a safe integer**, and the lowering rejects any other, hand-written
ones included: `[0, 2 ** 54]` never reaches the IR, where its inclusive
upper bound would have been itself. **Ordinary symbols are the non-negative
safe integers**, `0 .. 2 ** 53 - 1`, and the open tail is what spells the
top one: `[2 ** 53 - 1]` is its singleton, and `[a]` is `a` up to and
including it, the only spelling either has, because the boundary after the
top, `2 ** 53`, is not safe and is rejected. `range(a, b)` and `one(x)`
therefore return `[a, b + 1]` when `b + 1` is a safe integer and the open
tail `[a]` when `b` is `Number.MAX_SAFE_INTEGER`, and reject a larger `b`.
They reject a negative endpoint too, `range(-1, 1)` included: the helpers
build ordinary-symbol sets, so an endpoint below `0` is a mistake at the
call site, and it must fail there rather than reach the lowering, whose
intersection with the domain would clip `[-1, 2]` to the plausible but
different `[0, 2]` without a word. That intersection exists for values the
algebra produces — a generic complement starts at `-Infinity` — not for
helper input, which has an author to point at.
`toRangeMap` gives an open tail the upper bound `Infinity`, which is right:
nothing above the top is a safe integer, so nothing above it is a symbol an
adapter can deliver, and that is the adapter's contract stated above. So
`complement(fromRange([-Infinity, 2 ** 53 - 1]))` is `[2 ** 53 - 1]`, the
top symbol alone, and lowers as such.

The alphabet adapter's `not` is *difference against its universe*: Unicode's
is `unicodeRange = [0, 0x110000]`, exported by `fjs/ebnf/unicode/` as the
range-set value that name already denotes today, bytes' is `[0, 256]`, and a
token-symbol alphabet's is its
own. The generic toggle lives in `range_set`; the alphabet-scoped one in
`fjs/ebnf/unicode/` and its siblings ([unicode-rules](./unicode-rules.md)).
This answers ebnf-front-end's Problem 5 — the helpers take and return sets,
and `notOf` is unnecessary — and Problem 9 does not arise, though not by the
route proposed here: the shipped helpers return terminal rules and there is
no injection to make (**Amended** above). The classical front end never sees
a set value either way.
`fjs/ebnf/unicode/` is EBNF-only, and `bnf/` keeps its own helpers and its
`RangeVariant` until the migration's stage 7, so a raw `[0x30, 0x3A]` is
never handed to a front end whose `Sequence` would read it as two symbols.

#### Decide with the bounded repeat

The data `Rule` in `fjs/bnf/data/types.ts` is disjoint by JavaScript type
alone: a number is a terminal, an array a `Sequence`, an object a `Variant`, a
string a `Repeat`. A data `Sequence` is `readonly string[]` — rule *names*,
never rules — so a range set, an array of numbers, collides with it only at
the empty array, and the lowering rejects the empty set. (The *functional*
`Sequence` is `readonly Rule[]` and can hold numbers, but no set is a plain
array there: the EBNF front end spells it as the `['set', …]` thunk.) So in
the IR `typeof rule[0] === 'number'` discriminates — one probe, at one
element. But ebnf-front-end's Problem 1 already needs the IR to grow a
carrier for bounded repeats. If that carrier is a tagged form, the set goes
into it and the probe is never written. **Choose the IR carrier once, for
both**, and do not land the set as a special case first.

EOF still reaches the IR as a terminal — the bare `-1` rule lowers to the set
`[-1, 0]` — so the IR's terminal carrier holds either that one set or an
ordinary one, and a backend tells them apart by the first boundary. That is
the data layer's business; the front-end form never spells it.

Whatever the carrier, the packed `0xBBBBBB_EEEEEE` literal leaves the IR with
it, and with it the readability argument in `fjs/bnf/types.ts` for 24-bit
halves; `[0x30, 0x3A]` reads at least as well.

**Decided in [ebnf-data](../../ebnf/data/README.md):** every data
rule is a tagged tuple, the set goes into it as `['set', …]`, and the probe
is never written. EOF is the one set with a negative boundary, `[-1, 0]`, as
above.

#### What it is not

Not a performance change. Real sets are tiny — three ranges in the JSON string
rule — and the classical variant's per-branch dispatch was never measured. The
justification is the API and the AST, which is where
[DESIGN.md](../../../doc/DESIGN.md) says quality lives; do not sell it as speed.

### Tasks

- [x] `fjs/types/range_set`: replace the `RangeMap<boolean>` representation
      with the toggle list over `-Infinity..Infinity`, any non-`NaN` number
      a boundary; `contains`, `union`, `intersection`, `complement`,
      `difference`, the half-open `fromRange`, validation on construction;
      proofs for each, for `[]`, `[-Infinity]`, `[-1, 0]`, `[0.5, 1.5]`, an
      open tail, and every rejected input (`NaN`, `Infinity`, `-0`, a
      repeat, a decrease). Port `fjs/media/nix/module.f.mjs` to `[a, b + 1]`.
- [ ] `fjs/ebnf/terminal/`: the integer helpers — `range(a, b)` and
      `one(x)` as `[a, b + 1]` and `[x, x + 1]` over non-negative safe
      integers with `a <= b`, the open tail when the end is
      `Number.MAX_SAFE_INTEGER`, rejecting a negative endpoint, a reversed
      pair or a larger end; `eof` as `[-1, 0]`; the domain `[0]`;
      and `toRangeMap` (inclusive upper bound `b - 1`; an open tail is
      `Infinity`). No integer range-set module: these arithmetic facts are
      the whole difference.
- [x] Settle the IR carrier together with ebnf-front-end's Problem 1 —
      settled in [ebnf-data](../../ebnf/data/README.md), the
      `data/` issue, before any backend touches a set: a tagged tuple for
      every rule kind, `['set', …]` for the terminal.
- [ ] ebnf-front-end: replace the `['range', a, b]` row with `['set', …]` in
      the union, the AST table (`number`), the lowering requirements
      (validate the generic range-set invariants through `range_set`'s
      constructor first, then intersect with the domain `[0]`, then require
      safe-integer boundaries, and decide the empty set there), dropping
      `oneOf` from the constructor list (**Amended** above).
- [ ] Alphabet adapters: `not` in `fjs/ebnf/unicode/`, as difference against
      the Unicode universe. `range` and `set` are not adapter names — they
      ship in the front end and return terminal rules (**Amended** above, and
      [unicode-rules](./unicode-rules.md)) — so `not` follows them rather
      than producing a set value. `str` is not one of them either:
      `str('true')` is an ordered `Sequence` of one-symbol terminals, one per
      code point, exactly as a bare `string` lowers today. Same for `byte/`
      when it exists.
- [ ] `fjs/ebnf/ll1/`, the one backend the migration keeps: the dispatch map
      is built from `toRangeMap`, and the first/first conflict error names
      the rule, so it renders a set rather than a packed range.
- [ ] The ports ebnf-migration schedules — `ebnf/lib/json`, `ebnf/lib/datajs`,
      then the `djs` tokenizer and parser — spell their character classes as
      sets; the per-character variant nodes disappear from their ASTs, which
      the cross-front-end comparison proofs pin as an expected difference.
      `remove`, `not`, `notSet`, `RangeVariant` and `removeOne` stay in
      `bnf/` untouched and go with it at the migration's stage 7.
- [ ] The `djs` tokenizer port spells the note at
      `fjs/djs/tokenizer/module.f.mjs:249` as `difference(unicodeRange)(newLine)`,
      which is what it was reaching for.
- [ ] `tsc`, `fjs test`. Each breaking PR declares `**BREAKING CHANGES:**`
      in the `Changelog:` section of its description
      ([changelog/RELEASE.md](../../../changelog/RELEASE.md)) — the
      `range_set` representation and the AST shape both are. A PR adds no
      changelog file.

### Related

- [ebnf-front-end](./ebnf-front-end.md) — the front end this row belongs to;
  answers its Problem 5 and most of Problem 9, shares its Problem 1, and
  keeps its rule that a terminal range never spans EOF.
- [eof-as-ordinary-symbol](./eof-as-ordinary-symbol.md) — the no-leaf rule
  for EOF, which is why EOF is not a set member.
- [unicode-rules](./unicode-rules.md) — the adapters that own the
  alphabet-scoped `not`.
- [terminal-range-representation](./terminal-range-representation.md) — the
  bigint domain; the toggle list is the representation it was looking for.
- [ebnf-migration](../../todo/ebnf-migration.md) — the module this lands in.
  `ebnf/terminal/` owns the domain set `[0]`, `eof` and the integer helpers;
  `ebnf/unicode/` is rewritten in set values rather than `RangeVariant`, and
  `notOf` leaves its triage row.
- rule-visitor (retired; shipped as `matchRule` in
  [`fjs/ebnf/data`](../../ebnf/data/module.f.mjs)) — discriminates the data
  `Rule`, so it waited on the same IR carrier decision and landed with it.
- [ebnf-data](../../ebnf/data/README.md) — the carrier decision,
  and the lowering that validates a set as this issue requires.
- [`fjs/types/range_set/module.f.mjs`](../../types/range_set/module.f.mjs) —
  the module, now the toggle list.
- [`fjs/js/todo/174-shared-range-map-lexer.md`](../../js/todo/174-shared-range-map-lexer.md)
  — the two hand-rolled scanners also build range-set cells over `range_map`;
  the shared value type is a natural input for the factory it proposes.
