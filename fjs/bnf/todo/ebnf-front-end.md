## ebnf-front-end. A front end with a repetition primitive

**Priority:** P3
**Status:** blocked
**Blocked by:**
- [grammar-bucket](../../todo/grammar-bucket.md) stages 1-**5** — the
  dependency inversion: the neutral modules must stop importing the classical
  front end, in type as well as at runtime, before a second front end can
  share them. Stage 5 is included because `data/` is not neutral until it
  runs: `toData`, `RuleNameMap` and `GrammarData` name the classical `FRule`
  and only leave `data/` when the front end moves, so an `ebnf` that imported
  the shared data utilities before that would take on exactly the dependency
  this blocker exists to remove. Stage 6's moves of the already-neutral
  modules are not a prerequisite.
- [unicode-rules](./unicode-rules.md), for the `fjs/grammar/unicode/` adapter
  this front end takes every text terminal from.

### Problem

The functional grammar has no repetition. `repeat0Plus(x)` spells a
right-recursive variant, `() => ({ some: [x, r], none: [] })`, and the data
layer gets its `Repeat` rule back by recognizing that shape
([the `repeat` rule](../data/README.md#the-repeat-rule)). The recognition is
sound but it is the wrong place to pay for repetition:

- `map/rtti/module.f.mjs` asks `repeatItem` from three places per rule
  (`children`, `tagOf`, `inputOf`), and each call converts the whole
  sub-grammar with `toDataAdd` and runs the nullability fixpoint, just to
  answer "is this a repeat?".
- Recognition is deliberately narrow, so a rule that misses a side condition
  silently keeps the cons-shaped variant. The AST a grammar gets then depends
  on whether recognition succeeded, and a hand-written `{ some, none }` that
  the author meant as a choice is flattened for the same reason.
- The fold drops the intermediate `some` sequence and the `none` rule.
  Transformers attached to them by rule identity fail the
  `'unreachable rule transformer'` assertion, and `toDataWithRules` filters
  its name map to hide the dropped rules.
- `Repeat0Plus<T>` encodes the recursive option shape at the type level, and
  `RepeatMap` in `map/types.ts` carries the caveat "if recognized as".
- The fold refuses an item that reaches its own repeat, because folding would
  be ambiguous. That is a limit of recognition, not of repetition:
  `R = repeat(['(', R, ')'])` is a fine grammar, and both backends already
  match a `RuleSet` that spells it — only a functional grammar can never say
  it.

The functional `Rule` union has no free slot for a primitive: `{}` is a
variant, `[]` a sequence, a number a terminal, a function a thunk, and a
string a Unicode literal. Growing the classical front end in place means
threading a new case through every dispatch site while
[unicode-rules](./unicode-rules.md) is still removing one. A sibling front end
gets the final union from day one.

### Proposal

`fjs/grammar/ebnf/` is a second front end over the same `RuleSet`. It is
**only** a `Rule` union, its constructors, its `toData`, and its rtti map. The
backends, the matcher and `emptyTagMap` are shared: they consume a `RuleSet`
and never see a functional rule. (The *proofs* are a different matter — see
[Problem 2](#problems-to-resolve-before-implementing).) Against today's data
layer a repetition reaches them as the existing `Repeat`; the front end does
not depend on that staying the only representation.

#### The rule union follows RTTI

The shape is the one every other eDSL here uses, `fjs/rtti` most visibly: as
many forms as possible are **plain values used directly**, and a thunk
**always returns a tagged tuple**. Tagged tuples never appear in the `Rule`
union itself, so a plain array is always a sequence and never has to be told
apart from an operator by inspecting its first element.

```ts
type Rule     = Const | Thunk
type Const    = number | string | Sequence | Variant
type Sequence = readonly Rule[]
type Variant  = { readonly [k in string]?: Rule }
type Thunk    = () => Info
type Info     =
    | readonly ['const', Const]                            // a plain rule behind a thunk
    | readonly ['range', number, number]                   // symbols a..b, inclusive
    | readonly ['repeat', number, Max, Rule]               // min..max copies
type Max      = number | 'Infinity'
```

Three forms, three word tags — the same vocabulary RTTI uses, with no glyphs
and no numeric tag. Discrimination is by JavaScript type at every level: a
function is a thunk and is called; what it returns is discriminated by its
first element; a plain `number` is a symbol, a string is text, an array a
sequence, an object a variant.

The thunk still names its rule — a lowering reads `fr.name` as today — so
nearly every named rule is a thunk, and the uniform wrapper is paid on every
one of them. That is deliberate: an earlier draft let a thunk return a bare
sequence and put a tagged array directly in `Rule`, which is shorter to write
and ambiguous the moment `string` is a rule (`['range', a, b]` is then either
the range or the literal text `range` followed by two symbols). The uniform return is what
lets the string question below stay open without deciding this one.

**Terminals.** A plain `number` in a rule is **one symbol**, not a packed
range: `0x61` is the letter, `-1` is EOF. A span of symbols is `'range'`,
inclusive at both ends.

How a terminal is *stored* is the data layer's business, not this front end's.
Today's `RuleSet` packs two endpoint codes into one number; a future data layer
may not. Either way the authored form is the same and the packed literal
`0x000030_000039` stops appearing in a grammar — that is the point of the split,
and it is what keeps this union from being tied to one encoding.

**The escape.** `['const', c]` is RTTI's escape under RTTI's name: a plain
rule behind a thunk, so a recursive sequence or variant is
`() => ['const', [digit, digits]]`. Every plain recursive rule pays it, and
nearly every named rule is a thunk, so it is paid a lot. That is the price of
the uniform return, and RTTI pays exactly the same one.

**Repetition is one form, not four.** `'repeat'` carries its bounds, so the
optional, the star, the plus and the exact count are **not** separate `Info`
forms and not sugar in the union — they are values of `min` and `max`:

| meaning | form |
|---|---|
| `?` optional | `['repeat', 0, 1, r]` |
| `*` zero or more | `['repeat', 0, 'Infinity', r]` |
| `+` one or more | `['repeat', 1, 'Infinity', r]` |
| exactly *n* | `['repeat', n, n, r]` |
| *n* to *m* | `['repeat', n, m, r]` |

An earlier draft had `'*'`, `'?'`, `'+'` and a bare `[n, r]` count as four
`Info` forms with `'repeat'` proposed beside them. Keeping both would have been
two spellings for one concept, four extra rows that must agree, and — because
the count's tag was a number — a `string | number` tag slot that broke RTTI
parity. Dropping the sugar removes all of it. The glyphs survive where they
belong, as **constructors**, which is where an author meets them anyway.

**Bounds.** `min` is a non-negative integer; `max` is a non-negative integer
or `'Infinity'`; and `min <= max`, with `'Infinity'` above every integer. A
negative or fractional bound is an error rather than a rounding — half a copy
is not a cardinality.

`'Infinity'` is a **string**, not the JS `Infinity`, and the reason is
type-level rather than cosmetic. TypeScript has numeric literal types only for
finite literals, so `Infinity` is typed plain `number` with no literal type to
match against; a conditional type could not ask whether a max is unbounded, and
the tuple refinement the AST row depends on would be foreclosed. `'Infinity'`
is a string literal type, so `Max extends 'Infinity'` is a question the checker
can answer. It costs the arithmetic — `n <= max` needs `max` narrowed first —
which is a feature, since JS would otherwise coerce the string to a number and
compare correctly by accident.

Serialization does not enter into it: an `Info` tuple is JavaScript inside a
grammar module and is never serialized. Only what a lowering *produces* is, and
how that layer spells its own unbounded bound is its choice, independent of
this one.

**Degenerate bounds** divide into one error and two discouragements, split by
whether a *computed* bound could ever legitimately produce them:

- `min > max` is an **error**. It admits no cardinality at all, so the rule
  matches nothing and the grammar is dead there. No provenance makes it
  meaningful, so it is rejected like an inverted `'range'` is.
- `min = max = 0` is legal and **discouraged**: it always matches empty, which
  the empty sequence `[]` says directly and more plainly.
- `min = max = 1` is legal and **discouraged**: an author almost always means
  the rule itself, or `['const', r]` where a thunk is needed for recursion.
  These are not equal, which is why the guidance is worth writing down rather
  than automating away: `['repeat', 1, 1, r]` has AST `readonly [AST<r>]`, a
  one-element list, where `r` on its own has AST `AST<r>`. Writing the repeat
  gets a pointless wrapper node, and a transformer attached to `r` does not
  see it.
- `min = max = n` for `n >= 2` is the ordinary exact count and is **not**
  discouraged — it is what `times(4)` is for, and the `\uXXXX` rule wants
  it.

The errors are checked; the discouragements live in the docs and the
constructors, because a lowering cannot tell a hand-written `1` from one
computed at grammar-construction time and must stay total either way.

**The AST is a function of the form.** This is the contract the type-level
mapping implements, one row per `Info` form, each a function of the form alone
— and the rule for adding a form is that its row must be, too:

`Info` forms:

| form | AST |
|---|---|
| `['const', c]` | `AST<c>` |
| `['range', a, b]` | `number` — one symbol leaf |
| `['repeat', min, max, r]` | `Repeat<min, max, AST<r>>`, below |

`Const` forms, which the table above delegates to and which an author writes
far more often:

| form | AST |
|---|---|
| `number` | `number` — the symbol itself |
| `string` | **pending**, per the open question above |
| `Sequence` | one entry per element, `AST` of each |
| `Variant` | the branch taken, tagged by its key |

The last two rows are written loosely on purpose: they are the ones that
depend on how a node is *represented*, which this issue has not stated. See
[Problem 8](#problems-to-resolve-before-implementing).

One row now covers what four did. Every repetition is a flat array of
`AST<r>` whatever its bounds, `.length` is the discriminator in every case
including the optional, and a consumer that folds one folds all of them. That
is the substance of collapsing the sugar: not fewer characters, but one shape
where there were four.

**One form does not mean one type.** Collapsing to `readonly AST<r>[]` for
every unequal bound would throw away what the bounds state — an optional would
admit an array of any length, and a one-or-more would admit an empty one —
which is the type-level contract this design exists to keep. The row is a
conditional that reads the bounds it is given:

```ts
type Repeat<Min, Max, T> =
    // A widened bound says nothing, so it must be caught before any branch
    // that reads a literal — `2 extends number` is true, and would otherwise
    // pick a fixed-length tuple for `repeat(2, max)`.
      number extends Min                 ? readonly T[]
    : Max extends 'Infinity'             ? (Min extends 0 ? readonly T[]
                                                          : readonly [T, ...readonly T[]])
    : number extends Max                 ? readonly T[]
    // Both literal by now, so equality has to hold in both directions.
    : [Min, Max] extends [Max, Min]      ? Tuple<Min, T>
    : Union of Tuple<n, T> for Min <= n <= Max
```

so `option(r)` is `readonly [] | readonly [AST<r>]`, `repeat1Plus(r)` is a
non-empty tuple, `times(4)(r)` is a 4-tuple, and only a non-literal bound
degrades to `readonly AST<r>[]`. The two `number extends` guards are what make
that last clause true rather than aspirational: a one-directional
`Min extends Max` would match a literal `Min` against a widened `Max` and hand
back a fixed-length tuple for a repetition whose length is not known, which is
unsound rather than merely imprecise. A lower bound above one is expressible too —
`Min` copies followed by a rest element — and whether to spell that precisely
or stop at "non-empty" is a detail for the implementation.

The last line is the one to watch: a union of tuples is exact for a narrow
span like `0..1` or `2..3` and explodes for a wide one. Cap it, and fall back
to `readonly T[]` beyond the cap — a cap of a handful is enough for every
bounded span a real grammar writes. Confirm the cap when `Repeat` is written;
it is the only part of this row that trades precision for practicality.

It is also why an optional is a length-0-or-1 list rather than a tagged
`['some', …] | ['none', []]`. The tagged form made an optional a *choice*,
which put it in a different family from the rest and invented two tag names
the grammar never asked for. Nothing is lost — an author who wants named
branches writes the plain `Variant` `{ some: r, none: [] }`, which is an
ordinary `Const`.

**Constructors are the API. A grammar does not write `Info` tuples.** They are
the representation a lowering reads, not the interface an author writes
against — the same relationship RTTI has with its `Info`, where `array(t)` is
what you call and `['array', t]` is what it makes.

One constructor is primitive; the familiar EBNF names are partial
applications of it:

```js
export const repeat = (min, max) => rule => () => ['repeat', min, max, rule]

export const option      = repeat(0, 1)
export const repeat0Plus = repeat(0, 'Infinity')
export const repeat1Plus = repeat(1, 'Infinity')
export const times       = n => repeat(n, n)
```

Currying `(min, max)` first is what makes the derived names fall out as
partial applications rather than as four separate definitions, and it leaves
their call sites at exactly the arity they have today — `option(x)` and
`repeat0Plus(x)` are unchanged, so a ported grammar keeps its spelling even
though the representation underneath is new. `times(4)(hex)` is the one that
gains a level, being the only derived form that still takes a bound.

The terminal side is the same idea:

```js
range('09')   // () => ['range', 0x30, 0x39]
set('abc')    // { a: 0x61, b: 0x62, c: 0x63 }  — a plain Variant, no thunk
```

`join0Plus` and `join1Plus` compose on these. An author writes
`[minus, repeat0Plus(digit)]` and never types a tagged tuple, so the verbosity
of the uniform form is paid once, in the constructor definitions, rather than
in every grammar.

This is also what makes the forgotten-thunk exposure below narrow in practice
rather than only in principle: the mistake requires hand-writing a tuple the
API never asks anyone to write.

#### Decided: `Const` holds bare numbers and strings

A plain `number` and a plain `string` are rules. **A number is one input
symbol and becomes a number in the AST** — `0x61` is the letter, `-1` is EOF,
and nothing decodes or wraps it on the way through.

The cost is accepted rather than absent: a tagged tuple written *without* its
thunk is a legal rule with a different meaning — `['const', c]` as a bare
value is the string `const` followed by `c` — and `tsc` accepts both, so a
forgotten `() =>` is a silent wrong parse rather than a compile error.
Collapsing the sugar narrowed the exposure to three words: a grammar has to
use `'const'`, `'range'` or `'repeat'` as a literal text terminal, in a
thunk's return position, to be caught by it. Constructors keep hand-written
tagged tuples rare. The mitigation is a proof, not a type: a check that no
`Const` in a grammar is an array whose head is one of the three tags.

**Making the two representations disjoint is rejected.** The obvious way to
turn this into a compile error is to give operator tuples a marker a sequence
cannot have — a `Symbol` tag, a wrapper object, a class — so the type checker
separates them. We will not do that. It buys a narrow diagnostic and costs the
property the whole design rests on: that a rule is plain data, readable and
writable as an ordinary JavaScript value, with discrimination by JavaScript
type and nothing else.

The decisive argument is that **`fjs/rtti` has exactly this exposure and lives
with it**. Its `Const` admits `readonly Type[]`, its `Info` is tagged tuples
returned from thunks, and `['const', x]` written without its `() =>` is a
two-element tuple schema there just as it is a two-symbol sequence here. That
is the accepted trade of this eDSL family, not a new risk this front end
introduces. Paying a structural cost to close it in `ebnf` alone would make
`ebnf` the odd module out, which is the opposite of why its shape was copied
from RTTI in the first place.

The precedent is also empirical: we are happy with the RTTI shape, and an
`Info` has never escaped into a `Type` there. The same escape is what this
would be — an `Info` reaching a `Rule` position without its thunk — and two
things keep it from happening: the constructors above mean the API never asks
anyone to write a tagged tuple, and the mistake further requires one of
exactly three words as a literal text terminal in a thunk's return position.

And in the worst case it is found immediately. A rule that lost its thunk does
not misbehave subtly — it stops matching the grammar's own inputs, because the
tag becomes text the parser expects to consume. The first proof that exercises
that branch fails, in the change that introduced it. So what is actually
missing is a *type* error where there is already a *test* failure, which is a
worse diagnostic rather than an undetected defect; the concern that this ships
a plausible wrong parser does not survive that, since the wrong parser
disagrees with its own grammar's expectations on the first input.

That also answers the part a proof over this repository cannot reach. An
external grammar is not unprotected, it is protected by its own tests, and the
mistake shows up there the same way. The residual cost is a confusing failure
for someone who has not read this section — cheaper than a marker on every
operator in every grammar.

If catching it statically for external grammars ever becomes worth doing, a
linter is where it belongs: the check is the same one the in-repo proof makes,
generalized. **That is out of scope here** — this issue neither proposes nor
owes one, and it is not a reason to change the representation.

#### The one question left open

**What a `string` means.** Two candidates:

- **A sequence of symbols**, as the classical front end does today — `'abc'`
  is three code points, and `str` lowers it to a sequence of terminals.
- **One symbol, decoded** — the string names a single symbol in the
  alphabet's encoding, which is one terminal however many characters the name
  has.

The type shape does not depend on the answer; the AST shape does, so the
`AST<string>` row below cannot be written until it is settled.

Worth weighing: the answer may not be global, because the alphabet decides
what a string can mean. Over Unicode code points `'abc'` is naturally three
symbols. Over [token symbols](../token_symbol/) it is naturally one — that is
exactly what `fjs/djs/parser`'s `sym` does today,
`tokenEncoding.encode(name)`, turning a multi-character token name into a
single symbol. If both readings are wanted, the choice belongs to the alphabet
adapter rather than to `Const`, and then the open question becomes whether
`AST<string>` can be written at all without knowing which adapter is in play —
which would weaken the type-level mapping exactly where
[Problem 7](#problems-to-resolve-before-implementing) is already uncertain.

#### What this requires of a lowering

Stated as requirements on any data layer, since the target is open:

- **Validation belongs here, at the front end**, not in whatever the rules
  lower to. A form that cannot be given a meaning is rejected while the author
  still has a rule to point at:
  - `['repeat', min, max, r]`: the bounds are in the domain above and
    `min <= max`; and `r` must not match empty — a body that can consume
    nothing makes the cardinality unrecoverable, whatever the bounds
    ([Problem 3](#problems-to-resolve-before-implementing)). A body that
    *reaches* its own repeat is fine: `R = repeat0Plus(['(', R, ')'])` is a
    good grammar, and the only reason the classical fold refused it is that
    recognition could not tell it apart from a tree.
  - `['range', a, b]`: `a <= b` as decoded, and both are **ordinary** symbols —
    a range must not span or contain EOF, which is only ever the lone `-1`.
    Today's `not` / `fullRange` already guarantee this on their side
    ([Terminals and EOF](../README.md#terminals-and-eof)); the front end has to
    guarantee it on the authoring side.
  - A bare `number`: an integer in the terminal domain, EOF included.
- **The AST a rule implies is fixed by the table above**, so a lowering is
  correct only if the tree it produces matches. That is the invariant a second
  data layer would have to satisfy too, and it is why the table is written
  against `Info` rather than against any `RuleSet`.
- **Rule identity has to survive.** Transformers are keyed by the functional
  rule ([207-bnf-semantic-actions](./207-bnf-semantic-actions.md)), so any rule
  a lowering *synthesizes* is one an author cannot name. See
  [Problem 1](#problems-to-resolve-before-implementing).

#### The range-set helpers split

`not`, `remove`, and `notSet` today return a `RangeVariant` — an object whose
values are packed ranges — straight into a rule position. Once a bare number
in a rule means a symbol, that object is misread: every branch is taken as a
single symbol, silently, with no type error. So they cannot hand packed
numbers to this front end.

The split is by *layer*, and the two halves must not share a name. `terminal/`
owns the set arithmetic over packed ranges — `remove`, and a complement over
`RangeVariant` — used by lowerings and backends. The front end needs
complementation over **rules**, which is a different signature: it takes and
returns EBNF forms, and is built on the `terminal/` arithmetic rather than
duplicating it. Give it a name of its own (`notOf`, say) rather than a second
public `not`; two exports with one name in one bucket is what the reviewer of
this section is right to reject, and a re-export is barred by the
no-compatibility-re-export rule. The same applies to `remove`: the front-end
one takes a `'range'` form and a variant of bare symbols and returns rules.

Whether the EBNF-facing helpers live in `ebnf/` or in `unicode/` is not
settled here — see [Problem 9](#problems-to-resolve-before-implementing).
Small, but it fails quietly if forgotten, so it is a named task.

#### What it changes downstream

- The rtti map tests the shape directly; `repeatItem` and its per-call
  conversion go away.
- `Repeat0Plus<T>` is `() => readonly ['repeat', 0, 'Infinity', T]`;
  `Repeat1Plus` and the
  `Join*` types compose on it. The "if recognized as" caveat on `RepeatMap`
  goes.
- `detectRepeat` stays in `data/` as an opt-in `RuleSet → RuleSet`
  normalization for deserialized and hand-written sets. The `ebnf` `toData`
  never calls it. The one hand-written repeat in the tree, `characters` in
  `classic()` of `testlib.f.mjs`, either moves to `repeat0Plus(character)` or
  keeps `detectRepeat` as an explicit step in its proof.
- **Which constructors keep their AST, and which do not.** The port is
  checked against the `bnf` original where the shape is meant to survive, so
  the list has to be exact rather than "mostly the same":

  | constructor | classical AST | under this design |
  |---|---|---|
  | `repeat0Plus` | flat list (the fold already produces one) | unchanged |
  | `join1Plus` | `[T, flat list]` — a sequence whose tail is a repetition | unchanged |
  | `option` | `some`/`none` variant node | `[] \| [T]` — **changes** |
  | `repeat1Plus` | `readonly [T, Repeat0Plus<T>]` (`types.ts:81`), a 2-tuple of item and nested repetition | one flat non-empty list — **changes** |
  | `join0Plus` | `Option<…>` (`types.ts:85`) | **changes**, because `option` does |
  | `commaJoin0Plus` | a sequence containing `join0Plus` (`module.f.mjs:317`) | **changes**, transitively |

  So two primitives change and two composites inherit it; `join1Plus` is
  untouched because it is built from `repeat0Plus`, not from `repeat1Plus`.
  `commaJoin0Plus` matters out of proportion to its size: `fjs/bnf/lib/json`
  binds `cj = commaJoin0Plus(ws)` and uses it for both bracket pairs, so the
  array and object productions of the JSON grammar change shape, and their
  proof expectations with them.
  A grammar that additionally *adopts* a new form is not shape-preserving
  either — `\uXXXX` as `times(4)(hex)` is a 4-element sequence node where the
  old spelling spread four references into the parent.

- The equality is a property of this lowering, not a promise about a future
  one: what is fixed across data layers is the Rule → AST table, not the
  `RuleSet`.

#### Problems to resolve before implementing

Found reviewing this design against the backends, the transformer layer, and
the existing proofs. None is decided here; each is a thing that has to be
answered, and the last one is the reason the rest are worth answering first.

**1. A cardinality the data layer cannot represent must be reduced, and a
reduction synthesizes rules no author can name.** Transformers are keyed by
functional rule identity, and `ll1/module.f.mjs:397` asserts that every child
of a mapped variant is itself mapped ("mixed mapped and unmapped variant
boundary"). Today's `RuleSet` has one repetition, 0-or-more, so every other
bound has to be reduced: `['repeat', 0, 1, r]` becomes a two-branch variant
whose empty branch is a **fresh** `[]`, and nobody holds that rule, so mapping
an optional cannot satisfy the assertion — there is no reference to attach a
transformer to. It works in the classical front end only because `none` is a
*shared* export (`module.f.mjs:230`) that authors can name, and it has not
bitten yet only because nothing outside proofs uses the transformer path.

It is worse than unnameable rules: **on today's IR several AST rows are not
reachable at all.** `['repeat', 1, 'Infinity', r]` must reduce to an item
beside a `0..Infinity` repetition, whose AST is the 2-tuple
`[AST<r>, readonly AST<r>[]]` — not the flat non-empty list the table
specifies. Same for every bounded max. So on today's data layer the table
holds only for `0..Infinity`, and a lowering cannot be judged correct against
it. That is the strongest argument for a bounded-repeat representation, and
the reason this problem gates the lowering rather than merely complicating it.

Collapsing to one `'repeat'` form sharpened this rather than solving it: the
front end now says every cardinality in one shape, so the question is exactly
*which bounds a data layer represents natively and which it reduces*. A data
layer carrying bounds natively synthesizes nothing and the problem disappears;
today's synthesizes for every bound except `0..Infinity`. Options meanwhile:
reduce to shared singletons the front end exports, and state that transformers
attach to the `Info` thunk rather than to what it reduces to; or narrow what
the front end accepts to what the data layer can carry, which would put the
sugar back and is the option this design rejects. The choice belongs with the
data layer, which is why it is open.

**2. The backend proofs are built with the front end.** `ll1/proof.f.mjs:14`,
`descent/proof.f.mjs:10`, `data/proof.f.mjs:7` and `matcher/proof.f.mjs:8`
import `../module.f.mjs`, and the first two also import `../testlib.f.mjs`.
So "the backends are shared unchanged" holds for the modules and **not** for
their proofs: they break grammar-bucket's rule that nothing below a front end
imports one, and deleting `grammar/bnf` breaks every one of them. This also
undercuts `descentEquivalence` as a neutral guard — it currently proves the
two backends agree on grammars written in *one* front end's spelling. The
shape of a fix is that the backend proofs take `RuleSet` literals and each
front end separately proves it produces them, which would make the equivalence
claim front-end neutral for the first time. It is grammar-bucket's work, not
this issue's, but this issue cannot be finished without it.

**3. A nullable body is two different problems, and only one of them is
fatal.** The validation above rejects a nullable `r` at every bound, and that
conflates two cases:

- **Unbounded max.** A body that can consume nothing loops forever, or is
  stopped only by a matcher's zero-consumption guard
  ([`../descent/README.md`](../descent/README.md#repetition-is-flat)). This is
  non-termination and must stay rejected.
- **Bounded max.** The count is fixed, so nothing loops: `['repeat', 3, 3, r]`
  invokes `r` exactly three times whatever it matches. What remains is
  *ambiguity*, and only when `r` can match both empty and non-empty — for
  input `x` with a body matching `""` or `"x"`, `['repeat', 2, 2, r]` parses as
  `(x, "")` or `("", x)`. If `r` matches *only* empty, even that is
  unambiguous.

So rejecting a nullable body at a bounded max forbids grammars that are
perfectly well defined, `times(3)(option(x))` among them. The choices are to
reject only at unbounded max, to reject the genuinely ambiguous case (a body
that is nullable *and* can consume), or to keep the blanket rule for
simplicity and document what it costs. What must not survive is the current
text's stated reason — "makes the cardinality unrecoverable" — which is simply
false at a bounded max, where the cardinality is the bound.

**4. The optional's AST changes, and the proofs pin the old one.** Under the
table above an optional is a 0-or-1 list, where today it is a `some`/`none`
variant node. Production consumers do not appear to switch on
those tag names, but `descent/proof.f.mjs` and `ll1/proof.f.mjs` pin them
throughout their expected-AST strings — the JSON cases at
`descent/proof.f.mjs:288-296` are dense with `"some"(…)` and `"none"()`. So
every ported grammar that uses `option` changes shape, and the affected proof
expectations are rewritten with it. That is the intended improvement rather
than a regression, but it is a bulk edit that has to be planned, and it is a
second reason the port is not uniformly shape-preserving.

**5. The range-set helpers have an input side too.** The split below covers
what `not` returns. But `remove(range(' ' + unicodeMax), set('"\\'))` in the
JSON grammar now *takes* a `'range'` thunk and a variant of bare numbers, so the
EBNF-facing helpers have to accept EBNF forms as well as produce them, with
the packed arithmetic kept behind them. A helper that quietly reads a bare
number as a packed range is the same silent-misread bug in the other
direction.

**6. Reduction at the wrong level defeats memoization.** Writing a reduction as
functional rules — a `1..Infinity` repeat as an item beside a `0..Infinity`
one — creates a thunk during
conversion that has no `.name` and no identity an author shares, so it is
re-converted rather than memoized. A reduction that emits data-layer names
directly avoids this. Which is available depends on the data layer.

**7. Recursive rules need explicit annotations for `AST<T>` to work.**
TypeScript will not infer the type of a recursive thunk, so the type-level
mapping only pays off where the author annotates. Today's `Repeat0Plus<T>` is
annotated for exactly this reason. Worth confirming on a real recursive
grammar early, because if the annotations are onerous the table is a
documentation contract rather than a checked one — which would be a much
weaker version of this proposal.

**Smaller.** Every constructor returns an anonymous thunk, so
`const digit = range('09')` contributes no name to a serialized `RuleSet`;
generated names have never been contract, but readability drops. And one win
worth recording: `sym` in `fjs/djs/parser` is
`name => oneEncode(tokenEncoding.encode(name))`, which becomes just
`tokenEncoding.encode(name)`, and `eof` becomes the bare `-1` — so the DJS
parser stops importing the terminal codec altogether, shrinking what
grammar-bucket's stage 1 has to touch there.

**8. The AST table never says how a node is represented.** Every row is
written as a structural value — a symbol is `number`, a repetition is
`readonly AST<r>[]` — but today's AST is `{ tag, sequence }` nodes, where the
tag names the variant branch and the sequence holds consumed symbols and child
nodes in order ([`../README.md`](../README.md#ast)). Those are two different
things, and the issue has been using the structural spelling throughout
without saying whether it is the real target or shorthand for the node shape.

It matters in three places. `AST<Sequence>` and `AST<Variant>` cannot be
written until it is settled — they are the rows left loose above, and they are
the two an author hits most. The repetition row's promise that
`['repeat', 0, 1, r]` is a length-0-or-1 *list* is a claim about node
representation, not just about types, and
[Problem 4](#problems-to-resolve-before-implementing) is what it costs against
the existing proofs. And it decides whether "the same AST" in the port claim
means structurally identical trees or identical `{ tag, sequence }` values.

Two readings, and they are not equivalent: the structural one is a genuine
change to what a backend emits, on top of everything else here; the shorthand
one means the tables describe the *shape* a `{ tag, sequence }` tree has, and
`AST<T>` is a type over nodes rather than over plain values. The second is the
smaller change and probably what was meant, but nothing in this issue says so,
which is how it went eight revisions without being noticed.

**9. One alphabet adapter cannot return both representations.** The
adapters serve *both* front ends while they coexist, and the two want
different values from the same call. `range('09')` is a packed `TerminalRange`
to the classical front end and `() => ['range', 0x30, 0x39]` to this one;
`set('abc')` is a variant of packed singletons there and a variant of bare
symbols here. Whichever it returns, the other front end double-encodes or
rejects it.

That is a real conflict, not a naming one, and the plan does not currently
say how it is resolved. The shapes available: an alphabet module that exposes
only *decoding* (text to code points) with each front end building its own
rules on top; or one adapter with a per-front-end constructor layer over a
shared core; or duplicated adapters for the coexistence window, which
contradicts the single-owner rule that
[unicode-rules](./unicode-rules.md) exists to enforce.

It has to be answered before any grammar is ported, since the port is exactly
the moment both front ends need the same helper. It also decides where the
EBNF-facing `notOf` / `remove` from the section above live.

#### Left for later, deliberately

A separated repeat (a flat item list with the separators dropped) is worth
having — comma lists are the dominant repetition in the JSON and DJS grammars,
and it would remove a reduction. The natural spelling is a fourth element on
`'repeat'` rather than a fourth form, which would keep `Info` at three; either
way it needs a data layer that can represent it, so it belongs to whatever
data-layer work comes next. What this issue owes it is that adding it changes
one row of the table and none of the others.

Until the classical front end is deleted, `ebnf` gets no feature `bnf` lacks
beyond the `Info` forms above, so the two do not drift while both exist.

### Tasks

- [ ] `fjs/grammar/ebnf/types.ts`: the `Rule` / `Const` / `Thunk` / `Info`
      union above, the `Max` type, the `Repeat0Plus` / `Repeat1Plus` /
      `Join*` types over it,
      and the type-level `AST<Rule>` mapping from the table, with a proof per
      row that the parser's result has that type. Every form `toData` accepts
      is in `Info`, so the accepted syntax type-checks without a cast.
- [ ] Answer the open question above: what a `string` means, and whether the
      answer is global or the alphabet adapter's.
- [ ] Answer the nine problems above, in the issue, before writing code.
      8 comes first — the AST tables cannot be finished without it, and 4 and
      7 both depend on its answer. Then 1, 3 and 6 gate the lowering; 2 is
      grammar-bucket's and gates the proofs; 4 sizes the port; 9 gates the
      first grammar port and the helper split below.
- [ ] Add a proof that no `Const` in a grammar is an array whose head is
      `'const'`, `'range'` or `'repeat'` — the forgotten-thunk case the type
      system cannot catch now that bare strings are `Const`.
- [ ] `fjs/grammar/ebnf/module.f.mjs`: the primitive `repeat(min, max)`
      constructor with `option` / `repeat0Plus` / `repeat1Plus` / `times` as
      partial applications of it, plus `join0Plus`, `join1Plus` and the
      rule-level complement under its own name (`notOf`, never a second
      `not`); and the lowering: `['const', c]` unwrapped,
      `['repeat', min, max, r]` mapped or reduced per Problem 1, terminals
      lowered to whatever the data layer stores, and the validation listed
      above. The text-interpreting helpers — `range`, `set`,
      `str`, `notSet` — belong to the alphabet adapter at
      `fjs/grammar/unicode/`, which this module depends on and does not
      contain ([unicode-rules](./unicode-rules.md)).
- [ ] Split the range-set helpers by layer: packed-range arithmetic stays in
      `terminal/`; the rule-level complement is a distinctly *named* front-end
      helper built on it, never a second `not` or a re-export.
- [ ] `fjs/grammar/ebnf/rtti/`: the rule-info map without `repeatItem`.
- [ ] Proofs: every constructor, every `Info` form written directly rather than
      through a constructor, each bound shape — `0..1`, `0..Infinity`,
      `1..Infinity`, `n..n`, `n..m` — and the degenerate `0..0` and `1..1`,
      every lowering error, and the `descentEquivalence` cases re-expressed in
      `ebnf`. Those compare **backend results**, not rule sets: requiring an
      identical `RuleSet` would be requiring the port to reproduce shapes this
      design deliberately changes — every optional, which is now a 0-or-1 list
      rather than a `some`/`none` variant. Each case states whether its AST is
      expected to match the `bnf` original or to differ, and how.
- [ ] Port `fjs/grammar/lib/json` (its `\uXXXX` rule becomes `times(4)(hex)`,
      i.e. `['repeat', 4, 4, hex]`),
      then `lib/datajs`, then the `djs` tokenizer and parser, one PR each.
      Those are the only consumers: outside `fjs/bnf` itself, the whole
      repository imports it from five files, all under `fjs/djs`
      (`parser/module.f.mjs`, `parser/private.ts`, `tokenizer/module.f.mjs`,
      `tokenizer/private.ts`, `tokenizer/proof.f.mjs`).
- [ ] Update `data/README.md` and `descent/README.md`, which describe `Repeat`
      as "the one rule kind `toData` derives".
- [ ] `tsc`, `fjs t`. Each PR that breaks the public API declares it with a
      `**BREAKING CHANGES:**` item in its `Changelog:` section; there are no
      per-PR changelog files any more
      ([changelog/RELEASE.md](../../../changelog/RELEASE.md)).

### Related

- [grammar-bucket](../../todo/grammar-bucket.md) — the layout this module
  lands in and the dependency inversion it needs.
- [`fjs/rtti/types.ts`](../../rtti/types.ts) — the eDSL shape this union
  copies: `Type = Const | Thunk`, plain values used directly, a thunk always
  returning a tagged tuple, and `['const', c]` as the escape, kept under the
  same name here.
- [the `repeat` rule](../data/README.md#the-repeat-rule) — the recognition
  this front end makes unnecessary; `detectRepeat` survives as opt-in.
- [unicode-rules](./unicode-rules.md) — owns the text lowering; whether
  `ebnf` keeps a `string` in `Const` at all is one of the two open questions
  above, and that issue's "remove `string` from the functional `Rule`" task is
  the classical front end's, not necessarily this one's.
- [terminal-range-shared-type](./terminal-range-shared-type.md) — the packed
  `TerminalRange` becomes data-layer only under this design; its owner is
  `terminal/` either way.
- [rule-visitor](./rule-visitor.md) — the data `Rule` visitor; unaffected,
  since the data union does not change.
- [207-bnf-semantic-actions](./207-bnf-semantic-actions.md) — rule maps keyed
  by rule identity; the fold's dropped rules were its sharpest edge.
