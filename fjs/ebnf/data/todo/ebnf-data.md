## ebnf-data. The serializable EBNF rule set

**Priority:** P3
**Status:** open

The `ebnf/data/` piece of [ebnf-migration](../../../todo/ebnf-migration.md):
the intermediate representation (IR) the EBNF backends consume, and the
lowering from the front end in [`../../module.f.mjs`](../../module.f.mjs)
into it. It settles the carrier question [ebnf-front-end](../../../bnf/todo/ebnf-front-end.md)
(Problem 1) and [ebnf-range-set](../../../bnf/todo/ebnf-range-set.md)
("Decide with the bounded repeat") both defer to this layer, and it absorbs
the design of [rule-visitor](../../../bnf/todo/rule-visitor.md).

### Problem

The classical IR in [`fjs/bnf/data`](../../../bnf/data/README.md) is four rule
kinds told apart by JavaScript type alone: a number is a terminal range, an
array a sequence of rule names, an object a variant of rule names, and a
string the name of a rule to repeat zero or more times. That property is what
its every consumer dispatches on, and the EBNF front end breaks it twice:

- **A terminal is a set of ranges**, not one packed number. Its value is a
  `RangeSet` — a list of numbers — which is an array, the type a sequence
  already owns.
- **A repetition carries bounds.** `['repeat', min, max, rule]` has three
  fields where the classical `Repeat` has one, and a bare name cannot hold
  them.

So the EBNF IR is a different carrier, not the classical one with two rows
edited, and the record already says not to land either half as a special
case: choose the carrier once, for both. What cannot change is the contract
on top of it — every rule of a set has a name, the AST is one node per rule
invocation, and a repetition is one flat node whatever its bounds
([the AST is one contract](../../../bnf/README.md#the-ast-is-one-contract)).

### Proposal

#### The form

A rule set is a map from name to rule, exactly as today. **Every rule is a
tagged tuple whose first element names its kind**, and a string anywhere
else in a rule is the name of another rule of the same set:

```ts
type RuleSet  = StringMap<Rule>

type Rule =
    | readonly ['set', ...RangeSet]                  // one symbol from the set
    | readonly ['sequence', ...readonly string[]]    // the named rules in order
    | readonly ['variant', StringMap<string>]        // one of the named rules, by tag
    | readonly ['repeat', number, number, string]    // min..max copies of the named rule
```

The two rows the front end spells are the front end's own `Info` tuples with
the nested rule replaced by its name — `() => ['set', 48, 58]` lowers to
`['set', 48, 58]`, and `() => ['repeat', 0, Infinity, digit]` to
`['repeat', 0, Infinity, 'digit']`. The other two are the front end's plain
array and object, tagged because in the data form the array is no longer
free: a tuple that begins with a tag and a list of names are both arrays, and
nothing but a tag tells them apart. The tag words for those two are the
transformer protocol's (`fjs/bnf/matcher/types.ts` spells its `Transformer`
as `['sequence', …]`, `['variant', …]`, `['repeat', …]`), so a data rule and
the transformer that maps it carry the same word.

What this buys, against the alternatives that were weighed:

- **One discriminator.** `rule[0]` says what a rule is; no consumer probes a
  shape, and the visitor below is a switch on a string. Keeping the variant
  an untagged object would have saved four characters per variant at the cost
  of a second discrimination level (`instanceof Array`, then the tag), and
  keeping the sequence untagged is not possible at all without reserving
  `set` and `repeat` as rule names — a hidden rule, refused by validation
  rather than by the type, that a hand-written set would meet first.
- **Rule names are never at position zero**, so there are no reserved names:
  the lowering may name a rule `set` or `repeat` and the set stays
  unambiguous.
- **A hand-written set reads as the grammar.** `['sequence', 'digit', 'digits0']`
  and `['repeat', 0, Infinity, 'digit']` say what they do; the classical
  `0x000030_000039` needed a codec to read.

The JSON grammar's digits, lowered (the names are illustrative):

```js
{
    digit:   ['set', 0x30, 0x3A],
    digits0: ['repeat', 0, Infinity, 'digit'],
    digits:  ['sequence', 'digit', 'digits0'],
    uint:    ['variant', { 0: 'zero', onenine: 'onenine_digits0' }],
}
```

The form serializes as DJS. It is not JSON, because an unbounded `max` is
`Infinity`, which JSON cannot spell and DJS can; the front end already chose
`Infinity` over a sentinel and every reason it gives — comparisons just work,
a dropped argument cannot read as plausible — holds one layer down.
`fjs/rtti/data` made the same call for `bigint`.

**The DJS serializer does not spell `Infinity` yet.** `numberSerialize` in
`fjs/media/json/serializer`, which `fjs/djs/serializer` reuses for every
number, is `JSON.stringify`, and `JSON.stringify(Infinity)` is `null` — so a
set holding `['repeat', 0, Infinity, 'x']` is written as
`['repeat', 0, null, 'x']` today, and reads back as a bounded repeat whose
`max` compares as `0`: the plausible wrong value
[DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
forbids. The requirement is already owned:
[compile-modules-to-edag](../../../djs/todo/compile-modules-to-edag.md),
"Number parsing and serialization", makes DJS round-trip `Infinity`,
`-Infinity`, `NaN` and `-0`, with the JSON side kept separate under
[number-edge-cases](../../../media/json/todo/number-edge-cases.md). Nothing
in this module serializes, so the module does not wait on it; the first
grammar *persisted* with an unbounded repeat does, and until then a persisted
set is not to be trusted to carry one.

#### What differs from `bnf/data`

| | `bnf/data` | `ebnf/data` |
|---|---|---|
| terminal | a packed 24-bit pair, one range, decoded through a codec | `['set', …]`, a canonical range set, any number of runs, no codec |
| EOF | the stored code `0xFFFFFF`, decoded to `-1` | the set `[-1, 0]`, the only set with a negative boundary |
| repetition | a bare rule name, `0..Infinity` only, **derived** by recognizing a right-recursive variant | `['repeat', min, max, name]`, any bounds, **transcribed** from the front end |
| sequence, variant | a plain array, a plain object | the same, tagged |
| discrimination | by JavaScript type | by the tag at `rule[0]` |
| `detectRepeat`, `repeatItem` | recognition of the repeat shape, and the pruning of the rules it orphans | none; nothing is derived, so nothing is orphaned |
| string rules | expanded to terminals by `toData` | the same, one `['set', c, c + 1]` per code point |
| serialization | JSON | DJS (`Infinity`) |

The classical `toData` output is therefore **not** a valid EBNF rule set, and
[ebnf-migration](../../../todo/ebnf-migration.md)'s `data/` row is amended
to say so: a packed range has no reading here, and a bare-string repeat is
one kind's spelling in the other's position. A bridge from the classical set
to this one is mechanical — a packed range becomes `['set', a, b + 1]` after
decoding, a bare name `['repeat', 0, Infinity, name]`, an array
`['sequence', …]`, an object `['variant', …]` — and is `bnf/data`'s to add
under the `bnf → ebnf` direction rule if the cross-front-end comparison
proofs (ebnf-migration, principle 5) want a classical grammar run through
the EBNF backend. Nothing in `ebnf/` reads the classical form.

#### One discriminator: the visitor

The `Rule` dispatch lives in this module once, as [rule-visitor](../../../bnf/todo/rule-visitor.md)
asks, mirroring `visit` in `fjs/rtti/common`:

```ts
type RuleVisitor<R> = {
    readonly set:      (s: RangeSet) => R
    readonly sequence: (items: readonly string[]) => R
    readonly variant:  (branches: StringMap<string>) => R
    readonly repeat:   (min: number, max: number, item: string) => R
}

matchRule: <R>(v: RuleVisitor<R>) => (rule: Rule) => R
```

Each handler receives the payload without its tag. `emptyTagMap`, the
lowering's validation and the LL(1) dispatch builder all go through it; a
new rule kind is one new member, and `tsc` then names every consumer that
does not handle it. It is a discriminator, not a recursion scheme: each
caller keeps its own traversal, as the visitor issue specifies. There is no
`isRepeat` beside it.

#### Nullability

`emptyTagMap` is the classical fixpoint with one row changed:

| rule | nullable |
|---|---|
| `['set', …]` | never |
| `['sequence', …]` | iff every item is |
| `['variant', …]` | iff some branch is; the tag is that branch's |
| `['repeat', min, max, item]` | iff `min` is `0` or `item` is nullable; the tag is `true` |

A repetition is a sequence of items, not a choice, so its tag is `true` as
the classical one's is. The row is what makes `min` observable to a backend
before any input arrives: a `['repeat', 1, Infinity, …]` is not nullable, and
a sequence it leads is not either.

#### What the lowering refuses

The lowering is the first code that can tell a mistake from a grammar, so it
validates what the constructors do not, as ebnf-front-end's "What a lowering
must do" requires. A hand-written tuple is the one way an unvalidated value
reaches it, and each rule below names the input it refuses; an input it
cannot handle is refused, never answered with a plausible set
([DESIGN.md §10](../../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).

- **A set** is validated through `range_set`'s constructor, intersected with
  the domain `[0]` — which clips a generic complement's `-Infinity` and
  drops anything below `0` — and must then be non-empty with safe-integer
  boundaries. The empty set is refused as a terminal: it is a rule that can
  never match, a grammar error like a nullable body under an unbounded
  repeat. It is a legal *value* in the front end — `union()`'s identity,
  what `remove(a, a)` returns — and that is why the decision is here rather
  than in the constructor, as ebnf-range-set's **Amended** note says.
- **EOF** is the bare `-1` rule, and it alone lowers to `['set', -1, 0]`.
  No set the front end builds contains `-1` (`rangeEncode` refuses a negative
  endpoint), and the domain clip above turns a hand-written `['set', -1, 0]`
  thunk into the empty set, refused. In the data form a set is either exactly
  `[-1, 0]` or has a first boundary of `0` or more; a set mixing EOF with
  ordinary symbols is invalid, which is what keeps the terminal AST row
  unconditional ([ebnf-range-set](../../../bnf/todo/ebnf-range-set.md),
  "Why EOF is not a set member").
- **A bare number** is one symbol: `n` lowers to `['set', n, n + 1]`, the top
  ordinary symbol `Number.MAX_SAFE_INTEGER` to the open tail `['set', n]`
  ([top-symbol-open-tail](../../todo/top-symbol-open-tail.md)), and `-1` as
  above. Any other negative number, a fraction, or an unsafe integer is
  refused.
- **A string** is one `['set', c, c + 1]` per code point, in a `['sequence', …]`;
  `''` is the empty sequence. A malformed UTF-16 string is refused
  ([malformed-utf16-symbols](../../todo/malformed-utf16-symbols.md)).
- **Repeat bounds**: `min` a non-negative safe integer, `max` one or
  `Infinity`, `min <= max` ([repeat-bounds](../../todo/repeat-bounds.md) puts
  the same check in the constructor; the lowering keeps it for the
  hand-written tuple).
- **A nullable item under an unbounded `max`** is refused: a round that
  consumes nothing would repeat forever. That covers the degenerate
  `R = repeatFrom0(R)`, which the classical LL(1) backend admits as "matches
  empty"; the grammar ebnf-front-end wants and the classical fold could not
  say, `R = repeatFrom0(['(', R, ')'])`, has a non-nullable body and is
  accepted.
- **A nullable item under a bounded `max`** is accepted. This is the data
  layer's answer to ebnf-front-end's Problem 3: the repetition adds no
  decision of its own. A round is *forced* while fewer than `min` have
  matched and *optional* until `max`, and an optional round starts exactly
  when the lookahead is in the item's first set, the rule every round
  already follows. What can be ambiguous is the item — `{ a: [], b: [] }`
  derives empty two ways — and a backend resolves that where it resolves
  every variant, by the branch its nullability analysis selects. So
  `['repeat', 3, 3, []]` matches empty three times, `['repeat', 0, 1, []]`
  matches it zero times, and neither needs a rule here. A backend that
  cannot honour this reports it as its own limitation.
- **A name that names no rule** in a hand-written or deserialized set is
  refused by the same check, which every backend runs on entry rather than
  re-deriving.

#### The lowering: `toData`

```ts
toData: (rule: Rule) => readonly [RuleSet, entry: string, names: ReadonlyMap<Rule, string>]
```

- **Identity is the rule value the author holds.** A memo keyed by `===`
  makes a shared rule one named data rule, as `toDataAdd` does today. A
  thunk is registered under its name *before* its info is read, so a rule
  that names itself finds itself; its info is read once. A `['const', c]`
  thunk **is** the rule `c` spells — the thunk gets the name, `c` lowers as
  its body, and no extra rule is generated for the indirection.
- **Names** come from a thunk's `.name`, disambiguated by a counter, and are
  generated for everything else. As today, only the returned entry is part
  of the contract; a consumer matches by the entry, never by a name read off
  the set. Equal numbers share a name, so `'aa'` is a sequence naming one
  terminal twice, not two terminals.
- **`names`** maps every rule identity the lowering met to its name. That is
  the bridge the transformer protocol keys on through `Entry.rule` and the
  "rule identity must survive" requirement: transformers attach to the rule
  the author wrote, and the item of a repeat transformer is the `rule` of the
  `['repeat', min, max, rule]` info, whose name is `names.get(rule)`.
- **Nothing is derived and nothing is pruned.** Every rule emitted is
  reachable from the entry by construction, so the classical
  `detectRepeat` pass and the orphan pruning it needed do not exist here,
  and the classical failure mode — a transformer keyed on a rule the fold
  dropped — cannot arise. This dissolves ebnf-front-end's Problems 1 and 6:
  no bound is reduced to another, so no rule is synthesized that an author
  cannot name, and no thunk is created during conversion.

#### The AST

The data form fixes the AST the way the classical one does — one node per
rule invocation, `{ tag, sequence }`, and every backend builds it — with the
repeat row generalized:

| rule | node |
|---|---|
| `['set', …]` | one symbol leaf; EOF contributes no leaf |
| `['sequence', …]` | one child per item, in order |
| `['variant', …]` | the branch's own node, tagged by its key |
| `['repeat', min, max, item]` | **one flat node** of the items matched, whatever the bounds |

An option is a repeat, so its node holds zero or one item and there is no
`some`/`none` scaffolding; a `1..Infinity` repeat is one flat node, not an
item beside a list. That is the ebnf-front-end table with `BoundedArray`
rows — each bound shape is the same node with a different `.length` — and it
is what a lowering's tree is judged against. Every front-end form maps to
exactly one data kind, so the table is a function of the form as that issue
demands. Problem 8, how a *typed* AST (`fjs/ebnf/ast`) relates to these
nodes, is the mapping layer's (`ebnf/map/`), not this one's: the data layer
commits to the nodes.

#### Left for later

A separated repeat — a flat item list with the separators dropped, which
ebnf-front-end leaves open — has a natural spelling as a fifth element on
`'repeat'`, and this form leaves that position free. It is not designed here.

### Tasks

- [ ] `fjs/ebnf/data/types.ts`: `Rule`, `RuleSet`, `RuleVisitor`, `EmptyTag`,
      and the `toData` result type; `RangeSet` imported from
      `fjs/types/range_set`, not redeclared.
- [ ] `fjs/ebnf/data/module.f.mjs`: `matchRule`, `emptyTagMap`, the
      validation above (one function every backend calls on entry), and
      `toData` with the identity-to-name map. Nothing imports `fjs/bnf`.
- [ ] `proof.f.mjs` at 100%: every rule kind through `matchRule`; every
      nullability row, including the `min` row and a cyclic repeat; every
      refusal under the `throw` key; a shared rule lowered once; a thunk that
      names itself; a `const` thunk under its own name; the string cases
      (`''`, one code point, an astral code point, a repeated symbol); and
      the JSON grammar in [`../../lib/json`](../../lib/json/module.f.mjs)
      lowered whole, pinned as a `RuleSet` literal.
- [ ] Absorb [rule-visitor](../../../bnf/todo/rule-visitor.md) and
      [665-bnf-data-fold-children](../../../bnf/todo/665-bnf-data-fold-children.md)
      — the child fold is one immutable `reduce` in the new `toData` from the
      start — and move [042-mixing-serializable-bnfs](../../../bnf/todo/042-mixing-serializable-bnfs.md)
      here, as [ebnf-migration](../../../todo/ebnf-migration.md) assigns.
- [ ] Record what this issue settles in `fjs/ebnf/data/README.md` when the
      module ships, and delete this file.
- [ ] `tsc`, `fjs test`. The IR is new, so nothing breaks; the PR declares no
      breaking change.

### Related

- [ebnf-migration](../../../todo/ebnf-migration.md) — the plan; this is its
  `data/` piece, and its `data/` row is amended for the carrier chosen here.
- [ebnf-front-end](../../../bnf/todo/ebnf-front-end.md) — the front end this
  lowers; Problems 1 and 6 dissolve here, Problem 3 gets the data layer's
  answer, and Problem 8 passes to `ebnf/map/`.
- [ebnf-range-set](../../../bnf/todo/ebnf-range-set.md) — the terminal value
  and its contract, which the `['set', …]` row carries unchanged; its
  "Decide with the bounded repeat" is decided here.
- [rule-visitor](../../../bnf/todo/rule-visitor.md) — absorbed: `matchRule`
  above is that visitor over this carrier.
- [`../../../bnf/data/README.md`](../../../bnf/data/README.md) — the classical
  IR this replaces, and the `repeat` recognition it does not need.
- [`../../../bnf/README.md`](../../../bnf/README.md#the-ast-is-one-contract)
  — the AST contract the node table above keeps.
- [`../../../bnf/matcher/types.ts`](../../../bnf/matcher/types.ts) — the
  transformer protocol whose tag words the `sequence`, `variant` and `repeat`
  rows share, and whose `Entry.rule` the `names` map serves.
- [`../../../rtti/data/README.md`](../../../rtti/data/README.md) — the other
  serializable data form in the tree, and the precedent for serializing as
  DJS rather than JSON.
- [compile-modules-to-edag](../../../djs/todo/compile-modules-to-edag.md)
  — owns spelling `Infinity` in DJS, which persisting a set with an
  unbounded repeat needs; the serializer writes `null` for it today.
