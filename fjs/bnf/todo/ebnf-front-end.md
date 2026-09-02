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
backends, the matcher, `emptyTagMap`, and the `descentEquivalence` proofs are
shared unchanged — a repetition already reaches them as the data `Repeat`.

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
glyph where the distinction exists. The packed `TerminalRange` stays the
*data-layer* terminal, since that is what serializes and what the backends
dispatch on; it simply stops being something an author writes. `toData` lowers
`n` with `oneEncode` and `['...', a, b]` with `rangeEncode`, and the
`0x000030_000039` literal never appears in a grammar again. This is the same
"one meaning per layer" the data README already accepts for `string`: a
functional `number` is a symbol, a data `number` is a packed range.

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
identical defect at a different value. The JSON grammar already wants the
count form for `\uXXXX`, which it spells today as
`...repeat(4)({ digit, AF, af })`, a list-level `repeat` spread into a
sequence; `() => [4, hex]` is that as a grammar form.

**Operators.** One reaches the data form: `'*'`. It is the only operator that
changes the AST contract — one flat node instead of a cons chain
([Repetition is flat](../descent/README.md#repetition-is-flat)) — and the data
`Repeat` already encodes it. `'?'` and `'+'` are **desugared** by `toData`:
`['?', r]` to `{ some: r, none: [] }`, the node shapes `option` produces
today, and `['+', r]` to `[r, () => ['*', r]]`. So the backends grow no case,
and a grammar still reads like EBNF.

**The AST is a function of the form.** This is the contract the type-level
mapping implements, one row per `Info` form, each a function of the form alone
— and the rule for adding a form is that its row must be, too:

| form | AST |
|---|---|
| `['const', c]` | `AST<c>` |
| `['...', a, b]` | `number` — one symbol leaf |
| `[n, r]` | `readonly AST<r>[]`, a tuple of length `n` when `n` is a literal |
| `['*', r]` | `readonly AST<r>[]` — one flat node |
| `['?', r]` | `['some', AST<r>] \| ['none', []]` |
| `['+', r]` | `[AST<r>, readonly AST<r>[]]` |

`[n, r]` and `['*', r]` share a row on purpose: a count is a repetition whose
length is known, and a consumer that folds one can fold the other.

**Constructors** hide the thunks, the way RTTI's `array(t)` does:
`repeat0Plus(r)` is `() => ['*', r]`, `range('09')` is
`() => ['...', 0x30, 0x39]`, `times(4, r)` is `() => [4, r]`, `set('abc')` is
the plain variant `{ a: 0x61, b: 0x62, c: 0x63 }`, and `option`, `repeat1Plus`,
`join0Plus`, `join1Plus` compose on them. An author writes
`[minus, repeat0Plus(digit)]` and never types a tagged tuple by hand.

#### Two questions left open, and the trade between them

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

#### `toData`

- `['*', r]` becomes the data `Repeat` of `r`'s name. Two checks the fold used
  to sidestep by declining to fold become errors: an item that can match
  empty (infinitely many parses of the same input), and a rule that is its
  own item with nothing in between. An item that *reaches* its own repeat is
  allowed — `R = repeat(['(', R, ')'])` is a fine grammar, and both backends
  already match a `RuleSet` that spells it.
- `[n, r]`: `n` must be a non-negative integer; anything else is an error.
- `['...', a, b]`: `a <= b`, both in the terminal domain; anything else is an
  error.
- A `number` lowers with `oneEncode`; a `string` per the open decision above.

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
- The data `Repeat`, the data `TerminalRange`, and the AST contract do not
  change, so a grammar ported from `bnf` to `ebnf` produces the same
  `RuleSet` and the same AST. That is what makes the port one grammar per PR.

#### Left for later, deliberately

A minimum count *at the data layer* (a flat node of at least one item, rather
than the `[r, () => ['*', r]]` desugaring) and a separator (`['*', item, sep]`
with a flat item list) are both worth having — comma lists are the dominant
repetition in the JSON and DJS grammars — but each changes the serialized
`Repeat` and every backend. Land `'*'` first; the data `Repeat` can grow from
a name to a record when one of them is designed.

Until the classical front end is deleted, `ebnf` gets no feature `bnf` lacks
beyond the `Info` forms above, so the two do not drift while both exist.

### Tasks

- [ ] `fjs/grammar/ebnf/types.ts`: the `Rule` / `Const` / `Thunk` / `Info`
      union above, the `Repeat0Plus` / `Repeat1Plus` / `Join*` types over it,
      and the type-level `AST<Rule>` mapping from the table, with a proof per
      row that the parser's result has that type. Every form `toData` accepts
      is in `Info`, so the accepted syntax type-checks without a cast.
- [ ] Decide, and record here, whether bare `number` and `string` stay in
      `Const`, and how a `string` lowers.
- [ ] `fjs/grammar/ebnf/module.f.mjs`: the constructors (`option`,
      `repeat0Plus`, `repeat1Plus`, `times`, `join0Plus`, `join1Plus`, and the
      EBNF-facing `not`) and `toData` / `toDataWithRules`: `'*'` transcribed,
      `'?'` and `'+'` desugared, `['const', c]` unwrapped, `[n, r]` lowered
      to a sequence of `n` for every `n`, `'...'` and `number` lowered through
      `terminal/`, and
      the four errors above. The text-interpreting helpers — `range`, `set`,
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
