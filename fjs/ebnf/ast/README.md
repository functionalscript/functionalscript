# The EBNF AST

The `ebnf/ast/` piece of [ebnf-migration](../../todo/ebnf-migration.md): the
typed tree a backend builds for a rule, with a metadata channel. It is what
[`../ll1`](../ll1/README.md) builds and what its rewrite set is written
against; the data layer's README committed to the nodes, and this is their
type.

- `types.ts` — `Meta`, `Ast`, `Children`.

## What it is

`Ast<R, I, O>` is the type of what matching the rule `R` produces when every
input symbol carries the metadata `I` and a mapping may replace a subtree
with a symbol carrying `O`. One row per form of the front end's rule union:

| rule | node |
|---|---|
| `null`, EOF | `readonly []` — no source element, so no leaf |
| `n`, a symbol | `Meta<I, n>` — the input symbol, literal kept |
| `'text'` | its symbols, `readonly Ast<number, I, O>[]`; `''` is `readonly []` |
| `Tuple` | a tuple, one node per element |
| `Variant` | `[tag, node]` of the branch taken; an empty variant is `never` |
| `() => ['const', c]` | the node of `c` — the thunk *is* the rule `c` spells |
| `() => ['set', …]` | `Meta<I>` — one symbol |
| `() => ['repeat', min, max, r]` | a `BoundedArray<min, max, Ast<r, I, O>>`, one flat array whatever the bounds |

and `Meta<O>` admitted at every row, since any subtree may be the result of
a mapping. `Children<R, I, O>` is the same table without that admission at
its top: what a mapping of `R` receives, the rules under it already mapped
and `R`'s own mapping not yet applied. A rule is mapped at most once, so the
top of what its mapping sees is always the node the machine built; every
position under it is an `Ast`, since any child may be mapped.
`Ast<R, I, O>` is `Meta<O> | Children<R, I, O>`, and both are monotone in
the rule: `A extends B` implies `Ast<A> extends Ast<B>`, which `_Mono` in
`types.ts` pins. EOF being `null` rather than `-1` is what keeps `number`
inside the law.

`O` defaults to `never`, and `Meta<never>` is `never`, so `Ast<R, I>` — no
rule mapped — is the parser's own tree with no row left over for a result
that cannot exist. The empty rewrite set is the identity by definition
rather than by assertion. It took making `Meta<never>` be `never`: an object
type with a `never` field is uninhabited but is not itself `never`, so the
row would otherwise survive at every position.

## The data structure

Three decisions, each forced by the one before.

**Metadata is what the grammar ignores, and it names its alphabet.** A
`Meta<M, S>` is `{ symbol: S, meta: M }`: the symbol, and what the grammar
ignored about it — where it came from, or, for a symbol that stands for a
token, which token. A tokenizer's `i` is every identifier, and
`someCrazyVariable` has to live somewhere. By convention `M` carries an
`id` naming the alphabet the symbol is drawn from — `'cp'` for code points,
a token alphabet's own name for tokens — because which alphabet a number
belongs to is exactly what a rule does not know, and because a position a
mapping reads is typed `Meta<I> | Meta<O>` and the `id` is what tells the
two apart at runtime. An `id` names one metadata type: two shapes under one
`id` would be one alphabet with nothing to tell them apart, so a layer whose
input carries several kinds of metadata makes that one type, discriminated
by a field of its own. Trivial metadata is one frozen `{ id }` shared by
every leaf, so a text parse with no positions allocates nothing per symbol —
the leaf *is* the input element. The convention is not a constraint on the
type: nothing in the library reads `id` yet, and the constraint comes with
the first reader, the precheck in
[mapping-precheck](../ll1/todo/mapping-precheck.md).

**A `Meta` is the only non-array in a tree.** The tree uses arrays for
everything else — a tuple, a repetition's rounds, a string's symbols, `[]`
for the empty cases, `[tag, node]` for a variant — and never an object. So
an object is a symbol, and `n instanceof Array` is the one test a consumer
ever needs. The variant stays `[tag, node]` for that reason: objects are
reserved. The tree stays data — proofs compare it structurally, and it
serializes as it is — which is why a thunk leaf `() => …` was considered
and rejected: it would have put every tree through `force` before a
comparison, and it reads as laziness where nothing is deferred.

**A mapping returns a `Meta` and nothing else.** Its value goes in `meta`,
its kind in `symbol` — a symbol of the next grammar, or of this one. That
is what keeps a mapping's result, a JSON array say, from ever colliding with
a raw node; and it is what lets a symbol cross a layer boundary as it is —
no rename, no re-tagging — since the `id` already says which alphabet it
is. A layer's entry rule is mapped like any other rule, and nothing happens
at a boundary that does not happen at every other node.

The metadata is two parameters, `I` and `O`, rather than one `M` that is
their union. That is what recovers the symbol literal a union would give
up: the leaf row is `Meta<I, R>` for a rule `R` that is a number literal, so
`Ast<42, I, O>` still knows the `42`, and only a *mapped* position widens to
`Meta<O>`.

## A rule that names itself

A grammar names itself through a thunk — JSON's `value` yields a variant
whose `array` branch holds `value` again — and its type names itself the
same way, `() => readonly ['const', Value<…, JsonValue>]` in
[`../lib/json/types.ts`](../lib/json/types.ts), which TypeScript admits
because the reference sits inside a function type. `Ast` of such a rule is
infinite, and it stays finite to the checker because the variant row is
built through an alias, `_Branch`, whose whole body is the tagged tuple:
TypeScript defers a tuple that is an alias's body and expands one written
into a mapped type's template as it builds the property, so the branch's
node is expanded when it is read and not when the variant is. That is the
one place a recursive rule passes through on its way back to itself in
every grammar this module has, since a rule recurses through a choice; a
rule that named itself through tuples alone would still expand without
end, and is not a shape any grammar here spells.

## The property everything rests on

A value a mapping sees is one of two things, told apart by one test. Not an
array: a `Meta`, and `meta.id` says which alphabet. An array: built by the
machine from the rule at that position, so its top-level shape is the
rule's by construction — arity, tag among the variant's keys, rounds within
bounds — and each element is again one of the two, under the child rule.
With monotonicity, a mapping written against a wider rule type is sound for
the concrete rule's tree, only less informed; so a mapping may be reused
across rewrite sets, which change which positions are symbols and never
what the arrays look like. A mapping therefore needs no shape asserts, only
`meta.id` where it expects a symbol and `instanceof Array` where it knows a
position is unmapped — the scaffolding a combinator builds and hands to
nobody. `Children<R, I, O>` is exact: it states what can be known
statically, and the one test recovers the rest.

## Decided separately

- **EOF** stays synthesized by the parser, its node `[]`; whether the
  caller sends it as a symbol with its own metadata is
  [eof-as-ordinary-symbol](../../bnf/todo/eof-as-ordinary-symbol.md).
- The classical stack's design for the same requirement — `MI`/`MO` with
  `translate` and `reduce`
  ([generic-parser-metadata](../../bnf/todo/generic-parser-metadata.md),
  [043-stateful-parser](../../bnf/todo/043-stateful-parser.md)) — is what
  this replaces for `ebnf/`: with the alphabet named in the metadata,
  `translate` is not needed and `reduce` is each mapping's own fold over its
  children. The two issues describe the classical `bnf/` backend and stay
  as its record.

## Related

- [`../ll1/README.md`](../ll1/README.md) — the machine that builds the
  tree and folds the rewrite set through it.
- [`../data/README.md`](../data/README.md) — the nodes a backend owes each
  data rule kind, which these rows type.
- [tokens-with-extra-information](../../bnf/todo/tokens-with-extra-information.md)
  — the identifier example, as first filed.
- [layered-parser](../../bnf/todo/layered-parser.md) — the pipeline the
  `id` wires.
