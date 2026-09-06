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
metadata, `translate` is not needed, `reduce` is each mapping's own fold
over its children, and the identity `empty` that those issues left open
becomes a value the machine has, below. The two issues describe the
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
says which alphabet it is. What does not cross for free is the *list*:
see "The boundary" below.

The AST of a rule, before or after rewriting, is then one type beside
`Ast<R>`:

```ts
export type MetaAst<M extends Meta, R extends Rule> =
    | MetaSymbol<M>                                           // any subtree may be a symbol
    | (
        R extends null    ? readonly [] :
        R extends number  ? never :                            // a leaf is only ever the symbol above
        R extends ''      ? readonly [] :
        R extends string  ? readonly MetaSymbol<M>[] :
        R extends Tuple   ? { readonly [K in keyof R]: MetaAst<M, R[K]> } :
        R extends Variant ? /* [tag, MetaAst<M, branch>], as Ast<R> */ never :
        R extends Const<infer D> ? MetaAst<M, D> :
        R extends Set     ? never :
        R extends Repeat<infer Min, infer Max, infer D> ? BoundedArray<Min, Max, MetaAst<M, D>> :
        never
    )
```

The parser's tree is `MetaAst<MI, R>`; a mapping of `R` under a set whose
results carry `MO` is

```ts
(ast: MetaAst<MI | MO, R>, ahead: MetaSymbol<MI> | undefined) => Result<MetaSymbol<MO>, E>
```

and `MetaAst<MI | never, R>` is `MetaAst<MI, R>`, so the parser's tree
and the tree rewritten by the empty set are one type by definition
rather than by assertion. `ahead` is the lookahead — the input symbol at
the position the match ended, `undefined` at the end of input — and it
is what an empty match has instead of a leaf, below. `MetaAst` is kept
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
const emit = (name, node, pos) => {
    const f = mappers.get(name)
    return f === undefined ? node : f(node, aheadAt(pos))
}
```

**An empty match has no leaf to read a position from.** A mapped empty
tuple, zero-round repetition, or EOF receives `[]` and nothing else, so
"expected `x` at line N" for a missing optional could not say N. That is
why the machine hands every mapping the lookahead as `ahead`: the
`MetaSymbol<MI>` at the position the match ended, which gives an empty
match the metadata of the symbol it stopped in front of — a zero-width
span there — and gives a non-empty one the symbol after it, for free. This
is where the classical `empty` went: not an identity the algebra must
supply, but a value the machine has at every `emit`. The end of input is
the one position with no such symbol, so `ahead` is `undefined` there;
closing that is the EOF issue's gap, below.

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

**A mapping's failure is a value, never a throw.** FunctionalScript has
no `try`/`catch`, so nothing in `ll1/module.f.mjs` could intercept a
throw; a `throw` in a mapping is a panic for a broken invariant, as
[`fjs/AGENTS.md`](../../AGENTS.md) §1.5 says, and never control flow. So
a mapping returns `Result<MetaSymbol<MO>, E>`, and `emit` folds an
`['error', e]` into the machine's own `'error'` step, which already stops
the match at the first failure since LL(1) never backtracks. The parser's
result type gains the case: its error is the position, or the position
with the mapping's `e` beside it. That is how a mapping's error carries
a position without the mapping being told one — as a value the machine
pairs, not an exception it catches. A mapping that wants the parse to
*continue* past a semantic error has the other value-shaped option with
no machine support at all: emit a symbol of an error alphabet,
`{ id: 'error', … }`, and let the mappings above it dispatch on `id` as
they do for everything else. The two are not exclusive.

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
  payload under the thunk's own name and never names the payload, so the
  key is the thunk, and the payload offered as a key is refused as a rule
  the grammar does not hold. `rewrite` maps the payload first and the
  thunk after, as two rules; the map README already reads the thunk as
  "the rule its payload spells", and the fold takes that literally, with
  one mapping where `rewrite` allowed two.

The shape asserts of the `rewrite` pass — `fixed`, `contains`,
`structurallySame` — do not exist in the fold. The machine built the
node from the rule, so its shape is right by construction; the asserts
are the mappings' own, on `meta.id`, for now.

**The boundary.** A tokenizer whose token rules are mapped and whose
outer repetition is not produces `MetaAst<Cp | Tok, Repeat<…>>`, and that
type admits either alphabet or an array at every subtree: it is
independent of the set, by design, so it cannot say that every round
became a `'tok'` symbol, and it is not assignable to the next parser's
`readonly MetaSymbol<Tok>[]`. Each symbol crosses as it is; the list
needs one operation, `symbols(result, 'tok')`, which walks the array,
checks every element is a symbol of that alphabet, and returns
`readonly MetaSymbol<Tok>[]` — or refuses, naming the position of the
first element that is not, which is where a token rule left unmapped is
caught. That check is the one runtime fact the type cannot carry, done
once, at the one place it matters. A layer whose result is a single value
rather than a stream — the JSON grammar mapped to a JSON value — maps its
entry rule instead and needs no such step: `parser(rule, set)` then
returns a `MetaSymbol<MO>` outright. The fold-form repetition below
would let a tokenizer do the same, collecting its rounds as it goes.

**What still grows.** With mappings of the form `(ast) => MetaSymbol`, a
repetition holds every round's result until it closes: depth is folded
away, but a top-level `repeat(statement)` holds one result per statement
until EOF. Not growing needs the repetition's mapping in fold form —
`init`/`update`/`end`, the classical `RepeatTransformer` and 043's
`StateFold` — and the frame already accumulates as a list, so swapping
that accumulator for user state is a follow-up, not a redesign.

### Later: the RTTI precheck

The first version checks nothing before the fold runs; a mapping asserts
at runtime. Because the tree has no functions in it, every node kind is
a shape [`../../rtti`](../../rtti/README.md) can spell — a `MetaSymbol` as
`{ symbol: number, meta: { id: 'cp', … } }` with `id` a literal and the
rest `unknown`, a tuple as a tuple, `[tag, node]` as a tuple of a string
literal and the branch — so a later precheck is the classical
`bnf/map/rtti/checkMap` minus its corner-cutting:

- `rule(a, f)` grows optional `ri`/`ro` descriptions; a mapping without
  them stays unchecked.
- At `parser(rule, set)`, after `toData`, compute per name over the
  finite `RuleSet` what each mapping will actually receive — a mapped
  child is its `ro`, an unmapped child its shape over its children's
  computed types, memoized so recursion closes — and refuse
  `ri ⊉ computed`, naming the rule, next to the LL(1) refusals.
- Compare with `rtti/data`'s coinductive `subset`, not `equal`, since
  the computed type's rule names are never the author's.

The classical `inputOf` typed an unmapped child as the wide "any AST",
which lost its shape and was wrong for a mixed subtree; the exact
computation removes that and the "mixed mapped and unmapped variant
boundary" refusal that guarded it. The `id` makes an alphabet mismatch
a build-time refusal, and it is the one field of metadata the check
reads.

### Decided separately

- **EOF** stays synthesized by the parser, its node `[]` and `ahead`
  `undefined` at it; whether the caller sends it as a symbol with its own
  metadata, which would close both gaps at once
  ([eof-as-ordinary-symbol](../../bnf/todo/eof-as-ordinary-symbol.md)),
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
      five sites with `ahead`; a mapping whose rule the grammar does not
      hold, or a rule mapped twice, refused at build; a mapping's
      `['error', e]` folded into the machine's `'error'` step with `pos`;
      `symbols(result, id)` for the boundary.
- [ ] The per-layer factory binding `MI` and `MO`; `rule(a, f)`,
      `Mapping`, `RewriteSet` types, with `f` contextually typed from
      `a` under them.
- [ ] Proofs: the empty set is the identity; a mapped empty match is
      called, with `ahead`; `parser(r, set)` agrees with
      `rewrite`-then-parse where the three keyings agree; a two-layer
      example — a tokenizer emitting `{ id: 'tok', … }` symbols with a
      payload, taken through `symbols(result, 'tok')`, parsed by a
      grammar over `'tok'` whose mapping reads the
      payload.
- [ ] Amend `ll1/README.md` ("Left for later") and `map/README.md` ("No
      metadata channel", "What it is not", "Left for later").
- [ ] File the follow-ups: the fold-form repetition mapping; the RTTI
      precheck; retiring `Ast<R>` and `rewrite`.

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
