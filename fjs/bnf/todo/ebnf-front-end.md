## ebnf-front-end. A front end with a repetition primitive

**Priority:** P3
**Status:** blocked
**Blocked by:** *implementation only* — the design work below, and Problem 9
above all, is actionable now and grammar-bucket stage 2 waits on it.

- [grammar-bucket](../../todo/grammar-bucket.md) stages 1-5 — the dependency
  inversion. `data/` is not neutral until stage 5, because `toData`,
  `RuleNameMap` and `GrammarData` name the classical `FRule` until then.
- [unicode-rules](./unicode-rules.md), for the `fjs/grammar/unicode/` adapter
  this front end takes its text terminals from.

### Problem

The functional grammar has no repetition. `repeat0Plus(x)` spells a
right-recursive variant and the data layer recovers a `Repeat` by recognizing
that shape ([the `repeat` rule](../data/README.md#the-repeat-rule)).
Recognition is sound but it is the wrong place to pay for repetition:

- `map/rtti/module.f.mjs` calls `repeatItem` three times per rule, each call
  converting the sub-grammar and running the nullability fixpoint just to ask
  "is this a repeat?".
- It is deliberately narrow, so a rule that misses a side condition silently
  keeps the cons shape. The AST depends on whether recognition succeeded.
- The fold drops the intermediate rules, so transformers attached to them by
  identity fail the `'unreachable rule transformer'` assertion.
- It refuses an item that reaches its own repeat — a limit of recognition, not
  of repetition. `R = repeat(['(', R, ')'])` is a good grammar that a
  functional one cannot currently say.

The classical `Rule` union has no free slot for a primitive, so a sibling
front end gets the final union from day one instead.

### Proposal

`fjs/grammar/ebnf/` is a second front end over the same `RuleSet`: a `Rule`
union, its constructors, its lowering, and its rtti map. The backends, the
matcher and `emptyTagMap` are shared — they consume a `RuleSet` and never see
a functional rule. (Their *proofs* are
[Problem 2](#problems).)

#### The union follows RTTI

Plain values are rules directly; a thunk always returns a tagged tuple. Tagged
tuples never appear in `Rule`, so a plain array is always a sequence.

```ts
type Rule     = Const | Thunk
type Const    = number | string | Sequence | Variant
type Sequence = readonly Rule[]
type Variant  = { readonly [k in string]?: Rule }
type Thunk    = () => Info
type Info     =
    | readonly ['const', Const]              // a plain rule behind a thunk
    | readonly ['range', number, number]     // symbols a..b, inclusive
    | readonly ['repeat', number, Max, Rule] // min..max copies
type Max      = number | 'Infinity'
```

Three word tags, the RTTI vocabulary. Discrimination is by JavaScript type at
every level.

- **`number`** is one symbol: `0x61` is the letter, `-1` is EOF. How a
  terminal is *stored* is the data layer's business, so the packed
  `0x000030_000039` literal leaves grammars.
- **`string`** is the text it spells, one terminal per code point — the
  meaning `toData` gives a bare string today. `const a: Rule = 'Hello'`
  matches `Hello`. What you see is what you get, as with RTTI's `Const`. This
  holds over every alphabet; one whose symbols are not code points names them
  with a constructor, as `fjs/djs/parser` does with `sym()`.
- **`['const', c]`** is RTTI's escape under RTTI's name, for a plain rule
  behind a thunk. Every recursive rule pays it; RTTI pays the same.
- **`['repeat', …]`** carries its bounds, so the optional, star, plus and
  exact count are values of `min`/`max`, not separate forms:
  `['repeat', 0, 1, r]`, `['repeat', 0, 'Infinity', r]`,
  `['repeat', 1, 'Infinity', r]`, `['repeat', n, n, r]`.

`min` is a non-negative integer; `max` is one or `'Infinity'`; `min <= max`.
`'Infinity'` is a **string** because TypeScript has numeric literal types only
for finite literals, so numeric `Infinity` is typed `number` and a conditional
type could not detect it. `min > max` is an error. `0..0` and `1..1` are legal
and discouraged — `[]` and the rule itself say those directly, and
`['repeat', 1, 1, r]` wraps `r` in a one-element list a transformer on `r`
will not see. Exact counts of two or more are the ordinary case.

#### The AST is a function of the form

The contract the type-level mapping implements. Adding a form means adding a
row that is a function of the form alone.

| form | AST |
|---|---|
| `['const', c]` | `AST<c>` |
| `['range', a, b]` | `number` — one symbol leaf |
| `['repeat', min, max, r]` | `Repeat<min, max, AST<r>>`, below |
| `number` | `number` — the symbol itself |
| `string` | a tuple of `number`, one per code point |
| `Sequence` | one entry per element |
| `Variant` | the branch taken, tagged by its key |

```ts
type Repeat<Min, Max, T> =
    // A widened bound says nothing, and no branch may build a tuple longer
    // than the cap: `2 extends number` is true, and `Tuple<1000, T>` is
    // TS2589. The longest tuple a branch builds is `Max` when finite, `Min`
    // when unbounded, so guard on that — not on the span, and not on `Min`
    // alone.
      number extends Min or number extends Max              ? readonly T[]
    : (Max extends 'Infinity' ? Min : Max) > Cap            ? readonly T[]
    : Max extends 'Infinity'        ? (Min extends 0 ? readonly T[]
                                                     : readonly [...Tuple<Min, T>, ...readonly T[]])
    : [Min, Max] extends [Max, Min] ? Tuple<Min, T>   // both literal and equal
    : Union of Tuple<n, T> for Min <= n <= Max
```

Every repetition is a flat array whatever its bounds, `.length` discriminates,
and a consumer that folds one folds all. That is the substance of one form
rather than four. An optional is a 0-or-1 list rather than a tagged
`some`/`none` because the tagged form made it a *choice*, in a different
family from the rest; an author wanting named branches writes the plain
`Variant`.

Two caveats for the implementation. **The cap is on the longest tuple a branch would build**, which is the finite
`Max`, or `Min` when the max is unbounded — not the span and not `Min` alone,
either of which lets `repeat(Cap, Cap + 1)` through to a union that builds
`Tuple<Cap + 1, T>`. `Tuple` in `fjs/types/array/types.ts:22` recurses
linearly, so anything past the cap is TS2589 and degrades to `readonly T[]`. And TypeScript's template-literal recursion splits
by UTF-16 code unit, so a naive `AST<'😀'>` is a 2-tuple where the grammar
produces one element.

#### Constructors are the API

`Info` tuples are the representation a lowering reads, not what an author
writes — as `array(t)` is to RTTI's `['array', t]`. One constructor is
primitive:

```js
export const repeat = (min, max) => rule => () => ['repeat', min, max, rule]

export const option      = repeat(0, 1)
export const repeat0Plus = repeat(0, 'Infinity')
export const repeat1Plus = repeat(1, 'Infinity')
export const times       = n => repeat(n, n)
```

Currying the bounds makes the familiar names partial applications and leaves
their call sites at today's arity, so a ported grammar keeps its spelling.
`range` and `set` come from `fjs/grammar/unicode/`. `join0Plus` and
`join1Plus` compose.

Bare numbers and strings in `Const` mean a tagged tuple written *without* its
thunk is a legal rule with another meaning, and `tsc` accepts it. That is
accepted: the exposure is three words in a thunk's return position, the API
never asks anyone to write a tuple, RTTI has the same shape and an `Info` has
never escaped into a `Type` there, and a lost thunk fails loudly — the tag
becomes text the parser expects to consume, so the first proof over that
branch fails. **Making the representations disjoint with a marker is
rejected**: it costs the property the design rests on, that a rule is plain
data. A linter could catch it statically for external grammars; that is out
of scope here and not a reason to change the representation.

#### What a lowering must do

Stated as requirements, since the data layer is open.

- **Validate here, at the front end**, while the author still has a rule to
  point at: bounds in the domain above; `['range', a, b]` with `a <= b` and
  both **ordinary** symbols, never spanning EOF; a bare `number` an integer in
  the terminal domain.
- **A nullable body** at an unbounded max is non-termination and is rejected.
  At a bounded max it is not — see [Problem 3](#problems), which is open; the
  lowering must not reject it until that is settled.
- **The AST is fixed by the table above.** A lowering is correct only if its
  tree matches. That is what a second data layer must satisfy too.
- **Rule identity must survive.** Transformers are keyed by the functional
  rule, so a synthesized rule is one an author cannot name
  ([Problem 1](#problems)).

#### What the port changes

Against today's data layer a ported grammar can produce the same `RuleSet`,
which is what makes the port one grammar per PR — except where a constructor's
AST changes:

| constructor | changes? |
|---|---|
| `repeat0Plus`, `join1Plus` | no |
| `option` | yes — variant node becomes `[] \| [T]` |
| `repeat1Plus` | yes — `readonly [T, Repeat0Plus<T>]` becomes a flat non-empty list |
| `join0Plus`, `commaJoin0Plus` | yes, via `option` |

`commaJoin0Plus` matters most: `fjs/bnf/lib/json` uses it for both bracket
pairs, so the array and object productions change shape. A grammar adopting a
new form is not shape-preserving either.

Also: the rtti map tests the shape directly and `repeatItem` goes away;
`detectRepeat` stays in `data/` as opt-in normalization for hand-written and
deserialized sets.

#### Problems

Verified against the backends, the transformer layer and the proofs. None is
decided.

**1. Reduction synthesizes unnameable rules, and today's IR cannot express the
AST.** Transformers are keyed by rule identity and `ll1/module.f.mjs:397`
requires every child of a mapped variant to be mapped; a reduced `0..1` gets a
fresh `[]` nobody holds. Worse: on today's IR `1..Infinity` reduces to an item
beside a repetition, whose AST is a 2-tuple, not the flat list the table
specifies. So the table holds only for `0..Infinity`, and a lowering cannot be
judged correct against it. The question is which bounds a data layer carries
natively. Narrowing the front end to match today's IR is the option this
design rejects.

**2. The backend proofs are built with the front end.** `ll1/proof.f.mjs:14`,
`descent/proof.f.mjs:10`, `data/proof.f.mjs:7`, `matcher/proof.f.mjs:8`.
Rewriting them against `RuleSet` literals is grammar-bucket's pre-stage-5 work
and is also what first makes `descentEquivalence` front-end neutral.

**3. A nullable body is two problems.** Unbounded max is non-termination and
stays rejected. Bounded max is *ambiguity*, and only when the body can match
both empty and non-empty: `['repeat', 2, 2, r]` over a body matching `""` or
`"x"` parses `x` two ways, and `times(3)(option(x))` places one `x` in any of
its three slots. A body that can match **only** empty — `['repeat', 3, 3, []]`
— is unambiguous, since every copy matches the same nothing. Reject the
ambiguous case (nullable *and* able to consume), or keep a blanket rule and
document its cost — but "cardinality unrecoverable" is false at a bounded max,
where the cardinality is the bound.

**4. The optional's AST change is a bulk proof rewrite.** Production consumers
do not read the `some`/`none` tags, but `descent/proof.f.mjs:288-296` and
`ll1/proof.f.mjs` pin them throughout their expected-AST strings.

**5. The range-set helpers have an input side.** `remove(range(…), set(…))` in
the JSON grammar now takes EBNF forms, so the front-end helpers accept them as
well as produce them. The rule-level complement needs its own name (`notOf`),
never a second `not`.

**6. Reduction at the functional level defeats memoization** — a thunk created
during conversion has no `.name` and no shared identity.

**7. `AST<T>` needs explicit annotations on recursive rules.** TypeScript will
not infer a recursive thunk. Worth testing on a real grammar early: if the
annotations are onerous, the table is documentation rather than a checked
contract, which is a much weaker proposal.

**8. The tables never say how a node is represented.** Rows are written as
structural values while today's AST is `{ tag, sequence }` nodes
([`../README.md`](../README.md#ast)). `AST<Sequence>` and `AST<Variant>`
cannot be written until this is settled, and it decides what "the same AST"
means in the port claim.

**9. One alphabet adapter cannot return both representations.** `range('09')`
is a packed `TerminalRange` to the classical front end and a `'range'` thunk
here; `set('abc')` likewise. The front ends coexist for the whole port, so the
adapter needs a shared decoding core with per-front-end constructors, or
something equivalent. **This must be answered before `fjs/grammar/unicode/` is
built**, since it decides that module's public shape.

#### Left for later

A separated repeat (a flat item list, separators dropped) is worth having —
comma lists dominate the JSON and DJS grammars — and would remove a reduction.
The natural spelling is a fourth element on `'repeat'`, keeping `Info` at
three forms. It needs a data layer that can represent it.

### Tasks

- [ ] Answer the nine problems above, in the issue, before writing code. 8
      first — the tables cannot be finished without it, and 4 and 7 depend on
      it. Then 1, 3 and 6 gate the lowering; 2 is grammar-bucket's; 9 gates
      the alphabet adapter and so the whole port.
- [ ] `types.ts`: the union, `Max`, the `Repeat0Plus` / `Repeat1Plus` /
      `Join*` types, and `AST<Rule>` from the tables, with a proof per row.
- [ ] `module.f.mjs`: the `repeat(min, max)` constructor with `option` /
      `repeat0Plus` / `repeat1Plus` / `times` as partial applications, plus
      `join0Plus`, `join1Plus`, `commaJoin0Plus` and `notOf`; and the lowering
      per "What a lowering must do". `commaJoin0Plus` is needed by the first
      grammar ported, so it is not optional.
- [ ] Split the range-set helpers by layer: packed arithmetic in `terminal/`,
      the rule-level complement a distinctly named front-end helper built on
      it, never a re-export.
- [ ] `rtti/`: the rule-info map, without `repeatItem`.
- [ ] Proofs: every constructor; every `Info` form written directly; each
      bound shape and the degenerate `0..0` and `1..1`; a one-code-point
      string (a sequence of one) and an astral character (one element); every
      lowering error; and the `descentEquivalence` cases re-expressed here,
      comparing **backend results** and stating per case whether the AST is
      expected to match the `bnf` original or to differ.
- [ ] Add a proof over **this repository's grammars** that none contains a
      `Const` array headed by `'const'`, `'range'` or `'repeat'` — the
      forgotten-thunk case. It is a corpus check, not a type assertion: such
      an array *is* a valid `Const` by design, so the property is that no
      grammar here writes one by accident.
- [ ] Port `fjs/grammar/lib/json` (`\uXXXX` becomes `times(4)(hex)`), then
      `lib/datajs`, then the `djs` tokenizer and parser, one PR each. Those
      are the only consumers: outside `fjs/bnf` the repository imports it from
      five files, all under `fjs/djs`.
- [ ] Update `data/README.md` and `descent/README.md`, which describe `Repeat`
      as "the one rule kind `toData` derives".
- [ ] `tsc`, `fjs t`. Each breaking PR declares `**BREAKING CHANGES:**` in its
      `Changelog:` section
      ([changelog/RELEASE.md](../../../changelog/RELEASE.md)).

### Related

- [grammar-bucket](../../todo/grammar-bucket.md) — the layout this lands in
  and the inversion it needs.
- [`fjs/rtti/types.ts`](../../rtti/types.ts) — the eDSL shape this copies.
- [the `repeat` rule](../data/README.md#the-repeat-rule) — the recognition
  this makes unnecessary.
- [unicode-rules](./unicode-rules.md) — owns the text lowering and the
  adapter Problem 9 constrains.
- [terminal-range-shared-type](./terminal-range-shared-type.md) — the packed
  `TerminalRange` becomes data-layer only here.
- [rule-visitor](./rule-visitor.md) — unaffected; the data union does not
  change.
- [207-bnf-semantic-actions](./207-bnf-semantic-actions.md) — rule maps keyed
  by identity; Problem 1 is its sharpest edge.
