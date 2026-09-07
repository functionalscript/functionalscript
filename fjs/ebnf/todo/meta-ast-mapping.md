## meta-ast-mapping. A metadata channel, and a rewrite set the parser folds

**Priority:** P2
**Status:** open

### Problem

`parser` in [`../ll1`](../ll1/README.md) takes `readonly number[]` and builds
the `Ast<R>` of [`../ast/types.ts`](../ast/types.ts), whose leaves are the
symbols. Nothing pairs a symbol with what the grammar ignored about it —
where it came from, or, for a symbol that stands for a token, which token:
a tokenizer's `i` is every identifier, and `someCrazyVariable` has nowhere
to live. The requirement on the mapping is stronger than a position channel:
a mapping **must** receive that information with each input symbol, and
**must** be able to return information of its own.

**The goal is one transformation: fold a sequence into a symbol of another
alphabet.** The code points of a number into one `number` token; the tokens
of a statement into one node; so that the layer above parses something
compact. Nothing else is the mapping's job — not errors, not whether a
DataJS name resolves, not recovery. Those belong to the layer above, which
holds the whole compact stream. The mapping is the simplest thing that does
this one transformation; features are added later, with breaking changes if
need be, once the use cases are seen.

`rewrite` in [`../map`](../map/README.md) has a second problem. It is a
pass over a tree that has to exist whole, allocated before any mapping
runs; and its map has to be whole too, since `Checked<M>` types every
mapping's input from every other. So a map cannot be assembled from a
grammar's own mappings and a consumer's, a mapping cannot be written for
a rule before the rest of the set exists, and a recursive rule cannot be
a key at all
([widened-rule-signatures](../lib/todo/widened-rule-signatures.md)).

The two proposals of the `ll1/todo/metadata` issue this replaces —
indices beside the tree, or a leaf type parameter in place of `number` —
met neither: the first carried no payload, and the second lost the symbol
literal (`Ast<42>` is `42`; `_Number0` and `_Mono1` rest on it) and gave a
mapping no way to return anything. The classical stack's design for the
same requirement, `MI`/`MO` with `translate` and `reduce`
([generic-parser-metadata](../../bnf/todo/generic-parser-metadata.md),
[043-stateful-parser](../../bnf/todo/043-stateful-parser.md)), is what the
data structure below replaces for `ebnf/`: with the alphabet named in the
metadata, `translate` is not needed and `reduce` is each mapping's own
fold over its children. The two issues describe the
classical `bnf/` backend and stay as its record; each says so at its head,
and the migration table keeps them there rather than moving them here.

### The data structure

Three decisions, each forced by the one before.

**Metadata is what the grammar ignores, and it names its alphabet.**

```ts
export type Meta = { readonly id: string }
export type MetaSymbol<M extends Meta> = { readonly symbol: number, readonly meta: M }
```

`id` is the alphabet the symbol is drawn from — `'cp'` for code points, a
token alphabet's own name for tokens — and it is metadata because which
alphabet a number belongs to is exactly what a rule does not know. An `id`
is a literal per alphabet, so a union of two metadata types is a
discriminated union on it; `M` extends `Meta` with whatever else a layer
carries. Trivial metadata is one frozen `{ id }` shared by every leaf, so
a text parse with no positions allocates nothing per symbol but the leaf.

**A `MetaSymbol` is the only non-array in a tree.** `Ast<R>` uses arrays
for everything — a tuple, a repetition's rounds, a string's symbols, `[]`
for the empty cases, `[tag, node]` for a variant — and never an object.
So an object is a symbol, and `n instanceof Array` is the one test a
consumer ever needs. The variant stays `[tag, node]` for that reason:
objects are reserved. The tree stays data — proofs compare it
structurally, and it serializes as it is — which is why a thunk leaf
`() => …` was considered and rejected: it would have put every tree
through `force` before a comparison, and it reads as laziness where
nothing is deferred.

**A mapping returns a `MetaSymbol` and nothing else.** Its value goes in
`meta`, its kind in `symbol` — a symbol of the next grammar, or of this
one. That is what keeps a mapping's result, a JSON array say, from ever
colliding with a raw node; and it is what lets a symbol cross a layer
boundary as it is — no rename, no re-tagging — since the `id` already
says which alphabet it is. A layer's entry rule is mapped like any other
rule, and that mapping's result is the next layer's input; nothing
happens at a boundary that does not happen at every other node.

The AST of a rule, before or after rewriting, is then one type beside
`Ast<R>`:

```ts
// `Ast<R>` with three changes: a symbol is admitted at every row, the leaf
// rows are the symbol alone, and `M` is threaded. The helpers mirror
// `_AnyAst`, `_TupleAst` and `_VariantAst` in `../ast/types.ts`, for the
// reasons those exist: `Rule` is taken whole before it is taken apart, so
// the open variant does not expand forever (TS2589), and a tuple is mapped
// under a helper whose `R extends Tuple` lets `R[K]` be a `Rule` (TS2344).
export type MetaAst<M extends Meta, R extends Rule> =
    Equal<R, Rule> extends true ? _AnyMetaAst<M> :
    | MetaSymbol<M>                                           // any subtree may be a symbol
    | (
        R extends null    ? readonly [] :
        R extends number  ? never :                            // a leaf is only ever the symbol above
        R extends ''      ? readonly [] :
        R extends string  ? readonly MetaSymbol<M>[] :
        R extends Tuple   ? _TupleMetaAst<M, R> :
        R extends Variant ? _VariantMetaAst<M, R> :
        R extends Const<infer D> ? MetaAst<M, D> :
        R extends Set     ? never :
        R extends Repeat<infer Min, infer Max, infer D> ? BoundedArray<Min, Max, MetaAst<M, D>> :
        never
    )

type _AnyMetaAst<M extends Meta> =
    | MetaSymbol<M>
    | readonly _AnyMetaAst<M>[]
    | readonly [string, _AnyMetaAst<M>]

type _TupleMetaAst<M extends Meta, R extends Tuple> =
    { readonly [K in keyof R]: MetaAst<M, R[K]> }

type _VariantMetaAst<M extends Meta, R extends Variant> =
    string extends keyof R ? readonly [string, _AnyMetaAst<M>] :
    { readonly [K in keyof R]: readonly [_ToString<K>, MetaAst<M, R[K]>] }[keyof R]
```

The parser's tree is `MetaAst<MI, R>`; a mapping of `R` under a set whose
results carry `MO` is

```ts
(ast: MetaAst<MI | MO, R>) => MetaSymbol<MO>
```

and `MetaAst<MI | never, R>` is `MetaAst<MI, R>`, so the parser's tree
and the tree rewritten by the empty set are one type by definition
rather than by assertion. `MetaAst` is kept
separate from `Ast<R>` for now: `Ast<R>` keeps the symbol literal, which
`MetaAst` cannot under `MI | MO` (a mapped leaf carries another symbol),
and `rewrite` keeps taking it. Whether `Ast<R>` is retired once the fold
below exists is decided then.

**The property everything rests on.** A value a mapping sees is one of
two things, told apart by one test. Not an array: a `MetaSymbol`, and
`meta.id` says which alphabet. An array: built by the machine from the
rule at that position, so its top-level shape is the rule's by
construction — arity, tag among the variant's keys, rounds within bounds
— and each element is again one of the two, under the child rule. With
monotonicity, `A extends B ⇒ MetaAst<M, A> extends MetaAst<M, B>`, a
mapping written against a wider rule type is sound for the concrete
rule's tree, only less informed; so a mapping may be reused across
rewrite sets, which change which positions are symbols and never what
the arrays look like. A mapping therefore needs no shape asserts, only
`meta.id` where it expects a symbol, and `MetaAst<MI | MO, R>` is exact:
it states what can be known statically, and the one test recovers the
rest.

### The rewrite set, and the parser that folds it

A **rewrite set** is a list of mappings, each keyed by the rule the
author holds:

```js
const a = option(set('abc'))                 // the grammar, defined first
rule(a, ast => f(ast))                       // a mapping, bound later
```

`rule(a, f)` is a constructor for the pair, and it comes from a factory
bound once per layer to the layer's metadata types:

```js
/** @type {Mappings<Cp, Tok>} */
const { rule } = mappings()
```

`a` carries only its rule type and says nothing of `MI` or `MO`, so they
are bound where a layer begins and read from there; with them bound, a
call types `f`'s parameter as `MetaAst<MI | MO, typeof a>` from `a`, where
a function inside a tuple literal gets no contextual type at all — which
is why every mapping in `../map` today carries a `/** @type {…} */` cast.
The exact spelling of the factory is the implementation's; what the
design fixes is that the metadata types are bound once, not per mapping
and not inferred from a rule. The set is an array, so it
is assembled across modules — a grammar's mappings for its own
scaffolding beside a consumer's — and nothing in its type depends on the
whole. Keys are rule values, so the rules a consumer maps have to be
reachable: `value`, `array` and `object` in
[`../lib/json`](../lib/json/module.f.mjs) currently are not.

**The parser takes the set and folds it.** The `ll1` machine builds
bottom-up, and a node comes into existence at five `'ok'` sites — in
`enter`, a set's leaf and the empty sequence, which returns `['ok', [], pos]`
without a frame (the empty string lowers to one, so it is this site too);
and in `resume`, the end of a sequence, the variant wrap, and `round`
closing a repetition. On-the-fly rewriting is one function at those sites:

```js
const emit = (name, node) => {
    const f = mappers.get(name)
    return f === undefined ? node : f(node)
}
```

Frames hand `emit`'s result up instead of the node, so `done` and
`rounds` hold mapped values and the only structure that ever exists is
the unmapped region between a mapping and the mappings below it. The
frames need one field they lack — their own rule name — and that is the
whole change to the machine. Keying is by name through the `RuleNameMap`
`toData` returns: `parser(rule, set)` translates each `[a, f]` to
`[names.get(a), f]` at build time and refuses, before any input, where the
machine refuses everything else: a rule the grammar does not hold, and a
rule mapped twice. The second matters because the set is assembled from
several sources; a `Map` built naively would let the later entry win, and
the output would depend on assembly order. `rewrite` refuses the same
("a rule mapped twice").

**A mapping reports no errors and does not throw in normal control
flow.** It is a transformation from one alphabet to another, and anything
that can fail belongs to the layer above. FunctionalScript has no
`try`/`catch`, so a `throw` in a mapping is a panic for a broken invariant,
as [`fjs/AGENTS.md`](../../AGENTS.md) §1.5 says, and nothing else.

Three differences from `rewrite`, all to keep:

- **Identity, not spelling.** The `RuleNameMap` is keyed by `===`, so a
  tuple spelled twice is two names and only the held instance is mapped;
  `rewrite` matches by spelling and refuses the look-alike. The map
  README named this as a difference "a backend keyed by data-rule names
  will meet". The fold's answer is the simpler one: map the rule you
  hold.
- **A string's symbol and a bare number are one rule** in the data
  layer, so mapping `97` maps the code point inside `'a'` too, where
  `rewrite` treats a string's symbols as the string's own. Documented,
  not fought: a grammar that wants them apart spells the string as a
  set.
- **A `const` thunk and its payload are one rule.** `toData` lowers the
  payload under the thunk's own name and does not name the payload for
  it, so the key is the thunk. A payload held nowhere else has no name,
  and offered as a key is refused as a rule the grammar does not hold; a
  payload also reached directly elsewhere has its own name there, and a
  mapping keyed by it applies to that occurrence and not to the one under
  the thunk — the first bullet again. `rewrite` maps the payload first
  and the thunk after, as two rules; the map README already reads the
  thunk as "the rule its payload spells", and the fold takes that
  literally.

The shape asserts of the `rewrite` pass — `fixed`, `contains`,
`structurallySame` — do not exist in the fold. The machine built the
node from the rule, so its shape is right by construction; the asserts
are the mappings' own, on `meta.id`, for now.

### Later

Each of these can be added later, with a breaking change if need be,
and so is not part of the design:

- **A repetition mapped as a fold** — `init`/`update`/`end` over the
  rounds as they arrive — so a top-level `repeat(statement)` holds one
  result at a time rather than one per statement until it closes.
- **An RTTI precheck** of what each mapping receives, computed per name
  over the finite `RuleSet` from the mappings' declared types, possible
  because the tree has no functions in it; a mismatch of alphabets would
  then be refused at build.
- **A boundary helper** that checks a result is a list of one alphabet's
  symbols, should mapping the entry rule prove not to be enough.

### Decided separately

- **EOF** stays synthesized by the parser, its node `[]`; whether the
  caller sends it as a symbol with its own metadata
  ([eof-as-ordinary-symbol](../../bnf/todo/eof-as-ordinary-symbol.md))
  is its own issue.
- **One `M` per tree**, `MI | MO`, discriminated by `id` — so **an `id`
  names one metadata type**. Two shapes under one `id` would be one
  alphabet with nothing to tell them apart, since `id` is the only
  discriminator; a layer whose input alphabet carries several kinds of
  metadata makes that one type, discriminated by a field of its own. A
  mapping that emits into its input alphabet therefore emits `MI`, the
  union collapses there, and the position is typed as what it holds.

### Tasks

- [ ] `Meta`, `MetaSymbol`, `MetaAst<M, R>` in `ast/types.ts` beside
      `Ast<R>`, with the row assertions and the monotonicity law.
- [ ] `ll1`: input `readonly MetaSymbol<MI>[]`, `symbolAt` and the input
      guard reading `.symbol`, the argument renamed away from `input`;
      frames carry their rule name; `parser(rule, set)` folding at the
      five sites; a mapping whose rule the grammar does not hold, or a
      rule mapped twice, refused at build.
- [ ] The per-layer factory binding `MI` and `MO`; `rule(a, f)`,
      `Mapping`, `RewriteSet` types, with `f` contextually typed from
      `a` under them.
- [ ] Proofs: the empty set is the identity; `parser(r, set)` agrees with
      parse-then-`rewrite` — `rewrite(set)(r)` applied to `parser(r)`'s
      tree — where the three keyings agree; a two-layer
      example — a tokenizer emitting `{ id: 'tok', … }` symbols with a
      payload, parsed by a
      grammar over `'tok'` whose mapping reads the
      payload.
- [ ] Amend `ll1/README.md` ("Left for later") and `map/README.md` ("No
      metadata channel", "What it is not", "Left for later").
- [ ] File the follow-ups that turn out to be wanted, from "Later".

### Related

- [`../ll1/README.md`](../ll1/README.md) — the machine, and its "Left
  for later".
- [`../map/README.md`](../map/README.md) — "No metadata channel", and
  the two keying differences it left to a name-keyed backend.
- [`../ast/types.ts`](../ast/types.ts) — `Ast<R>`, and the monotonicity
  law `MetaAst` inherits.
- [`../data/module.f.mjs`](../data/module.f.mjs) — `toData` and the
  `RuleNameMap` the fold keys by.
- [tokens-with-extra-information](../../bnf/todo/tokens-with-extra-information.md)
  — the identifier example, as first filed.
- [layered-parser](../../bnf/todo/layered-parser.md) — the pipeline the
  `id` wires.
- [widened-rule-signatures](../lib/todo/widened-rule-signatures.md) —
  why `value` cannot be a key today, and the reachability the set
  needs.
- [ebnf-migration](../../todo/ebnf-migration.md) — the stage this is.
- [`../../rtti/data/module.f.mjs`](../../rtti/data/module.f.mjs) —
  `subset`, for the precheck.
