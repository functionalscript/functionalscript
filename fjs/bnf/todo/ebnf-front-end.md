## ebnf-front-end. A front end with a repetition primitive

**Priority:** P3
**Status:** blocked
**Blocked by:** *implementation only* — the design work below is actionable
now.

- [ebnf-migration](../../todo/ebnf-migration.md) stage 0 — the `fjs/ebnf/`
  module and its boundary check. This front end is that plan's stage 1, and
  its Problems 2 and 9 below dissolve there: nothing is shared with the
  classical front end, and `fjs/ebnf/data/` is that plan's stage 2 rather
  than a neutralized `bnf/data`.
- [unicode-rules](./unicode-rules.md), for the `fjs/ebnf/unicode/` adapter
  the ported grammars take their text terminals from — stage 4 there, so it
  gates the port, not the front end, whose own proofs spell terminals as
  numbers and strings.

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

`fjs/ebnf/` is a new module with a second front end — a `Rule` union, its
constructors, its lowering, and its rtti map — over its own `RuleSet`,
backends and matcher, which the classical front end may import but which
never import it ([ebnf-migration](../../todo/ebnf-migration.md)). They
consume a `RuleSet` and never see a functional rule.

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
    | readonly ['repeat', number, number, Rule] // min..max copies
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
  `['repeat', 0, 1, r]`, `['repeat', 0, Infinity, r]`,
  `['repeat', 1, Infinity, r]`, `['repeat', n, n, r]`.

`min` is a non-negative integer; `max` is a non-negative integer or
`Infinity`; and `min <= max`.

**Both bounds are plain `number`, and `Infinity` is the unbounded value** —
no sentinel. TypeScript has no literal type for `Infinity`, so an unbounded
`max` arrives widened; that is the whole mechanism rather than a problem,
because a widened `max` and an unbounded one deserve the same answer, and
`fjs/types/array`'s `BoundedArray<Min, Max, T>` gives it (below). The
comparisons also just work — `min <= Infinity` is true — where a `null`
sentinel coerces to `0` and needs a guard at every site, and
a `-1` sentinel would compile and be silently wrong — `-1` is EOF in the
terminal domain besides. `undefined` is rejected for a different reason: a
dropped argument would read as *plausible*, so `repeat(2)` would silently
mean two-or-more while reading as "exactly two", which already has a
spelling in `times(2)`. `min > max` is an error. `0..0` and `1..1` are legal
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
| `['repeat', min, max, r]` | `BoundedArray<min, max, AST<r>>`, below |
| `number` | `number` — the symbol itself |
| `string` | `readonly number[]` — see below |
| `Sequence` | one entry per element |
| `Variant` | the branch taken, tagged by its key |

**This type is not ebnf's to write.** It is `BoundedArray<Min, Max, T>` in
[`fjs/types/array/types.ts`](../../types/array/types.ts), shipped by
[#1865](https://github.com/functionalscript/functionalscript/pull/1865):
`FixedArray<Min, T>` followed by an optional-element tail up to `Max`, with
`number extends Max ? readonly T[]` as the tail. A required prefix and an
optional remainder — one tuple, not a union of them:

| bounds | AST |
|---|---|
| `0, 1` | `readonly [T?]` |
| `1, 3` | `readonly [T, T?, T?]` |
| `4, 4` | `readonly [T, T, T, T]` |
| `1, Infinity` | `readonly [T, ...readonly T[]]` |
| `0, Infinity` | `readonly T[]` |
| `2, n` (widened) | `readonly [T, T, ...readonly T[]]` |

The last row is the point of using plain `number`: an unbounded `max` and one
TypeScript merely cannot see are the same case, and both are answered
soundly, because the *minimum* is carried by `Min` alone. There is nothing to
detect, so nothing to spell.

Every repetition is a flat array whatever its bounds, `.length` discriminates,
and a consumer that folds one folds all. That is the substance of one form
rather than four. An optional is `readonly [T?]` rather than a tagged
`some`/`none` because the tagged form made it a *choice*, in a different
family from the rest; an author wanting named branches writes the plain
`Variant`.

The tail recurses linearly in `Max`, so a large finite `Max` is TS2589 —
measured at `1000`, clean at `900`. `BoundedArray` sets no cap, and ebnf does
not ask for one: `times(4)(hex)` is the largest bounded span in the tree, so
the ceiling is two orders of magnitude away. If a graceful fallback is ever
wanted it belongs to `fjs/types/array` with the type, not here.

**A string's AST is `readonly number[]`, not a tuple.** The lowering emits one
terminal per code point, but TypeScript's template-literal recursion splits by
UTF-16 code unit, so a length-accurate `AST<'😀'>` would need a
surrogate-aware type algorithm. This design declines to write one: the array
is sound over every string — each element is a symbol — and loses only
arity. A grammar that wants the
arity in its type spells the symbols as a `Sequence` of numbers.

#### Constructors are the API

`Info` tuples are the representation a lowering reads, not what an author
writes — as `array(t)` is to RTTI's `['array', t]`. One constructor is
primitive:

```js
export const repeat = (min, max) => rule => () => ['repeat', min, max, rule]

export const option      = repeat(0, 1)
export const repeat0Plus = repeat(0, Infinity)
export const repeat1Plus = repeat(1, Infinity)
export const times       = n => repeat(n, n)
```

Currying the bounds makes the familiar names partial applications and leaves
their call sites at today's arity, so a ported grammar keeps its spelling.
`range` and `set` come from `fjs/ebnf/unicode/`. `join0Plus` and
`join1Plus` compose.

Bare numbers and strings in `Const` mean a tagged tuple written *without* its
thunk is a legal rule with another meaning, and `tsc` accepts it. That is
accepted: the exposure is three words in a thunk's return position, the API
never asks anyone to write a tuple, RTTI has the same shape and an `Info` has
never escaped into a `Type` there, and a lost thunk fails loudly — the tag
becomes text the parser expects to consume, so the first proof over that
branch fails. **Making the representations disjoint with a marker is
rejected**: it costs the property the design rests on, that a rule is plain
data. No static check separates the two, and the corpus check an earlier
draft proposed here does not either: `fjs/bnf/lib/datajs` builds
`statement('const', …)`, a legitimate sequence headed by the literal
`'const'`, so a rule "no `Const` array starts with a tag" would reject correct
grammars. The protection is behavioural, not static, and it is the same one:
the grammar stops matching its own inputs. A linter with more context could do
better for external grammars; that is out of scope here and not a reason to
change the representation.

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
fresh `[]` nobody holds. Worse: on today's IR an unbounded `1..` reduces to an item
beside a repetition, whose AST is a 2-tuple, not the flat list the table
specifies. So the table holds only for the unbounded `0..`, and a lowering cannot be
judged correct against it. The question is which bounds a data layer carries
natively. Narrowing the front end to match today's IR is the option this
design rejects.

**2. Dissolved by ebnf-migration.** It was: the backend proofs are built
with the classical front end (`ll1/proof.f.mjs:14`, `descent/proof.f.mjs:10`,
`data/proof.f.mjs:7`, `matcher/proof.f.mjs:8`), so deleting that front end
would take the proofs down. Under that plan `fjs/ebnf/`'s backends and their
proofs are its own, and the classical proofs stay in `bnf/` until it is
deleted whole.

**3. A nullable body is two problems.** Unbounded max is non-termination and
stays rejected. Bounded max is *ambiguity*: `['repeat', 2, 2, r]` over a body
matching `""` or `"x"` parses `x` two ways. One case is safe — **a fixed count
over the literal `[]`**, `['repeat', 3, 3, []]`, where every copy matches the
same nothing exactly one way. Neither half can be relaxed:
`['repeat', 0, 1, []]` reads empty input as zero copies or one, and an
empty-only body that is not `[]` can still derive empty more than one way —
`{ a: [], b: [] }` gives `['repeat', 2, 2, …]` four derivations with distinct
tagged ASTs. Reject anything outside that exemption, or keep the blanket rule
and document its cost — but "cardinality unrecoverable" is false at a bounded max,
where the cardinality is the bound.

This is a *nullability* check, not an ambiguity check. A non-nullable body can
be ambiguous too — `repeat(1, 2)({ short: 'a', long: 'aa' })` reads `aa` as one
`long` or two `short` — and deciding that in general is not the front end's
job.

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

**9. Dissolved by ebnf-migration.** It was: one alphabet adapter cannot
return both representations — `range('09')` is a packed `TerminalRange` to
the classical front end and a `'range'` thunk here — and the front ends
coexist for the whole port. Under that plan `fjs/ebnf/unicode/` serves this
front end only and returns its representation; the classical front end keeps
its own helpers until it is deleted.

#### Left for later

A separated repeat (a flat item list, separators dropped) is worth having —
comma lists dominate the JSON and DJS grammars — and would remove a reduction.
The natural spelling is a fourth element on `'repeat'`, keeping `Info` at
three forms. It needs a data layer that can represent it.

### Tasks

- [ ] Answer the open problems above — 1, 3, 4, 5, 6, 7 and 8; 2 and 9 are
      dissolved — as the code that depends on each is written, in the issue
      or in `fjs/ebnf/README.md`, and revise an answer when the code shows
      it wrong. What depends on what: 8 decides the AST tables, and 4 and 7
      follow it; 1, 3 and 6 shape the lowering. That is a dependency map for
      whoever picks an order, not an order.
- [ ] `types.ts`: the union, the `Join*` types, and `AST<Rule>` from the
      tables, with a proof per row. `BoundedArray` is instantiated from
      `fjs/types/array`, not redefined.
- [ ] `module.f.mjs`: the `repeat(min, max)` constructor with `option` /
      `repeat0Plus` / `repeat1Plus` / `times` as partial applications, plus
      `join0Plus`, `join1Plus`, `commaJoin0Plus` and `notOf`; and the lowering
      per "What a lowering must do". `commaJoin0Plus` is needed by the first
      grammar ported, so it is not optional.
- [ ] Split the range-set helpers by layer: packed arithmetic in `terminal/`,
      the rule-level complement a distinctly named front-end helper built on
      it, never a re-export.
- [ ] `rtti/`: the rule-info map, without `repeatItem`, with its own
      co-located `proof.f.mjs` covering every export and branch — a new
      `.f.mjs` owes that ([fjs/AGENTS.md](../../AGENTS.md)), and the classical
      `map/rtti/` already ships one.
- [ ] Proofs: every constructor; every `Info` form written directly; each
      bound shape, `Infinity` among them, and the degenerate `0..0` and
      `1..1`; string lowering,
      where a one-code-point string and an astral character each emit exactly
      one terminal — a lowering proof, since the AST *type* of a string is
      `readonly number[]`; every lowering error; and the `descentEquivalence`
      cases re-expressed here, comparing **backend results** and stating per
      case whether the AST is expected to match the `bnf` original or to
      differ.
- [ ] Port `lib/json` and `lib/datajs` to `fjs/ebnf/lib/` **in one PR** — datajs
      imports eight rule values from json (`lib/datajs/module.f.mjs:17`), so a
      json-only PR hands classical combinators ebnf thunks. `\uXXXX` becomes
      `times(4)(hex)`. Then the `djs` tokenizer and parser, one PR each. Those
      are the only consumers: outside `fjs/bnf` the repository imports it from
      five files, all under `fjs/djs`.
- [ ] Update what describes the derived `Repeat`: `data/types.ts:29` carries
      the phrase "the one rule kind `toData` derives"; `data/README.md` and
      `descent/README.md` describe the same thing in their own words.
- [ ] `tsc`, `fjs t`. Each breaking PR declares `**BREAKING CHANGES:**` in its
      `Changelog:` section
      ([changelog/RELEASE.md](../../../changelog/RELEASE.md)).

### Related

- [ebnf-migration](../../todo/ebnf-migration.md) — the module this lands in,
  as its stage 1, and the dependency rule it lives under.
- [`fjs/rtti/types.ts`](../../rtti/types.ts) — the eDSL shape this copies.
- [the `repeat` rule](../data/README.md#the-repeat-rule) — the recognition
  this makes unnecessary.
- [unicode-rules](./unicode-rules.md) — owns the text lowering and the
  adapter Problem 9 constrains.
- [terminal-range-shared-type](./terminal-range-shared-type.md) — the packed
  `TerminalRange` becomes data-layer only here.
- [rule-visitor](./rule-visitor.md) — **depends on Problem 1's answer.** The
  visitor discriminates the data `Rule`, and if the data layer grows a
  bounded repeat that union changes, so implementing the visitor against
  today's string-only `Repeat` would need a second rewrite. It is blocked on
  the IR decision, not merely on the alphabet split.
- [207-bnf-semantic-actions](./207-bnf-semantic-actions.md) — rule maps keyed
  by identity; Problem 1 is its sharpest edge.
