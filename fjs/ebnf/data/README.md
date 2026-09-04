# The serializable EBNF grammar

The `ebnf/data/` piece of [ebnf-migration](../../todo/ebnf-migration.md): the
intermediate representation (IR) the EBNF backends consume, and the lowering
from the front end in [`../module.f.mjs`](../module.f.mjs) into it. It settles
the carrier question the ebnf-front-end issue (Problem 1) and the
ebnf-range-set issue ("Decide with the bounded repeat") both deferred to this
layer, and it absorbs the rule-visitor issue as `matchRule`. Those issues live
under `fjs/bnf/todo/` today and are not linked from here: `ebnf/` never
reaches into `bnf/`, a README link included, because the migration deletes
`bnf/` at its last stage
([ebnf-migration](../../todo/ebnf-migration.md), principle 2).

- `module.f.mjs` — `matchRule`, `emptyTagMap`, `validate`, `toData`;
- `types.ts` — the `Rule` union, `RuleSet`, `RuleVisitor`, `GrammarData`.

## Why not the classical form

The classical IR in `fjs/bnf/data` is four rule kinds told apart by
JavaScript type alone: a number is a terminal range, an
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
edited, and the carrier was chosen once, for both. What did not change is the
contract on top of it — every rule of a set has a name, the AST is one node
per rule invocation, and a repetition is one flat node whatever its bounds
("The AST is one contract" in the classical `fjs/bnf/README.md`).

## The form

A rule set is a map from name to rule, exactly as today. **Every rule is a
tagged tuple whose first element names its kind**, and a string anywhere
else in a rule is the name of another rule of the same set:

```ts
type RuleSet  = AbstractRequiredMap<string, Rule>

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
  keeping the sequence untagged would need a probe of the element type — a
  number in second position tells a tagged tuple from a sequence of names —
  written beside the tag rather than instead of it.
- **Rule names are never at position zero**, so there are no reserved names:
  the lowering may name a rule `set` or `repeat` and the set stays
  unambiguous.
- **A hand-written set reads as the grammar.** `['sequence', 'digit', 'digits0']`
  and `['repeat', 0, Infinity, 'digit']` say what they do; the classical
  `0x000030_000039` needed a codec to read.

An integer with an optional minus, hand-written:

```js
{
    digit:   ['set', 0x30, 0x3A],
    digits0: ['repeat', 0, Infinity, 'digit'],
    digits:  ['sequence', 'digit', 'digits0'],
    zero:    ['set', 0x30, 0x31],
    uint:    ['variant', { zero: 'zero', digits: 'digits' }],
    none:    ['sequence'],
    minus:   ['set', 0x2D, 0x2E],
    sign:    ['variant', { none: 'none', minus: 'minus' }],
    int:     ['sequence', 'sign', 'uint'],
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
[DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
forbids. The requirement is already owned:
[compile-modules-to-edag](../../djs/todo/compile-modules-to-edag.md),
"Number parsing and serialization", makes DJS round-trip `Infinity`,
`-Infinity`, `NaN` and `-0`, with the JSON side kept separate under
[number-edge-cases](../../media/json/todo/number-edge-cases.md). Nothing in
this module serializes, so the module does not wait on it; the first grammar
*persisted* with an unbounded repeat does, and until then a persisted set is
not to be trusted to carry one.

## What differs from `bnf/data`

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
[ebnf-migration](../../todo/ebnf-migration.md)'s `data/` row says so: a packed
range has no reading here, and a bare-string repeat is one kind's spelling in
the other's position. A bridge from the classical set to this one is
mechanical — a packed range becomes `['set', a, b + 1]` after decoding, a
bare name `['repeat', 0, Infinity, name]`, an array `['sequence', …]`, an
object `['variant', …]` — and is `bnf/data`'s to add under the `bnf → ebnf`
direction rule if the cross-front-end comparison proofs (ebnf-migration,
principle 5) want a classical grammar run through the EBNF backend. Nothing
in `ebnf/` reads the classical form.

## One discriminator: the visitor

The `Rule` dispatch lives in this module once, as the rule-visitor issue
asked, mirroring `visit` in `fjs/rtti/common`:

```ts
type RuleVisitor<R> = {
    readonly set:      (s: RangeSet) => R
    readonly sequence: (items: readonly string[]) => R
    readonly variant:  (branches: StringMap<string>) => R
    readonly repeat:   (min: number, max: number, item: string) => R
}

matchRule: <R>(v: RuleVisitor<R>) => (rule: Rule) => R
```

Each handler receives the payload without its tag. `emptyTagMap`,
`validate` and every backend's dispatch go through it; a new rule kind is one
new member, and `tsc` then names every consumer that does not handle it. It
is a discriminator, not a recursion scheme: each caller keeps its own
traversal, as the visitor issue specified. There is no `isRepeat` beside it.

## Nullability

`emptyTagMap` is the classical fixpoint with one row changed:

| rule | nullable |
|---|---|
| `['set', …]` | never |
| `['sequence', …]` | iff every item is |
| `['variant', …]` | iff some branch is; the tag is the last such branch's, the one a dispatch miss selects |
| `['repeat', min, max, item]` | iff `min` is `0` or `item` is nullable; the tag is `true` |

A repetition is a sequence of items, not a choice, so its tag is `true` as
the classical one's is. The row is what makes `min` observable to a backend
before any input arrives: a `['repeat', 1, Infinity, …]` is not nullable, and
a sequence it leads is not either.

## What `validate` refuses

A rule set is data with an author, so a mistake in it is refused rather than
read as a grammar, naming the rule
([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
`toData` runs the same check on what it lowered, and a backend runs it on
entry rather than re-deriving any of it.

- **A name that names no rule** — in a sequence, a variant, a repeat, or as
  the entry.
- **A set** that is not a canonical range set, is empty, has a boundary that
  is not a safe integer, or mixes EOF with ordinary symbols. The empty set is
  refused as a terminal because it is a rule that can never match, a grammar
  error like a nullable body under an unbounded repeat. It is a legal *value*
  in the front end — `union()`'s identity, what `remove(a, a)` returns — and
  that is why the decision is here rather than in the constructor, as
  ebnf-range-set's **Amended** note says. In the data form a set is either
  exactly `[-1, 0]` or has a first boundary of `0` or more; a set mixing EOF
  with ordinary symbols is invalid, which is what keeps the terminal AST row
  unconditional (ebnf-range-set, "Why EOF is not a set member"). `b + 1` is exact for safe integers only, so a
  boundary above them would name a different range than the one written.
- **Repeat bounds**: `min` a non-negative safe integer, `max` a non-negative
  safe integer or `Infinity`, `min <= max`
  ([repeat-bounds](../todo/repeat-bounds.md) puts the same check in the
  constructor; the data form keeps it for the hand-written tuple).
- **A nullable item under an unbounded `max`**: a round that consumes nothing
  would repeat forever. That covers the degenerate `R = repeatFrom0(R)`, which
  the classical LL(1) backend admits as "matches empty"; the grammar
  ebnf-front-end wants and the classical fold could not say,
  `R = repeatFrom0(['(', R, ')'])`, has a non-nullable body and is accepted.

**A nullable item under a bounded `max` is accepted.** This is the data
layer's answer to ebnf-front-end's Problem 3: the repetition adds no decision
of its own. A round is *forced* while fewer than `min` have matched and
*optional* until `max`, and an optional round starts exactly when the
lookahead is in the item's first set, the rule every round already follows.
What can be ambiguous is the item — `{ a: [], b: [] }` derives empty two
ways — and a backend resolves that where it resolves every variant, by the
branch its nullability analysis selects. So `['repeat', 3, 3, []]` matches
empty three times, `['repeat', 0, 1, []]` matches it zero times, and neither
needs a rule here. A backend that cannot honour this reports it as its own
limitation.

Not this layer's: left recursion and first/first conflicts are a backend's to
report, since a general grammar may have both and another backend may accept
them; a rule the entry cannot reach is dead, not wrong.

## The lowering: `toData`

```ts
toData: (rule: Rule) => readonly [RuleSet, entry: string, names: ReadonlyMap<Rule, string>]
```

The lowering is a transcription, and the first code that can tell a mistake
from a grammar, so it validates what the constructors do not — a hand-written
tuple is the one way an unvalidated value reaches it:

| front end | data |
|---|---|
| `null`, EOF | `['set', -1, 0]`, the one set with a negative boundary |
| `n`, a symbol | `['set', n, n + 1]`; the top ordinary symbol `Number.MAX_SAFE_INTEGER` is the open tail `['set', n]` ([top-symbol-open-tail](../todo/top-symbol-open-tail.md)); any negative number — `-1` included, since EOF is `null` and not a number — a fraction, or an unsafe integer is refused |
| `'text'` | a `['sequence', …]` of one `['set', c, c + 1]` per code point; `''` is the empty sequence; malformed UTF-16 is refused ([malformed-utf16-symbols](../todo/malformed-utf16-symbols.md)) |
| `Tuple` | a `['sequence', …]` of the elements' names |
| `Variant` | a `['variant', …]` of the branches' names |
| `() => ['const', c]` | `c`, lowered under the thunk's name — the thunk **is** the rule `c` spells, and no rule is generated for the indirection |
| `() => ['set', …s]` | `['set', …]`: validated through `range_set`'s constructor, then intersected with the domain `[0]`, which clips a generic complement's `-Infinity` and drops anything below `0`. No set the front end builds contains `-1`, and the clip turns a hand-written `['set', -1, 0]` thunk into the empty set, refused |
| `() => ['repeat', min, max, r]` | `['repeat', min, max, name]` |

- **Identity is the rule value the author holds.** A memo keyed by `===`
  makes a shared rule one named data rule: a thunk, an array or an object
  met twice is one rule, and a number or a string met twice is one rule by
  value, so `'aa'` is a sequence naming one terminal twice. A thunk is
  registered under its name *before* its info is read, so a rule that names
  itself finds itself; its info is read once. A value built inside a thunk's
  body — the variant `value` in [`../lib/json`](../lib/json/module.f.mjs)
  returns — is fresh per call and has no identity an author holds, so an
  author attaches to the thunk, which the map names.
- **Names** come from a thunk's `.name` where it has one, and otherwise from
  the rule it was reached from and the position it was reached at — a
  branch's tag, an element's index, `item` under a repeat — as `value.array`
  or `json.0`, with a counter where a name is taken. The path is what an
  error naming the rule points at, so it is kept whole even where a shared
  rule is first reached deep inside another. As today, only the returned
  entry is part of the contract; a consumer matches by the entry, and reads
  any other rule through `names`, never by a name read off the set.
- **`names`** maps every rule identity the lowering met to its name. That is
  the bridge the transformer protocol keys on through `Entry.rule` and the
  "rule identity must survive" requirement: transformers attach to the rule
  the author wrote, and the item of a repeat transformer is the `rule` of
  the `['repeat', min, max, rule]` info, whose name is `names.get(rule)`.
- **Nothing is derived and nothing is pruned.** Every rule emitted is
  reachable from the entry by construction, so the classical `detectRepeat`
  pass and the orphan pruning it needed do not exist here, and the classical
  failure mode — a transformer keyed on a rule the fold dropped — cannot
  arise. This dissolves ebnf-front-end's Problems 1 and 6: no bound is
  reduced to another, so no rule is synthesized that an author cannot name,
  and no thunk is created during conversion.

## The AST

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
is what a backend's tree is judged against. Every front-end form maps to
exactly one data kind, so the table is a function of the form as that issue
demands. Problem 8, how a *typed* AST (`fjs/ebnf/ast`) relates to these
nodes, is the mapping layer's (`ebnf/map/`), not this one's: the data layer
commits to the nodes.

What a backend owes a bounded repeat: start another round exactly while the
lookahead is in the item's first set and fewer than `max` have matched; on
leaving the loop, succeed iff at least `min` did; build one flat node.

## Left for later

A separated repeat — a flat item list with the separators dropped, which
ebnf-front-end leaves open — has a natural spelling as a fifth element on
`'repeat'`, and this form leaves that position free. It is not designed here.
