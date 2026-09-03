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
| `[-1]` | everything in the terminal domain, EOF included |
| `[0]` | every ordinary symbol; today's `fullRange` |
| `[-1, 0]` | EOF only; today's `eof` |
| `[0x30, 0x3A]` | `0..9`; today's `range('09')` |
| `[0, 0x110000]` | Unicode; today's `unicodeRange` |

**No operation takes a universe.** The generic module is over the whole number
line, so `complement` is the toggle at `-Infinity`, and union, intersection,
difference and `contains` never needed one. A *domain* is just a set value the
consumer intersects with — see [Two complements](#two-complements-two-names).

**Boundaries are half-open**: a boundary starts the next run, so a closed
range `a..b` is `[a, b + 1]`, and every packed literal in the tree today reads
inclusive. State this once, in the module doc, and nowhere else.

Properties, each one a reason to prefer this over a list of ranges:

- **Canonical by construction.** One spelling per set, so structural equality
  is set equality and content addressing works without a normalization pass.
  Validation is the whole guarantee: strictly increasing safe integers, save
  for a leading `-Infinity`. `[5, 5]` is rejected, not normalized, and so are
  `[0.5]` and a trailing `Infinity` — symbols are integers, so each of those
  is a second spelling of a set that already has one.
- **Complement is one toggle.** Adding or removing a leading `-Infinity`.
  Union, intersection and difference are one parity merge over two sorted
  lists. Membership is a binary search plus the parity of the position.
- **Open above for free.** An odd-length set runs to `Infinity`, so
  `fullRange`, `unicodeMax` and the 24-bit codec leave grammars, and no module
  needs to know the domain maximum: an open tail converts to a `range_map`
  entry whose upper bound is `Infinity`, which `get` already handles.
- **EOF membership is the first element.** Within the terminal domain a set
  contains EOF iff its first boundary is `-1`. That is decidable at the type
  level, which the AST row below relies on.
- **The cost.** `-Infinity` is not JSON and has no bigint. It never reaches
  the IR — lowering intersects with the domain, below — but a bigint range
  set later cannot toggle at a bottom it cannot spell, so it takes its own
  bottom or ships without a generic complement. That is that module's
  problem, not this one's.

`fjs/types/range_set` **is** this type — the `RangeMap<boolean>` that used to
be there is gone, along with its one consumer's use of it
(`fjs/media/nix/module.f.mjs`), and there are not two. The module exports the
algebra (`contains`, `union`, `intersection`, `complement`, `difference`), the
constructors (`rangeSet`, `fromRange`, `empty`, `full`) with `isRangeSet` for
the validation they panic on, and `toRangeMap`, which is what the LL(1)
dispatch map is built from.

**The empty set is a value, not a rule.** As a value it is the identity for
union and belongs in the algebra. As a terminal it is a rule that can never
match — a grammar error, like a nullable body under an unbounded repeat — and
the lowering rejects it. That guarantee is also what the IR discriminant below
leans on.

#### The terminal form

In [ebnf-front-end](./ebnf-front-end.md) the `Info` row `['range', a, b]` is
**replaced**, not joined, by

```ts
type Info =
    | readonly ['const', Const]
    | readonly ['set', ...RangeSet]                 // symbols in the set
    | readonly ['repeat', number, number, Rule]
```

`() => ['set']` is the empty set; `() => ['set', -1]` accepts anything, EOF
included. A bare `number` stays as sugar: `0x61` means `['set', 0x61, 0x62]`
and has the same AST row. `string` is unchanged.

**The AST row is `number` — one symbol leaf — with one exception the tree has
already decided.** [eof-as-ordinary-symbol](./eof-as-ordinary-symbol.md)
records that a consumed EOF contributes no leaf, and
`fjs/bnf/matcher/module.f.mjs:86` implements it for every terminal. So a set
whose first boundary is `-1` has the row `readonly [number?]`, and every other
set has `number`. Both are written from the form alone, which is the contract
that issue's AST table demands. Sets containing EOF are worth having —
"newline or end of input" is the natural terminator of a line comment — so
this allows them rather than forbidding them.

#### Two complements, two names

The generic `complement` is over the whole number line, which no grammar ever
means. The terminal domain is a set value, `[-1]`, owned by the neutral
terminal module ([grammar-bucket](../../todo/grammar-bucket.md) stage 1), and
the lowering intersects every set with it: that clips a `-Infinity` a generic
complement produced back to `-1`, drops anything below EOF, and so restores
canonicity before the IR. Boundaries above the last ordinary symbol are
rejected there rather than clipped, so the IR never spells the maximum and
"everything" stays `[-1]`.

The alphabet adapter's `not` is *difference against its universe*: Unicode's
is `[0, 0x110000]`, bytes' is `[0, 256]`, and a token-symbol alphabet's is its
own. The generic toggle lives in `range_set`; the alphabet-scoped one in
`fjs/grammar/unicode/` and its siblings ([unicode-rules](./unicode-rules.md)).
This answers ebnf-front-end's Problem 5
— the helpers take and return sets, and `notOf` is unnecessary — and most of
its Problem 9: the adapter returns set *values*, and each front end has one
injection from a set to a rule.

#### Decide with the bounded repeat

The data `Rule` is disjoint by JavaScript type alone: a number is a terminal,
an array a `Sequence`, an object a `Variant`, a string a `Repeat`. A range set
is an array of numbers, and a sequence an array of strings, so they collide at
the empty array. With the empty set rejected as a terminal the collision is
gone and `typeof rule[0] === 'number'` discriminates — one probe, at one
element. But ebnf-front-end's Problem 1 already needs the IR to grow a carrier
for bounded repeats. If that carrier is a tagged form, the set goes into it and
the probe is never written. **Choose the IR carrier once, for both**, and do not
land the set as a special case first.

Whatever the carrier, the packed `0xBBBBBB_EEEEEE` literal leaves the IR with
it, and with it the readability argument in `fjs/bnf/types.ts` for 24-bit
halves; `[0x30, 0x3A]` reads at least as well.

#### What it is not

Not a performance change. Real sets are tiny — three ranges in the JSON string
rule — and the descent backend's per-branch attempts were never measured. The
justification is the API and the AST, which is where
[DESIGN.md](../../../doc/DESIGN.md) says quality lives; do not sell it as speed.

### Tasks

- [x] `fjs/types/range_set`: replace the `RangeMap<boolean>` representation
      with the toggle list over `-Infinity..Infinity`; `contains`, `union`,
      `intersection`, `complement`, `difference`, `fromRange`, `toRangeMap`,
      validation on construction; proofs for each, for `[]`, `[-Infinity]`,
      `[-1, 0]`, an open tail, and every rejected input. Port
      `fjs/media/nix/module.f.mjs`.
- [ ] Settle the IR carrier together with ebnf-front-end's Problem 1, in that
      issue, before any backend touches a set.
- [ ] ebnf-front-end: replace the `['range', a, b]` row with `['set', …]` in
      the union, the AST table (`number`, or `readonly [number?]` when the
      first boundary is `-1`), the lowering requirements (intersect with the
      domain `[-1]`; reject a boundary above the last ordinary symbol; reject
      the empty set), and the constructor list.
- [ ] Alphabet adapters: `range`, `set` and `not` in `fjs/grammar/unicode/`
      produce sets; `not` is difference against the Unicode universe. `str`
      is not one of them: `str('true')` is an ordered `Sequence` of
      one-symbol terminals, one per code point, exactly as a bare `string`
      lowers today. Same for `byte/` when it exists.
- [ ] Backends: LL(1) builds its dispatch map from `toRangeMap`; descent tests
      membership with `contains`; the failure record at
      `fjs/bnf/descent/module.f.mjs:60` holds a set, so "expected" diagnostics
      render one.
- [ ] Port `fjs/bnf/lib/json`, `lib/datajs` and the `djs` tokenizer; the
      per-character variant nodes disappear from their ASTs, which is a
      breaking AST change for any consumer that reads rather than flattens
      them. Delete `remove`, `not`, `notSet`, `RangeVariant` and `removeOne`
      from the classical front end only if it is still alive; otherwise they
      go with it in grammar-bucket stage 8.
- [ ] Rewrite the note at `fjs/djs/tokenizer/module.f.mjs:249` as
      `difference(unicode)(newLine)`, which is what it was reaching for.
- [ ] `tsc`, `fjs test`. Each breaking PR declares `**BREAKING CHANGES:**`
      in the `Changelog:` section of its description
      ([changelog/RELEASE.md](../../../changelog/RELEASE.md)) — the
      `range_set` representation and the AST shape both are. A PR adds no
      changelog file.

### Related

- [ebnf-front-end](./ebnf-front-end.md) — the front end this row belongs to;
  answers its Problem 5 and most of Problem 9, shares its Problem 1.
- [eof-as-ordinary-symbol](./eof-as-ordinary-symbol.md) — the no-leaf rule
  for EOF that the AST row inherits.
- [unicode-rules](./unicode-rules.md) — the adapters that own the
  alphabet-scoped `not`.
- [terminal-range-representation](./terminal-range-representation.md) — the
  bigint domain; the toggle list is the representation it was looking for.
- [grammar-bucket](../../todo/grammar-bucket.md) — `terminal/` owns the
  domain set `[-1]` the lowering intersects with; `RangeVariant` no longer
  moves there.
- [rule-visitor](./rule-visitor.md) — discriminates the data `Rule`, so it
  waits on the same IR carrier decision.
- [`fjs/types/range_set/module.f.mjs`](../../types/range_set/module.f.mjs) —
  the module, now the toggle list.
- [`fjs/js/todo/174-shared-range-map-lexer.md`](../../js/todo/174-shared-range-map-lexer.md)
  — the two hand-rolled scanners also build range-set cells over `range_map`;
  the shared value type is a natural input for the factory it proposes.
