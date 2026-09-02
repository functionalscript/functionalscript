## ebnf-front-end. A front end with a repetition primitive

**Priority:** P3
**Status:** blocked
**Blocked by:**
- [grammar-bucket](../../todo/grammar-bucket.md) stages 1-4 — the dependency
  inversion: the neutral modules must stop importing the classical front end,
  in type as well as at runtime, before a second front end can share them.
  The later moves of the already-neutral modules are not a prerequisite.
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
    | readonly ['const', Const]          // the escape: a plain rule behind a thunk
    | readonly ['...', number, number]   // the inclusive range of symbols a..b
    | readonly [number, Rule]            // n copies of the rule, always a sequence
    | readonly ['*', Rule]               // zero or more
    | readonly ['?', Rule]               // optional
    | readonly ['+', Rule]               // one or more
```

Discrimination is by JavaScript type at every level, as elsewhere: a function
is a thunk and is called; the first element of what it returns is a `number`
(a count) or a string (an operator glyph); a plain `number` is a symbol, a
string is text, an array a sequence, an object a variant. The tag slot holding
`string | number` is a step away from RTTI's all-string tags, accepted for this
one case because `[4, hex]` reads as what it is and `['#', 4, hex]` does not.
The `minmax` question below would remove the compromise entirely by removing
the numeric tag.

The thunk still names its rule — `toData` reads `fr.name` as today — so
nearly every named rule is a thunk, and the uniform wrapper is paid on every
one of them. That is deliberate: an earlier draft let a thunk return a bare
sequence and put a tagged array directly in `Rule`, which is shorter to write
and ambiguous the moment `string` is a rule (`['*', x]` is then either the
repeat or the literal asterisk followed by `x`). The uniform return is what
lets the string question below stay open without deciding this one.

**Terminals.** A plain `number` in a rule is **one symbol**, not a packed
range: `0x61` is the letter, `-1` is EOF. A range is the `'...'` form, `'...'`
rather than `'..'` because both ends are inclusive and that is the closed-range
glyph where the distinction exists.

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

**Counts.** `[n, r]` is `n` copies of `r`, and it is a sequence for **every**
`n`: `[0, r]` is `[]`, `[1, r]` is the one-element sequence `[r]`, `[n, r]` is
`n` references. An earlier draft lowered `[1, r]` to `r` itself so the count
form could double as the escape and save the `'const'` tag. That was wrong for
the reason ebnf exists: the AST has to be a *function of the rule's type*, and
under that lowering `() => [number, Rule]` mapped to `AST<r> | AST<r>[]`, two
shapes decided by a value — the repeat-recognition ambiguity again, moved into
the count. No numeric tag can be the escape for the same reason; `0` has the
identical defect at a different value.

`[1, r]` stays **legal, and discouraged**. It is a real count and lowers to
the one-element sequence `[r]`, exactly as the table says, so `toData` must
not reject it — a count read off a value at grammar-construction time may well
be `1`, and the form has to be total. But an author who *writes* `[1, r]` by
hand almost always means `['const', r]`, and the two differ: the const escape
is `r`'s own node, the count is a sequence node with `r` inside it, and a
transformer attached to one does not see the other. The discouragement is in
the docs and the constructors — `times(n, r)` is the way to write a count, and
`['const', r]` the way to write "just `r`" — not in `toData`, which has no way
to tell a hand-written `1` from a computed one.

The JSON grammar already wants the count form for `\uXXXX`, which it spells
today as
`...repeat(4)({ digit, AF, af })`, a list-level `repeat` spread into a
sequence; `() => [4, hex]` is that as a grammar form.

**Operators.** `'*'` is the one form whose AST is not the shape its spelling
suggests: a flat node rather than a cons chain
([Repetition is flat](../descent/README.md#repetition-is-flat)). `'?'` and
`'+'` are expressible in terms of the others — an optional is a two-branch
variant, a one-or-more is an item followed by a repetition — so a lowering may
either pass them through or reduce them.

**Which of these a data layer represents natively, and which are reduced on the
way down, is deliberately not settled here.** Today's `RuleSet` has a `Repeat`
and nothing else, so `'*'` maps across and the rest reduce; a future data layer
with a count or a bounded repeat would map more of them. The front end is the
same either way, which is the property worth protecting — but the reduction is
not free, and [Problem 1](#problems-to-resolve-before-implementing) is what it
costs.

**The AST is a function of the form.** This is the contract the type-level
mapping implements, one row per `Info` form, each a function of the form alone
— and the rule for adding a form is that its row must be, too:

| form | AST | cardinality |
|---|---|---|
| `['const', c]` | `AST<c>` | — |
| `['...', a, b]` | `number` — one symbol leaf | — |
| `[n, r]` | `readonly [AST<r>, … ]`, length `n` when `n` is a literal | exactly `n` |
| `['?', r]` | `readonly [] \| readonly [AST<r>]` | 0 or 1 |
| `['*', r]` | `readonly AST<r>[]` | 0 or more |
| `['+', r]` | `readonly [AST<r>, ...AST<r>[]]` | 1 or more |

**The last four rows are one family.** Every one of them is a flat array of
`AST<r>`; they differ only in the cardinality they admit, and each is a
bounded repetition — `[n, r]` is min `n` max `n`, `'?'` is 0..1, `'*'` is
0..∞, `'+'` is 1..∞. A consumer that folds any of them folds all of them, and
`.length` is the discriminator in every case, including `'?'`.

This is why `'?'` is `[] | [AST<r>]` rather than a tagged
`['some', …] | ['none', []]`. The tagged form made an optional a *choice*,
which put it in a different family from the other three and invented two tag
names the grammar never asked for; as a length-0-or-1 list it is the same
thing as the rest, one row shorter, and nothing is lost — an author who wants
named branches writes the plain `Variant` `{ some: r, none: [] }`, which is
still an ordinary `Const`. `'+'` follows for the same reason: a flat non-empty
list, not an item beside a nested repetition.

The consequence for a data layer is worth stating plainly, and it is a
consequence rather than a decision: **a lowering satisfies this table only if
it has a form that yields a flat node for each cardinality.** Today's `RuleSet`
does not — reducing `'?'` to `{ some: r, none: [] }` produces a tagged variant
node, not a 0-or-1 list. So either the data layer grows a bounded repeat, or
`'?'` and `'+'` cannot keep these rows. The upside is that one data-layer form
covers all four: a repeat carrying `min` and `max` subsumes the count, the
option, the star and the plus, so this table asks for *fewer* data-layer forms
than the tagged version did, not more.

**Constructors** hide the thunks, the way RTTI's `array(t)` does:
`repeat0Plus(r)` is `() => ['*', r]`, `range('09')` is
`() => ['...', 0x30, 0x39]`, `times(4, r)` is `() => [4, r]`, `set('abc')` is
the plain variant `{ a: 0x61, b: 0x62, c: 0x63 }`, and `option`, `repeat1Plus`,
`join0Plus`, `join1Plus` compose on them. An author writes
`[minus, repeat0Plus(digit)]` and never types a tagged tuple by hand.

#### Questions left open

**Whether one `minmax` form replaces the four cardinality forms.** The table
above says the count, the option, the star and the plus are one family
differing only in admitted cardinality. If that is true, the honest spelling
is one form —

```ts
readonly ['minmax', number, number, Rule]   // min, max, body
```

— of which `[n, r]` is `min = max = n`, `'?'` is `0..1`, `'*'` is `0..∞`, and
`'+'` is `1..∞`, with the four glyphs demoted from primitives to constructors
(`repeat0Plus(r)` returning `['minmax', 0, ∞, r]`, and so on). Authors write
constructors either way, so the readability cost falls only on hand-written
tuples, which are rare.

What it would buy, beyond one row instead of four:

- `Info` drops from six forms to three — `'const'`, `'...'`, `'minmax'` — so
  a lowering has three cases and a *second data layer* has three things to
  represent. That is the strongest argument, given that the data layer is
  deliberately open.
- Every tag becomes a string again, which removes the `string | number` tag
  slot noted above as a deliberate step away from RTTI parity.
- The `[1, r]` legal-but-discouraged wart disappears: nobody writes
  `['minmax', 1, 1, r]` meaning "just `r`", so the form that had to be
  accepted-but-discouraged stops being confusable with the escape.
- It is symmetric with `'...'` — a range over counts beside a range over
  symbol values — and it closes the bounded-repeat item under "left for
  later" by making it the primitive rather than a future addition.

The AST row stays a function of the type, so this does not reintroduce the
ambiguity that killed `[1, r] → r`: `['minmax', a, b, r]` is a flat
`readonly AST<r>[]`, refined to a fixed-length tuple when `a` and `b` are
equal literals. That refinement is the only place the type checker can tell
the cardinalities apart, which is worth confirming against
[Problem 7](#problems-to-resolve-before-implementing) before committing.

The sub-question it opens is how to spell an unbounded max. `Infinity` reads
correctly and compares correctly (`n <= Infinity`), at the cost of not being
an integer and not surviving JSON; `undefined` or a missing element is
JSON-safe but makes the tuple ragged. Since the front end is JS rather than
JSON, `Infinity` is probably fine — but it is a data-layer-facing choice, so
it belongs with the rest of the open ones.

**Whether `string` stays in `Const`, and what it means.** A string may lower
to a sequence of code points, as `str` does today for more than one, or to one
symbol, or to one when it has one code point and a sequence otherwise. The
union above lists it provisionally; the type shape does not depend on the
answer, only what `toData` emits and what AST shape a grammar gets, and the
lowering is the alphabet adapter's job either way
([unicode-rules](./unicode-rules.md)). So it can stay open without blocking
the front end.

**Whether bare `number` and `string` belong in `Const` at all.** They buy
readability: `0x61`, `-1`, and `set('abc')` as a plain variant of plain
numbers. The cost is that a tagged tuple written *without* its thunk is then a
legal rule with a different meaning — `[3, digit]` is "symbol 3, then a digit",
`['*', r]` is "a literal asterisk, then `r`" — and `tsc` accepts both, so a
forgotten `() =>` is a silent wrong parse rather than a compile error. If
`Const` were only `Sequence | Variant`, both forms would fail to type-check
outside a thunk and the mistake would be caught, at the price of `sym(0x61)`
and `() => ['...', 0x61, 0x61]` for every lone symbol. Constructors make the
first choice much safer, since a hand-written tagged tuple is rare, but a
tagged tuple in a `Const` position is a smell only proofs can pin. Whichever
way this goes, the choice is recorded here because it is the kind that shows
up as a wrong parse months later.

#### What this requires of a lowering

Stated as requirements on any data layer, since the target is open:

- **Validation belongs here, at the front end**, not in whatever the rules
  lower to. A form that cannot be given a meaning is rejected while the author
  still has a rule to point at:
  - `[n, r]`: `n` is a non-negative integer.
  - `['...', a, b]`: `a <= b` as decoded, and both are **ordinary** symbols —
    a range must not span or contain EOF, which is only ever the lone `-1`.
    Today's `not` / `fullRange` already guarantee this on their side
    ([Terminals and EOF](../README.md#terminals-and-eof)); the front end has to
    guarantee it on the authoring side.
  - A bare `number`: an integer in the terminal domain, EOF included.
  - `['*', r]`, and see [Problem 3](#problems-to-resolve-before-implementing)
    for the rest of the family: `r` must not match empty — a body that can
    consume nothing gives the same input infinitely many parses. A body that
    *reaches* its own repeat is fine: `R = repeat(['(', R, ')'])` is a good grammar, and the
    only reason the classical fold refused it is that recognition could not
    tell it apart from a tree.
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
numbers to this front end. The alphabet-neutral set arithmetic on packed
ranges stays in `terminal/` unchanged, used by `toData` and the backends; the
EBNF-facing `not(v)` wraps each surviving range as `() => ['...', a, b]`.
Small, but it fails quietly if forgotten, so it is a named task.

#### What it changes downstream

- The rtti map tests the shape directly; `repeatItem` and its per-call
  conversion go away.
- `Repeat0Plus<T>` is `() => readonly ['*', T]`; `Repeat1Plus` and the
  `Join*` types compose on it. The "if recognized as" caveat on `RepeatMap`
  goes.
- `detectRepeat` stays in `data/` as an opt-in `RuleSet → RuleSet`
  normalization for deserialized and hand-written sets. The `ebnf` `toData`
  never calls it. The one hand-written repeat in the tree, `characters` in
  `classic()` of `testlib.f.mjs`, either moves to `repeat0Plus(character)` or
  keeps `detectRepeat` as an explicit step in its proof.
- Against **today's** data layer a ported grammar can produce the same
  `RuleSet` and the same AST, which is what makes the port one grammar per PR
  and lets each port be checked against the `bnf` original. Two caveats. A
  grammar that adopts a new form is not shape-preserving — `\uXXXX` as
  `times(4, hex)` is a 4-element sequence node where the old spelling spread
  four references into the parent, so its AST and its proof expectations
  change with it, deliberately. And the equality is a property of this
  lowering, not a promise about a future one: what is fixed across data layers
  is the Rule → AST table, not the `RuleSet`.

#### Problems to resolve before implementing

Found reviewing this design against the backends, the transformer layer, and
the existing proofs. None is decided here; each is a thing that has to be
answered, and the last one is the reason the rest are worth answering first.

**1. A reduced form synthesizes rules no author can name.** Transformers are
keyed by functional rule identity, and `ll1/module.f.mjs:397` asserts that
every child of a mapped variant is itself mapped ("mixed mapped and unmapped
variant boundary"). If `['?', r]` is reduced to a two-branch variant whose
empty branch is a **fresh** `[]` — which is what today's data layer would
force, and which the table above no longer describes — nobody holds that rule,
so mapping a `?`-rule cannot satisfy the assertion — there is no reference to attach a
transformer to. Today this works only because `none` is a *shared* export
(`module.f.mjs:230`) that authors can name, and it has not bitten yet only
because nothing outside proofs uses the transformer path. Options: reduce to
shared singletons that the front end exports, and state that transformers
attach to the `Info` thunk rather than to what it reduces to; or represent the
form natively in the data layer so nothing is synthesized; or keep `'?'` and
`'+'` out of `Info` and make `option` / `repeat1Plus` ordinary constructors.
The choice interacts with the data layer, which is why it is open.

The unified AST family above narrows this a good deal: if a data layer carries
one bounded-repeat form, `'?'` and `'+'` map onto it directly and **nothing is
synthesized**, so the unnameable-rule problem does not arise for them at all.
That is an argument about which data layer to build, not a fix available
today.

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

**3. The nullable-item rule belongs to the whole repetition family, not just
`'*'`.** A nullable `r` makes the cardinality unrecoverable in every one of
the four forms, not only the star: empty input matches `['?', r]` as both zero
copies and one empty copy, and matches `[3, r]` as three empty copies
indistinguishably. Today an optional's version of this resolves silently —
two nullable variant branches, and `emptyTagOf` takes the last. The validation
above states the rule for `'*'` alone; it should either cover the family or
say why a form is exempt. Whichever way, silently picking one parse is what
this front end exists to stop.

**4. Untagging `'?'` changes the AST of every optional, and the proofs pin
it.** Under the table above an optional is a 0-or-1 list, where today it is a
`some`/`none` variant node. Production consumers do not appear to switch on
those tag names, but `descent/proof.f.mjs` and `ll1/proof.f.mjs` pin them
throughout their expected-AST strings — the JSON cases at
`descent/proof.f.mjs:288-296` are dense with `"some"(…)` and `"none"()`. So
every ported grammar that uses `option` changes shape, and the affected proof
expectations are rewritten with it. That is the intended improvement rather
than a regression, but it is a bulk edit that has to be planned, and it is a
second reason the port is not uniformly shape-preserving.

**5. The range-set helpers have an input side too.** The split below covers
what `not` returns. But `remove(range(' ' + unicodeMax), set('"\\'))` in the
JSON grammar now *takes* a `'...'` thunk and a variant of bare numbers, so the
EBNF-facing helpers have to accept EBNF forms as well as produce them, with
the packed arithmetic kept behind them. A helper that quietly reads a bare
number as a packed range is the same silent-misread bug in the other
direction.

**6. Reduction at the wrong level defeats memoization.** Writing a reduction as
functional rules — `['+', r]` as `[r, () => ['*', r]]` — creates a thunk during
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

#### Left for later, deliberately

A separated repeat (a flat item list with the separators dropped) is worth
having — comma lists are the
dominant repetition in the JSON and DJS grammars, and it would make Problem 1
smaller by removing a reduction. It needs a data layer that can represent it,
so it belongs to whatever data-layer work comes next rather than here. What
this issue owes it is that adding it is a new `Info` form and a new row in
the table, not a change to the existing rows. (A *bounded* repeat is no longer
listed here: it is the `minmax` question above, which would make it the
primitive rather than an addition.)

Until the classical front end is deleted, `ebnf` gets no feature `bnf` lacks
beyond the `Info` forms above, so the two do not drift while both exist.

### Tasks

- [ ] `fjs/grammar/ebnf/types.ts`: the `Rule` / `Const` / `Thunk` / `Info`
      union above, the `Repeat0Plus` / `Repeat1Plus` / `Join*` types over it,
      and the type-level `AST<Rule>` mapping from the table, with a proof per
      row that the parser's result has that type. Every form `toData` accepts
      is in `Info`, so the accepted syntax type-checks without a cast.
- [ ] Answer the three open questions above. The `minmax` one is the
      load-bearing one — it decides how many forms `Info` has and therefore
      how much a second data layer has to represent — so answer it first, and
      the other two only affect `Const`.
- [ ] Answer the seven problems above, in the issue, before writing code.
      1, 3 and 6 gate the lowering; 2 is grammar-bucket's and gates the
      proofs; 4 sizes the port; 7 gates whether the AST table is a checked
      contract or only a documented one.
- [ ] Decide, and record here, whether bare `number` and `string` stay in
      `Const`, and how a `string` lowers.
- [ ] `fjs/grammar/ebnf/module.f.mjs`: the constructors (`option`,
      `repeat0Plus`, `repeat1Plus`, `times`, `join0Plus`, `join1Plus`, and the
      EBNF-facing `not`) and the lowering: `['const', c]` unwrapped, `[n, r]`
      lowered to a sequence of `n` for every `n`, `'*'` mapped, `'?'` and
      `'+'` per Problem 1, terminals lowered to whatever the data layer
      stores, and the validation listed above. The text-interpreting helpers — `range`, `set`,
      `str`, `notSet` — belong to the alphabet adapter at
      `fjs/grammar/unicode/`, which this module depends on and does not
      contain ([unicode-rules](./unicode-rules.md)).
- [ ] Split the range-set helpers: packed-range set arithmetic stays in
      `terminal/`; the EBNF `not` wraps each range as `() => ['...', a, b]`.
- [ ] `fjs/grammar/ebnf/rtti/`: the rule-info map without `repeatItem`.
- [ ] Proofs: every constructor, every `Info` form written directly rather than
      through a constructor, `[0, r]` / `[1, r]` / `[n, r]` producing `[]` /
      `[r]` / a sequence of `n`, every `toData` error, and the
      `descentEquivalence`
      cases re-expressed in `ebnf`, producing the same `RuleSet` as their
      `bnf` originals.
- [ ] Port `fjs/grammar/lib/json` (its `\uXXXX` rule becomes `times(4, hex)`),
      then `lib/datajs`, then the `djs` tokenizer and parser, then
      `fjs/rtti/common`, one PR each.
- [ ] Update `data/README.md` and `descent/README.md`, which describe `Repeat`
      as "the one rule kind `toData` derives".
- [ ] `tsc`, `fjs t`, changelog.

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
