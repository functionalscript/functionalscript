# The EBNF rule mapping

The `ebnf/map/` piece of [ebnf-migration](../../todo/ebnf-migration.md): a
rewrite of the AST a rule matches, keyed by the rules the author holds. It is
what makes a grammar *evaluate* rather than only match — the JSON grammar in
[`../lib/json`](../lib/json/module.f.mjs) can be mapped to JSON values — and it
is the layer that says how the typed AST of [`../ast`](../ast/types.ts)
relates to a value, which the data layer's README left to it.

- `module.f.mjs` — `rewrite`;
- `types.ts` — `Mapping`, `RuleMap`, `Mapped`, `Children`, `Checked`.

## What it does

A **mapping** is a rule and a function: `[rule, f]`. A **rule map** is a list
of them. `rewrite(rules)(rule)` is a function from `Ast<rule>` — the tree
matching `rule` produces, as `../ast/types.ts` types it — to the same tree
with every mapped rule's node replaced by what its function returns:

```js
const digit = range('09')
const digits = repeatFrom1(digit)

const value = rewrite([
    // one symbol → its value
    [digit, /** @type {(d: number) => number} */ (d => d - 0x30)],
    // its rounds → the number
    [digits, /** @type {(ds: readonly number[]) => number} */
        (ds => ds.reduce((n, d) => n * 10 + d, 0))],
])

value(digits)([0x31, 0x32])   // 12
```

The walk is bottom-up: a function receives the node's **children already
rewritten**, and its own rule is applied last. So `digits` above sees numbers,
not code points, and a mapping of a rule that names itself sees its own
outputs in the recursive positions. A rule with no mapping keeps its node,
children rewritten. The empty map is the identity on every form, which the
types pin as a law (`Mapped<R, readonly []>` is `Ast<R>`, row by row) and the
proof checks at runtime.

What a function receives, per form of the rule:

| rule | the function receives |
|---|---|
| `null`, EOF | `readonly []` — no leaf |
| `n`, a symbol | `n` |
| `'text'` | its code points, `readonly number[]` |
| `Tuple` | a tuple, one rewrite per element |
| `Variant` | `[tag, rewrite]` of the branch taken |
| `() => ['const', c]` | the rewrite of `c` — the thunk *is* the rule `c` spells, so `c`'s own mapping, where it has one, has already applied |
| `() => ['set', …]` | the symbol, a `number` |
| `() => ['repeat', min, max, r]` | a `BoundedArray<min, max, rewrite of r>`, one entry per round |

That is the `Ast<R>` table with a hole in every child position, and
`Children<R, M>` in `types.ts` is that table as a type.

## Keyed by the rule, as the types see it

A key is a rule the author held when the map was written, matched the way
the type system matches it, so that the runtime and the types agree by
construction: a number or a string by value, a tuple element by element, a
variant entry by entry — a `const` literal's type *is* its parts — and a
thunk by itself. Mapping `42` maps every `42`, mapping `['x', digit]` maps
every tuple of those two parts, and two tuples spelled alike in different
roles are one rule to the map, as they are one language; the role is the
parent's to read off the tag it receives.

A thunk is its own key because two thunks have no spelling the runtime
reads that the types read too. `range('09')` and `rangeEncode(48, 57)` yield
one set and are two types; `range('09')` twice yields one set and is one
type; two `value`s written alike are one spelling, found by comparing what
they yield until the same pair comes round again, and two types or one
depending on how they were annotated. So the walk **refuses** a rule that
spells like a key — the same parts, the same set by its boundaries, the
same self-naming — without being it, as a rule spelled twice: the types
cannot say whether the two are one, and neither mapping it nor leaving it
would be honest. A grammar spells a rule once and holds it, which is what
makes the refusal rare; two keys of one spelling are refused the same way.

A rule built inside a combinator and returned to nobody — the `[',', item]`
pair `join` makes — is mappable by spelling it again only where it holds
no thunk of its own; otherwise the parent sees it as it is, and a
combinator that wants its scaffolding mapped returns the mappings beside
the rule.

The lowering in [`../data`](../data/README.md) shares rules by `===` alone,
so two tuples of one spelling are two names there and one key here; a
backend that dispatches by name meets that difference, below.

## Typed: the map proves what a mapping declared

`Mapped<R, M>` is the type of the rewrite of `R` under the map `M`: the
output type of `R`'s mapping if `M` has one, else `Children<R, M>`. A key is
found by type equality — `Equal<K, R>` — which is the spelling, as the type
system sees it: a `const` literal's type is its spelling, and the front end
makes a set's so by carrying it as a phantom type parameter — `range('09')`
is `Set<readonly ['range', '09']>`, `range('az')` is not — so a repetition
over one is not a repetition over the other, and `digits` is not typed as
`word`. Without that every set would be the one type `Set`, and a map that
named `digits` would have typed every `repeatFrom1` of a set as a number.
Two keys of one type are refused by `Checked`, as two keys of one spelling
are by the rewrite; and where the types and the runtime could disagree on
whether two thunks are one rule, the runtime refuses, above.

A rule's type may not say its parts — `number`, `Tuple`, a bare `Set`,
`Rule`, or a tuple with one such element — as a rule annotated wider than
it is spelled, or a union of rules, arrives. `Mapped` takes a union member
by member, and types a rule whose type does not say its parts as its
children *or* what any key it could be returns: `Mapped<number, M>` with
`42` mapped to a string is `number | string`. That is sound and no more,
and it is what a parent mapping over such a rule has to accept. A key must
say its parts, since no rule could be found by a type that does not, so a
key annotated `Tuple`, `Thunk` or a bare `Set` is refused by `Checked`. A
rule that names itself is the case this bites: `value` in
[`../lib/json`](../lib/json/module.f.mjs) is annotated `Const<Variant>`,
which says nothing of its parts, so it cannot be a key until it has its
recursive type — Problem 7 of the front-end design, and the
widened-rule-signatures issue.

A mapping's function is written against a type the author declares —
`(d: number) => number` — because its true input depends on the whole map,
which is not built until every mapping is. `rewrite` takes the map as
`M & Checked<M>`, where `Checked` respells each mapping's parameter as
`Children<K, M>`: a declared input the actual children are not assignable to
is a compile error at the one place the map is whole. A declared input wider
than the children is accepted, `unknown` included, so nothing forces an
author to spell a type they do not need.

The declaration is a cost, and it is TypeScript's: a function in a tuple in
an argument gets no contextual type from a generic the argument itself
determines, so an unannotated `d => d - 0x30` is an implicit `any` error.
The JSDoc form is a cast on the arrow, `/** @type {(d: number) => number} */`.
The recursive case — a rule that names itself, whose mapping's input names
its own output — needs a type the author spells too, which is Problem 7 of
the front-end design and not new here.

`Ast<R>` is what `rewrite(rules)(rule)` takes, so a hand-written tree that
is not the rule's is refused by `tsc` where the rule's type is exact. For a
tree that arrives untyped, the walk refuses at runtime, naming the rule: a
node of the wrong arity, a variant tag the rule lacks or inherits, a symbol
outside its set, a string that is not the rule's, a repetition outside its
bounds, and anything under a rule that is no rule.

## What it is not

**Not a backend.** Nothing here matches input. A backend that builds `Ast<R>`
composes with `rewrite` directly; one that folds transformers into its parse
as the classical `ll1` does, building no tree, is a different engine over
the same map — the map's keys and functions are what it would consume, and
the children a function receives are specified here so that the two agree.
Whether the reference backend produces `Ast<R>` values or `{ tag, sequence }`
nodes with a conversion beside them is the backend's, and is what remains of
the front-end design's Problem 8.

**No metadata channel.** The classical protocol pairs every value with an `M`
and folds it through the tree. `Ast<R>` carries none, so neither does this.
Metadata is a backend concern until a consumer of this layer asks for it, and
the rewrite is written so that an `M` would be one more child position.

**No RTTI.** The classical `bnf/map/rtti` checks declared input types at
runtime because the classical `Rule` has no typed AST. `Ast<R>` and `Checked`
do that check in `tsc`, so there is nothing for a runtime type check to add
that the grammar's own types do not, and `rename-check-map` has nothing to
rename here.

## Left for later

- The data layer shares rules by `===` alone, so two tuples of one
  spelling are two names in a rule set and one key here, and a mapping over
  a string's code points is the string's here where the data layer names
  `'a'`'s symbol and a bare `97` as one rule. A backend keyed by data-rule
  names will meet both differences and is where they are settled.
- Which of `Ast<R>` values or a conversion from `{ tag, sequence }` nodes
  the backend owes — Problem 8's remainder, above.
