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

#### The rule union

The functional string literal never enters `ebnf`; text terminals come from
the alphabet adapter that [unicode-rules](./unicode-rules.md) introduces,
which lives at `fjs/grammar/unicode/` as a sibling of both front ends rather
than inside either ([grammar-bucket](../../todo/grammar-bucket.md)). With
no string `Rule`, an array whose first element is a string cannot be a
sequence, and the tagged array is a rule kind of its own:

```ts
type Rule = Variant | Sequence | TerminalRange | Tagged | Thunk
type Op = '*' | '?' | '+'
type Tagged = readonly [Op, Rule]
type Sequence = readonly Rule[]      // Rule has no string case, so disjoint
type Thunk = () => DataRule          // as today; may now return Tagged
```

`Tagged` admits every operator a grammar may **write**, not just the one that
survives to the data form: `'?'` and `'+'` are desugared by `toData` (below),
but a grammar spells them directly, so leaving them out of the union would make
`tsc` reject the accepted syntax and force a cast at every use.

Runtime discrimination is `typeof rule[0] === 'string'`. `LazyRule` is renamed
`Thunk`: laziness breaks recursion and nothing else, and repetition is
orthogonal to it — `[minus, ['*', digit]]` is an inline repetition with no
thunk, and a thunk that returns a plain sequence stays a plain recursive rule.
Tagging the thunk's return instead would make the common case the tagged one
and rule out inline repetition.

#### Which operators are primitive

One reaches the data form: `'*'`. It is the only operator that changes the AST
contract — one flat node instead of a cons chain
([Repetition is flat](../descent/README.md#repetition-is-flat)) — and the data
`Repeat` already encodes it. `toData` transcribes `['*', r]` to the data
`Repeat` of `r`'s name.

`'?'` and `'+'` are `Tagged` in the rule union like `'*'`, so a grammar spells
them, but `toData` **desugars** them rather than passing them down, so the
backends grow no case:

- `['?', r]` becomes `{ some: r, none: [] }` — the node shapes `option`
  produces today.
- `['+', r]` becomes `[r, ['*', r]]`.
- `repeat0Plus`, `repeat1Plus`, `option`, `join0Plus`, `join1Plus` stay as
  constructors over those shapes.

Two checks the fold used to sidestep by declining to fold become errors in
`toData`: an item that can match empty (infinitely many parses of the same
input), and a rule that is its own item with nothing in between. An item that
reaches its own repeat is allowed.

#### What it changes downstream

- The rtti map tests the shape directly; `repeatItem` and its per-call
  conversion go away.
- `Repeat0Plus<T>` is `Tagged`; `Repeat1Plus` and the `Join*` types compose on
  it. The "if recognized as" caveat on `RepeatMap` goes.
- `detectRepeat` stays in `data/` as an opt-in `RuleSet → RuleSet`
  normalization for deserialized and hand-written sets. The `ebnf` `toData`
  never calls it. The one hand-written repeat in the tree, `characters` in
  `classic()` of `testlib.f.mjs`, either moves to `['*', character]` or keeps
  `detectRepeat` as an explicit step in its proof.
- The data `Repeat` and the AST contract do not change, so a grammar ported
  from `bnf` to `ebnf` produces the same `RuleSet` and the same AST. That is
  what makes the port one grammar per PR.

#### Left for later, deliberately

A minimum count (`'+'` as a core kind with a flat node of at least one item)
and a separator (`['*', item, sep]` with a flat item list) are both worth
having — comma lists are the dominant repetition in the JSON and DJS grammars
— but each changes the serialized `Repeat` and every backend. Land `'*'`
first; the data `Repeat` can grow from a name to a record when one of them
is designed.

Until the classical front end is deleted, `ebnf` gets no feature `bnf` lacks
beyond `'*'`, `'?'`, and `'+'`, so the two do not drift while both exist.

### Tasks

- [ ] `fjs/grammar/ebnf/types.ts`: the `Rule` union above, `Op`, `Tagged`,
      `Thunk`, and the `Repeat0Plus` / `Repeat1Plus` / `Join*` types over it.
      Every operator `toData` accepts is in `Op`, so the accepted syntax
      type-checks without a cast.
- [ ] `fjs/grammar/ebnf/module.f.mjs`: the rule constructors (`not`, `option`,
      `repeat0Plus`, `repeat1Plus`, `join0Plus`, `join1Plus`) and `toData` /
      `toDataWithRules` transcribing `'*'`, desugaring `'?'` and `'+'`,
      rejecting a nullable item and a self-item. The text-interpreting
      helpers — `range`, `set`, `str`, `notSet` — belong to the alphabet
      adapter at `fjs/grammar/unicode/`, which this module depends on and does
      not contain ([unicode-rules](./unicode-rules.md)).
- [ ] `fjs/grammar/ebnf/rtti/`: the rule-info map without `repeatItem`.
- [ ] Proofs: every constructor, every `toData` case — including a grammar
      that writes `'?'` and `'+'` directly rather than through a constructor —
      both errors, and the `descentEquivalence` cases re-expressed in `ebnf`,
      producing the same `RuleSet` as their `bnf` originals.
- [ ] Port `fjs/grammar/lib/json`, then `lib/datajs`, then the `djs` tokenizer
      and parser, then `fjs/rtti/common`, one PR each.
- [ ] Update `data/README.md` and `descent/README.md`, which describe `Repeat`
      as "the one rule kind `toData` derives".
- [ ] `tsc`, `fjs t`, changelog.

### Related

- [grammar-bucket](../../todo/grammar-bucket.md) — the layout this module
  lands in and the dependency inversion it needs.
- [the `repeat` rule](../data/README.md#the-repeat-rule) — the recognition
  this front end makes unnecessary; `detectRepeat` survives as opt-in.
- [unicode-rules](./unicode-rules.md) — removes the string literal from the
  classical front end; `ebnf` starts without it and takes text terminals from
  the helper that issue adds.
- [rule-visitor](./rule-visitor.md) — the data `Rule` visitor; unaffected,
  since the data union does not change.
- [207-bnf-semantic-actions](./207-bnf-semantic-actions.md) — rule maps keyed
  by rule identity; the fold's dropped rules were its sharpest edge.
