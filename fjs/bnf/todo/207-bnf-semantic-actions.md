## 207. BNF rule transformers: one shape per rule kind

**Priority:** P3
**Status:** open

### Problem

Parsing a `RuleSet` yields a generic AST (`Ast<L>` in
[`../matcher/types.ts`](../matcher/types.ts)). Every consumer that wants a domain
value walks that tree afterwards, and each one writes the walk again:

- `fjs/djs/parser` spends ~200 lines recovering values — `slot`, `keyOf`,
  `descendantsTagged` (a *search*, because an array's elements are not its direct
  children), and `foldValue` with its own explicit stack.
- `fjs/bnf`'s example grammars can be matched but not *evaluated*, so a grammar
  cannot be checked against a spec value vector.
- A backend cannot answer "does this match?" without building the whole AST
  ([recognizer-backend](./recognizer-backend.md)).

One cause: the AST is **mandatory**, **anonymous** (a node records the branch tag
but not the rule that produced it), and **complete before anything else starts**.

**Not in this list: `fjs/media/json`.** Its codec keeps a hand-written tokenizer
and container-stack parser by decision —
[parser-serializer-restructure](../../../todo/parser-serializer-restructure.md)
settles that the media codecs take no runtime dependency on `fjs/bnf`. `fjs/bnf`
may hold JSON and DataJS grammars only as proof-covered examples. This issue
makes those examples produce values; it does not make them a codec.

### Proposal

A transformer says what a rule builds from its children, keyed by the rule value,
applied by the matcher backends themselves. No AST is materialized, and no RTTI
is needed.

#### 1. The protocol

One shape per data rule kind, each carrying a metadata channel `M` (§7):

```ts
type Meta<M, T> = readonly[T, M]
type Branch<C> = { readonly [K in keyof C]: readonly[K, C[K]] }[keyof C]
type Out<M, T> = Meta<M, T>

type TerminalTransformer<M, T> = (v: Meta<M, CodePoint>) => Out<M, T>
type SequenceTransformer<M, C extends readonly unknown[], T> = (v: Meta<M, C>) => Out<M, T>
type VariantTransformer<M, C, T> = (v: Meta<M, Branch<C>>) => Out<M, T>
type RepeatTransformer<M, C, S, T> = StateFold<Meta<M, C>, S, Out<M, T>>
```

- **Terminal** gets the matched symbol with its metadata. `Meta<M, CodePoint>` is
  the shared parser leaf (§7).
- **Sequence** gets its children as a typed tuple. Fixed arity, so nothing to
  stream and no state.
- **Variant** gets the branch name paired with its value, in *one* parameter:
  with two, matching on the name does not narrow the value and forces a cast.
- **Repeat** is the only kind with state, because it is the only kind whose size
  the grammar does not bound. It is `fjs/types/list`'s `Accumulator`, with
  `todo/flow.md`'s `(state, item)` order.

**Why four shapes and not one.** A uniform transformer folding one child at a
time has `unknown` as its item type, so every child type in a map is an
unchecked annotation. Splitting by kind takes the child types from the rule's own
shape, lets construction check that an entry's kind matches its rule's, and puts
the fold where it is needed.

A rule with no entry is not transformed — it builds its AST node as today, so an
empty map behaves bit for bit as it does now.

#### 2. What each kind receives

| Data rule kind  | The transformer receives                                    |
|-----------------|-------------------------------------------------------------|
| `TerminalRange` | `[symbol, M]`                                                |
| at EOF          | `[EOF, identity]` — no leaf exists ([contract](../README.md#logical-eof-in-parser-input)) |
| `Sequence`      | `[[c₀, …, cₙ], merged M]`, one slot per item                 |
| empty `Sequence`| `[[], identity]`                                             |
| `Variant`       | `[[branchName, value], that branch's M]`                     |
| `Repeat`        | `init`, one `update` per round, then `end(state)`             |
| zero rounds     | `init` then `end(init)`                                       |

Each child is its *transformed* value where it has a transformer, its AST node
where it does not (§3).

`T` is unconstrained. A mapping that needs a recoverable semantic error uses a
`Result` as its own `T`; the parser does not inspect or propagate it.

A terminal that can match EOF must handle it — `String.fromCodePoint(-1)` is
garbage — so such a rule is usually `unit`.

#### 3. What an unmapped rule builds

Its AST node, as today. The builders, as ordinary transformers:

```ts
const terminal: TerminalTransformer<M, Ast<unknown>> =
    v => [{ tag: undefined, sequence: v[0] === EOF ? [] : [v] }, v[1]]

const sequence: SequenceTransformer<M, readonly unknown[], Ast<unknown>> =
    ([items, m]) => [{ tag: undefined, sequence: items }, m]

// identity: a variant contributes no node
const variant = ([[, node], m]: Meta<M, readonly[string, Ast<unknown>]>): Out<M, Ast<unknown>> =>
    [node, m]

const repeat = (m: Monoid<M>): RepeatTransformer<M, unknown, _Rounds, Ast<unknown>> => ({
    init: [null, m.identity],
    update: ([items, acc], [item, im]) => [concat(items)([item]), m.operation(acc)(im)],
    end: ([items, acc]) => [{ tag: undefined, sequence: toArray(items) }, acc],
})
type _Rounds = readonly[List<unknown>, M]
```

Their leaf is the whole `Meta<M, CodePoint>` pair and their node is
`Ast<unknown>`, since a child of an unmapped rule may itself be transformed.
None adds a semantic error type.

**A node's tag is an *inherited* attribute and none of these can supply it.** A
rule is entered *with* a tag and its node carries it; a variant contributes no
node, it re-enters its branch with the branch's tag, so nested variants let the
innermost win. A transformer only synthesizes. So these four specify the
**children** an unmapped rule's node holds, not its tag; `descentEquivalence` in
`../ll1/proof.f.mjs` pins the tags.

**A mapped branch under an *unmapped* variant is refused at construction.** The
engine hands the branch's node the tag and that node *is* the variant's; if the
branch is mapped there is no node to tag. Repairing it by wrapping would change
the AST in the name of preserving it. The converse — an unmapped branch under a
mapped variant — is refused too (§5).

#### 4. Streaming

**Fold-level (this issue).** Memory is O(depth) frames, plus the live repetition
states, plus the partly collected children of fixed-arity rules on the spine —
the last bounded by the grammar rather than the input. A mapped rule builds no
node, so the AST's O(*n*) cost is not paid rather than paid and discarded.

**No growing copy in any callback a recursive rule reaches.** A fixed arity
bounds one invocation, not how many the input causes: right-recurse a list and
`([h, t]) => [h, ...t]` is quadratic exactly as a repetition's `update` would be.
Accumulate with `List` and flatten in `end`. Where the grammar has the choice,
prefer `Repeat` — the helpers get its accumulation right.

**Input-level** is [43](./043-stateful-parser.md)'s, which now carries that
design: a `StateFold` over one symbol at a time, RTTI-free, keeping §10's
separation — a validatable root output stays `checkMap`'s and this map's
callbacks stay bare. It composes because the
parser state is a value: the frame stack, each frame's `(rule name, state)`, and
the cursor. The engine's half holds no closures — a frame carries a rule *name*.
`T` and `S` are unconstrained, so **a suspended parse is serializable exactly
when every live transformer value is**; a grammar that wants the checkpoint owes
plain data from its transformers. Bounded-memory input is `ll1`'s alone: it never
backtracks, so a consumed chunk can be released.

**Output-level is not designed.** A fold produces its value at the root, so a
1 GB document is a 1 GB value unless the transformers discard. A typed drain
needs the start rule's `S`, which the map erases, and a rule for speculation;
flow's output chunk taxes every rule with a channel almost none use. Deferred
until a consumer names which cost it would rather pay.

|                                    | `ll1` | `descent` |
|------------------------------------|-------|-----------|
| Metadata channel `M`               | after this change | shipped |
| Bounded-memory input               | yes   | retains to the oldest live rewind |
| Transformer may run on an abandoned branch | never | yes |

#### 5. The map, the entry point, and what is checked

It lives in `fjs/bnf/matcher`, the layer both backends share; each backend gains
one entry point, and its frames carry `(rule name, collected children — or, for a
`Repeat`, state)` where they carried an `AstSequence`.

```ts
// erased: tagged by rule kind, and carrying the child shape the author declared
type Transformer<M, T> =
    | readonly['terminal', TerminalTransformer<M, T>]
    | readonly['sequence', number, SequenceTransformer<M, never, T>]
    | readonly['variant', readonly string[], VariantTransformer<M, never, T>]
    | readonly['repeat', FRule, {
        readonly init: unknown
        readonly update: (state: never, c: Meta<M, never>) => unknown
        readonly end: (state: never) => Out<M, T> }]
    | readonly['unit']

// keyed by the rule value — the `===` `toData` already dedups on
type Entry<M, T> = readonly[FRule, Transformer<M, T>]
type TransformerMap<M> = ReadonlyMap<FRule, Transformer<M, unknown>>
```

`FRule` is the **functional** `Rule` of [`../types.ts`](../types.ts) — the whole
union, `LazyRule` included. Narrowing the key to `DataRule` would look harmless
and would exclude the design's central case: a recursive rule is written as
`() => DataRule`, so `value` in [`../lib/datajs/module.f.mjs`](../lib/datajs/module.f.mjs)
and [`../lib/json/module.f.mjs`](../lib/json/module.f.mjs) — the rules a
transformer most wants to key — are `Rule` but not `DataRule`, and a map that
cannot name them cannot evaluate either grammar. The data `Rule` of
[`../data/types.ts`](../data/types.ts) is a different type and is not the key
either: `toData` has already replaced the values a map is written against.

```ts
type Leaf<M> = Meta<M, CodePoint>
type TransformMatchResult<T, M> =
    | readonly['ok', Meta<M, T>, readonly Leaf<M>[]]
    | readonly['no-match', Remainder<M>]     // rejected, or input ran out (`null`)
type TransformMatch<T, M> = (s: readonly Leaf<M>[]) => TransformMatchResult<T, M>

const transformers: <M>(monoid: Monoid<M>) => Transformers<M>   // §8
//   build: (rest: TransformerMap<M>) => <T>(start: Entry<M, T>) => TransformMatch<T, M>
```

**Keyed by rule value, not name.** `toData` takes a rule's name from `fr.name`
for a function and `''` otherwise, then disambiguates collisions — so a rule not
written as a named thunk gets a generated name nothing outside `toData` can
predict, and a combinator cannot address what it built at all. `find` already
identifies rules by `v === fr`, so **whoever holds the rule holds the key**. What
`toData` owes this design is to expose the rule-value → name mapping it already
builds, so the engine can attach entries.

"Holds" is the whole requirement, and it is not nothing: a rule a thunk allocates
*per invocation* is held by nobody. `deterministic()`'s `value = () => ({ array:
cj('[]', value), … })` is the live case — `value` is keyable, its `array` branch
is not. **Bind a rule you want to transform to a value you keep.** That is far
weaker than name-keying's "make it a named thunk", but it is a rule.

**The start entry carries the parse's type.** `build` takes it separately, so
there is no conditional type reading the map's keys, and no annotate-vs-`satisfies`
hazard. A start rule with no transformer is `[rule, unit]`; a caller who wants the
AST uses `parserRuleSet`.

**The tag and child shape are data because nothing else carries them.** Erased,
terminal/sequence/variant are the same function type and indistinguishable at
runtime. `C` is a type parameter and is erased, so each entry declares its arity,
branch names, or repeated rule — and cannot drift from `C`, because `seq`'s
parameter is typed `C['length']` and `variant`'s is `keyof C & string`. What is
left to the author is which types the slots *hold*.

**Seven checks at construction**, each throwing rather than parsing. None is
expressible in a type, because the map's type does not know the grammar:

1. every keyed rule is reachable from the start rule;
2. every entry's kind tag matches its rule's kind (`unit` matches any);
3. every entry's declared child shape matches its rule's — arity, branch names in
   both directions, repeated rule;
4. `start` is a rule of the grammar;
5. `start`'s rule is not also in `rest`;
6. no mapped branch under an unmapped variant (§3);
7. every branch a mapped variant declares has an entry.

Checks 5 and 7, plus `map`'s duplicate rejection (§9), are one invariant found from
several directions: **one rule value means one transformer.**

**Entries, the map and `build` must come from the same factory.** Nothing else
guarantees they share a monoid, and the public types are structural. How that is
enforced — branding, an opaque map type, or `build` taking entries directly — is
the implementer's.

**`parserRuleSet` keeps its native path.** It is not this machine with an empty
map: the machine needs a `Monoid<M>` the AST API has no use for and cannot
conjure for an arbitrary `M`. Its leaf becomes `Meta<M, CodePoint>` like
everything else (§7).

`fjs/bnf/descent` returns `{ ast, success, idx, failure? }` rather than a
remainder tuple; its transforming entry keeps the backend's native parse result
shape. Two backends, one input type, two result types.

#### 6. Backtracking, purity, and semantic results

A transformer **must be pure and total**: same inputs, same outputs, no effects,
no `throw`. `descent` speculates, and a branch it abandons may already have run
transformers — discarding them must be dropping a frame, with no undo protocol.
Expensive work multiplies under backtracking; only `ll1` guarantees nothing runs
on work thrown away.

Totality is partly the type system's job now: a variant transformer that forgets
a declared branch does not compile, and a sequence transformer cannot destructure
a position its rule does not have. What is left to the contract is that a
truncated sequence never reaches a transformer at all.

**Semantic failure is a mapping value, not an engine channel.** A rule that must
represent recoverable failure chooses `T = Result<V, E>`. The parser treats that
`Result` like every other value: it neither unwraps it nor skips parent mappings.
Each parent mapping therefore decides how to combine or propagate a child's
semantic result. When propagation through the grammar would add noise, validate
once in the root mapping or in a postprocess after parsing.

This keeps syntax and semantics separate. A semantic `error` does not change
what the grammar accepts, does not acquire a parser cursor or rule name, and
does not introduce a second control-flow protocol beside the mapping's `T`.

**A parse that did not finish has no transformed value.** No transformer on the
spine runs when the grammar rejects or the input runs out mid-rule. Both are
`no-match`, told apart by the remainder.

#### 7. Metadata: both backends carry it

`M` is generic in what it carries. It is **not** a source range — a range is one
instance. The motivating case is a layered parse: a tokenizer's symbol says only
*that* a number is here, and *which* number rides in `M`.

`descent` previously carried the same pair under a backend-specific name.
**`ll1` gains it**, which is the one part of this issue that reaches shipped
types: `Match`, `MatchResult` and `Remainder` become generic in `M` over
`readonly Meta<M, CodePoint>[]`, `ll1/private.ts`'s frame types follow, and
That pair moves to `fjs/bnf/matcher/types.ts` as `Meta`. `matcher` was
written for it — `Ast<L>` already takes the leaf as a parameter — so the
asymmetry was `ll1`'s hard-coded choice, not a contract. Nothing outside
`fjs/bnf/ll1` imports `ll1`, so this breaking change has no caller but its own
proofs, and those get *simpler*: `bothBackends` stops building two inputs, and
`showAst` loses a leaf union that exists only because the backends disagreed.

**A parent's `M` is the monoid's; its own output `M` is its choice.** The engine
combines children's with a `Monoid<M>` given to the factory
([`fjs/common/monoid`](../../common/monoid/module.f.mjs)), whose identity covers
the empty sequence and the zero-round repetition.

> **Superseded by [43](./043-stateful-parser.md).** A parser transforms
> metadata, so one `M` became `MI` and `MO`, and the monoid became two
> operations: `translate: (mi: MI) => MO` and `reduce: Reduce<MO>`, folded
> strictly left to right with no associativity required. Everything below about
> *which* metadata each rule kind contributes still holds; only the algebra
> changed. The identity is the part that did not survive — what an empty
> sequence, a zero-round repetition and an EOF terminal contribute is 43's open
> question, and the rest of this section's `Monoid<M>` should be read as that
> pair.

Repetition is the stateful exception to engine-level composition. Each round's
complete child `Meta` reaches `update`, so the transformer keeps whatever
metadata it needs in `S`; `end` then forms the final value and metadata together
as `Out<M, T>`. The default AST transformer uses the monoid in its state, but an
explicit transformer may derive its output metadata differently.

~~One `M` suffices, because a monoid on a product is componentwise:~~

```ts
type M = readonly[Pos, Payload]
const monoid: Monoid<M> = {
    identity: [undefined, undefined],
    operation: ([p0, q0]) => ([p1, q1]) =>       // componentwise leftmost-defined
        [p0 === undefined ? p1 : p0, q0 === undefined ? q1 : q0],
}
```

~~Every component must be a lawful monoid. Making the payload component
constantly the identity — so no parent inherits a token's value — is associative
but **not unital**, so not a monoid at all, and would make metadata depend on
grammar shape. What stops a consumed payload propagating is the
**transformer**, which chooses its own output `M`.~~

**This argument did not survive its own example.** The product was how one `M`
was meant to carry a tokenizer's position *and* its payload, and the case that
motivated it is the case that broke it: a layer transforms metadata, so the
payload a tokenizer produces is not of the same type as the metadata it
consumed. [43](./043-stateful-parser.md) takes `MI` and `MO` instead, and the
componentwise product is no longer the mechanism. The paragraph above about
lawfulness is kept because it says something true and easy to get wrong: a
"component that is constantly the identity" is not a monoid, which is why
suppressing propagation was never the algebra's job.

For the [layered parser](./layered-parser.md), each layer is one grammar plus one
transformer map, and a layer's payload is its output metadata `MO`.

#### 8. Helpers

Everything comes from one factory, `transformers(monoid)`, which binds `M` once.
`M` is invariant in `Transformer<M, T>` and a call like `terminal(c => …)`
mentions no metadata, so free helpers would infer `M = unknown` — survivable
inside a contextually typed map, fatal for the standalone start entry.

```ts
type Transformers<M> = {
    readonly entry: <T>(rule: FRule, t: Transformer<M, T>) => Entry<M, T>
    readonly map: (...entries: readonly Entry<M, unknown>[]) => TransformerMap<M>

    // tagging constructors — the only way a §1 shape becomes installable
    readonly terminalOf: <T>(f: TerminalTransformer<M, T>) => Transformer<M, T>
    readonly seqOf: <C extends readonly unknown[], T>(
        arity: C['length'], f: SequenceTransformer<M, C, T>) => Transformer<M, T>
    readonly variantOf: <C, T>(
        branches: readonly (keyof C & string)[], f: VariantTransformer<M, C, T>) => Transformer<M, T>
    readonly repeatOf: <C, S, T>(item: FRule, r: RepeatTransformer<M, C, S, T>) => Transformer<M, T>

    // sugar: the callback sees the value alone and `M` is forwarded
    readonly terminal: <T>(f: (symbol: CodePoint) => T) => Transformer<M, T>
    readonly seq: <C extends readonly unknown[], T>(
        arity: C['length'], f: (children: C) => T) => Transformer<M, T>
    readonly variant: <C, T>(
        branches: readonly (keyof C & string)[], f: (b: Branch<C>) => T) => Transformer<M, T>
    readonly list: <C>(item: FRule) => Transformer<M, readonly C[]>
    readonly text: (item: FRule) => Transformer<M, string>
    readonly unit: Transformer<M, undefined>

    readonly build: (rest: TransformerMap<M>) => <T>(start: Entry<M, T>) => TransformMatch<T, M>
}
```

- The `…Of` constructors are the primitive: a map entry must carry the kind tag,
  so a bare §1 shape is not installable, and an author never writes a tag.
- `map` takes `Entry<M, unknown>` so heterogeneous entries widen where they are
  passed (`Transformer<M, T>` is covariant in `T`) and no annotation is needed.
  It **throws on a duplicate rule** — the same widening would otherwise let
  `Map` construction silently keep the last, and only the survivor reaches §5's
  checks.
- `text(item)` requires its item rule to produce a *string*: a `Repeat`'s children
  are rule results, never raw leaves.
- `unit` is not a kind — it fits any rule and the engine answers it without
  calling anything, which is what makes an all-`unit` recognizer free. It is
  declared at `undefined` so `entry(rule, unit)` infers that rather than
  `unknown`.
- There is no `span` helper: a wrapper cannot see its subject's children, so the
  merge has to be the engine's (§7).

#### 9. Worked example

Twelve rules, written out so the map and the grammar cannot disagree, exercising
all four kinds and both empty variant branches:

```ts
//   list    = () => ['[', items, ']']        Sequence
//   items   = () => ({ some, noItems })      Variant
//   some    = () => [item, more]             Sequence
//   more    = () => repeat(next)             Repeat
//   next    = () => [',', item]              Sequence
//   noItems = () => []                       Sequence, empty
//   item    = () => [sign, digit, digits]    Sequence, at least one digit
//   sign    = () => ({ minus, noSign })      Variant
//   minus   = () => range('--')              TerminalRange
//   noSign  = () => []                       Sequence, empty
//   digits  = () => repeat(digit)            Repeat
//   digit   = () => range('09')              TerminalRange
const { entry, map, terminal, seq, variant, list, text, build } = transformers(m)

const rest = map(
    entry(digit,   terminal(c => String.fromCodePoint(c))),
    entry(digits,  text(digit)),
    entry(minus,   terminal(() => '-')),
    entry(noSign,  seq(0, () => '')),
    entry(sign,    variant(['minus', 'noSign'],
                       ([, x]: Branch<{ minus: string, noSign: string }>) => x)),
    entry(item,    seq(3, ([s, d0, ds]: readonly[string, string, string]) =>
                       Number(`${s}${d0}${ds}`))),
    entry(next,    seq(2, ([, it]: readonly[unknown, number]) => it)),
    entry(more,    list<number>(next)),
    entry(some,    seq(2, ([first, rest]: readonly[number, readonly number[]]) =>
                       [first, ...rest])),
    entry(noItems, seq(0, () => [])),
    entry(items,   variant(['some', 'noItems'],
                       ([, xs]: Branch<{ some: readonly number[], noItems: readonly number[] }>) => xs)),
)

const match = build(rest)(
    entry(list, seq(3, ([, xs]: readonly[unknown, readonly number[], unknown]) =>
        xs.every(Number.isSafeInteger)
            ? ok(xs)
            : error('integer is outside Number safe range'))))
```

`item` needs a `digit` *and* a `digits` repetition because a `Repeat` matches
zero rounds: with `[sign, digits]` alone, `item` matches nothing, `Number('')` is
`0`, and `[,]` would be accepted. One-or-more is one plus zero-or-more.

The start rule makes its `T` a `Result<readonly number[], string>` and rejects
the completed value if any integer is outside `Number`'s exact range. Therefore
an input such as `[9007199254740993]` cannot produce a plausible rounded list.
The parser itself needs no semantic-error channel (§6).

**`list` sees its own brackets** — every direct child occupies a slot, and `unit`
contributes `undefined` rather than removing itself. Tolerable for a rule the
author wrote; not tolerable for one a combinator built, whose shape the author
never saw. **The answer is that a combinator supplies transformers for the rules
it generates**, since it holds them (§5). An engine-dropped `unit` was considered
and does not work: it reaches punctuation the author wrote but not a combinator's
scaffolding, it would make a sequence's arity depend on the map, and the alphabet
split removes the `string` rule case it relies on.

**Declaring a type for a variant means transforming all of it**, `noItems` and
`noSign` included, which is why two rules exist only to return `[]` and `''`.

**Recognizing without building:** the same grammar with `unit` for every rule.
O(depth) memory, no value built, no call made — what
[recognizer-backend](./recognizer-backend.md) wants. The verdict is `ok` **with an
empty remainder**, not the tag alone: a match succeeds as soon as the start rule
does, and `isMatchSuccess` in `../ll1/proof.f.mjs` already says
`success && remainder?.length === 0`.

**What JSON adds**, for stage-2 sizing: a string is six rules (a character is a
*variant* over plain and escaped), a number about nine (each "optional" a
`Variant` with an empty branch, never a `Repeat` — a repetition would accept
`--1`), objects and arrays five each, and `value` is a seven-branch variant.

**DJS.** `foldValue`, `descendantsTagged`, `slot`, `keyOf` and `_FoldFrame` all
delete. Its one hard case is that `const` references resolve against *earlier*
statements — an inherited attribute, which a transformer cannot see. Resolve it
in a **second pass** over the built module: no protocol change, all state stays
plain data, and "const not found" becomes a check on a value, which is where a
name-resolution error belongs. The pass rejects a duplicate declaration and
fails the document when any reference does not resolve to an earlier `const`;
it never leaves an unresolved name in the result. A downward channel in the
engine would change
every signature; a closure-returning transformer would put functions in a
suspended parse's state (§4).

#### 10. What this replaces

- **Not blocked.** The previous design was blocked by
  [unicode-rules](./unicode-rules.md) for describing `string` as a generic `Rule`
  kind. This one is defined over the data `RuleSet`.
- **`mapRule` is dropped.** Wrapping rules to carry actions made every consumer
  learn to skip a wrapper, for inference that does not survive a cyclic grammar.
  A separate map keyed by rule value leaves the grammar untouched.
- **Fold, not `reduce`.** `reduce` over a materialized child array cannot stream;
  the `Repeat` fold can, and the fixed-arity kinds take an array the grammar
  bounds.
- **RTTI is optional.** `in`/`out` schemas and `subset` remain available as a
  debug layer; the open question that blocked the previous design (a boundary
  `subset` cannot prove) no longer gates anything.
- **The RTTI map is not the parser map.** `fjs/bnf/map` keeps its checked
  callbacks and `Result<Meta<M, T>, string>` output as a separate validation
  API. The parser consumes `TransformerMap`, whose callbacks return bare
  `Meta<M, T>` and may choose `T = Result<V, E>`. Neither API's entries are
  accepted by the other; sharing one metadata type `M` is their only contract.
- **The split is off.** What made the old issue too big was the RTTI contract,
  the metadata monoid and the flattening analysis. The first is optional, the
  third shipped as `Repeat`, and the second is now one monoid per parser rather
  than a triple per rule.

### How binding this is

[REVIEW.md](../../../REVIEW.md#designs): the implementer is not bound, but
deviating silently is not allowed — the reason goes here.

- **Settled** — the four kinds, a metadata channel and its algebra, semantic
  results as ordinary `T` values, and the rule-value key. Changing one is a
  design change. *(The algebra itself already changed once, deliberately: one
  `M` and its monoid became `MI`/`MO` with `translate` and `reduce` in
  [43](./043-stateful-parser.md). That is the design change this bullet asks
  for, made rather than drifted into.)*
- **Specified only because two implementers would otherwise differ** — the seven
  checks, the four default builders, the helper set. Deviate where the code
  disagrees, and say so here.
- **The implementer's** — frame layout, where the existential cast lives, how
  `toData` exposes its rule → name mapping, how factory products are bound
  together, error wording.

Stage 1 found two useful simplifications. `build(rest)(start)` defines the
grammar from `start.rule`, so check 4 is true by construction rather than a
runtime check. `toDataWithRules` leaves the established `toData` result intact
and exposes the rule-value → name map only to callers that need it. Factory
products carry a fresh runtime symbol; this is the existential boundary where
the heterogeneous transformer map is deliberately erased.

### Tasks

**Stage 0 — decided**, each by writing §9's map both ways and compiling:

- [x] **Semantic failure is an ordinary `T`** (§6). A mapping may choose
      `Result<V, E>` without adding a parser-wide failure channel.
- [x] **The child shape is carried as data** (§5). `C['length']` and
      `keyof C & string` keep it from drifting; cost is one literal per entry.
- [x] **Silent children are not a protocol change** (§9) — a combinator supplies
      transformers for what it generates. Stage-2 library work.

**Stage 1 — the protocol and `fjs/bnf/ll1`**, first because it never backtracks,
it is the smaller machine, it is the backend without metadata yet, and
`descentEquivalence` already pins the AST.

- [x] Add `Meta`, `Branch`, `Out`, the four transformer types, `Entry`, the
      erased `Transformer` and `TransformerMap` to `fjs/bnf/matcher/types.ts`,
      and the four default builders to its `module.f.mjs`.
- [x] Have `toData` expose the rule-value → name mapping it already builds.
- [x] Give `fjs/bnf/ll1` the metadata leaf, and simplify `bothBackends` and
      `showAst` accordingly (§7).
- [x] Add `transformers`/`build` with the §8 primitives — `entry`, `map`, the
      four `…Of`, `unit` — since a bare shape is not installable and stage 1's
      own proofs need a map.
- [x] Run the construction checks (§5) and `map`'s duplicate rejection. Check 4
      is guaranteed by the `build(rest)(start)` API rather than tested at runtime.
- [x] Add a variant frame to `ll1`, pushed only for a variant the map names.
- [x] Skip the transformer when input runs out mid-rule, for the whole spine.
- [x] Keep `parserRuleSet` on its native path.
- [x] Proofs: `descentEquivalence` and existing AST expectations unchanged under
      the empty map; the default builders' *children* matching the native path;
      what each kind receives per §2, including EOF, an empty `Sequence` and a
      zero-round `Repeat`; all seven checks and duplicate rejection, each with a
      passing and a failing case; and a deep-nesting case.

**Stage 2 — helpers and the first consumer**, inside `fjs/bnf`, not
`fjs/media/json`.

- [ ] Add the §8 sugar.
- [ ] Ship §9's twelve-rule grammar and map as the end-to-end proof.
- [ ] Have combinators return transformers alongside rules.
- [ ] Give the JSON example grammar a transformer set. It needs a small
      restructuring — hoist the rules a thunk allocates per call to `const`s the
      author holds (§5) — not the named-thunk rewrite name-keying required.
- [ ] Take the all-`unit` map to [recognizer-backend](./recognizer-backend.md) as
      its payload-free mode. It is **not**
      [streaming-recognizer](../../media/json/todo/streaming-recognizer.md)'s
      `recognizerStep`, which is per-`U16`, depth-capped, and
      `fjs/media/json`'s own.

**Stage 3 — `fjs/bnf/descent`.**

- [ ] Thread states through its frames, keeping the untransformed path identical.
- [ ] Prove the speculative cases stage 1 cannot reach.
- [ ] Port `fjs/djs/parser`, resolving `refs` in a second pass (§9).
- [ ] Register new modules in `deno.json`; run `tsc` and `fjs test`.

### Open questions

None can change stage 1's public types.

- ~~**Does the product monoid read well on a real tokenizer (§7)?**~~ Answered
  by the tokenizer case itself, and not in the product's favour: a layer
  transforms metadata, so [43](./043-stateful-parser.md) takes `MI` and `MO`
  rather than one `M` carrying both components. The remaining question is 43's —
  what a match with no children contributes, now that the identity is gone.
- **Output-level streaming (§4)** — deferred until a consumer names its cost.
- **Helper sugar (§8)** — let the JSON and DJS ports pick the final set.
- **What a combinator's map fragment looks like (§9)** — a second return value, a
  paired builder, or a convention. Library shape, no protocol consequence.
- **The repository-wide `(state, item)` argument.** `RepeatTransformer.update` is
  `(state, item)`, committed, following `todo/flow.md`; `Accumulator` is the other
  way round. Unifying them is the repository's call, not this issue's.

### Related

- [generic parser metadata](./generic-parser-metadata.md) — the focused metadata
  contract shared by the mapping layer and both parser backends.
- [43. Stateful parser](./043-stateful-parser.md) — input-side `init`/`append`/`end`.
- [`todo/flow.md`](../../../todo/flow.md) — the `Transducer` operator
  `RepeatTransformer` follows; composition and stage fusion belong there.
- [`fjs/types/list/types.ts`](../../types/list/types.ts) — `Accumulator`, which
  `RepeatTransformer` is.
- [`fjs/common/monoid`](../../common/monoid/module.f.mjs) — the `Monoid<T>` this
  issue's factory took at construction, superseded by
  [43](./043-stateful-parser.md)'s `translate`/`reduce` pair. Note its `fold` is
  *balanced*, so it must not be reused for a `reduce` that is not associative.
- [43. Stateful parser](./043-stateful-parser.md) — the metadata algebra and the
  streaming input contract that supersede §7's monoid.
- [`fjs/bnf/matcher/types.ts`](../matcher/types.ts) — `Ast<L>` is already
  parameterized by the leaf.
- [`fjs/bnf/descent/types.ts`](../descent/types.ts) — the recursive-descent
  backend now imports the shared `Meta<M, T>` pair.
- [`fjs/djs/tokenizer`](../../djs/tokenizer/module.f.mjs) — `metadataScan` builds
  `Meta<TokenMetadata, CodePoint>` values for the parser.
- [recognizer-backend](./recognizer-backend.md) — the payload-free mode the
  all-`unit` map supplies.
- [layered parser](./layered-parser.md) — each layer is one grammar plus one map.
- [unicode-rules](./unicode-rules.md) — not blocking; it changes which rule
  *values* a grammar has, not any spelling.
- [parser-serializer-restructure](../../../todo/parser-serializer-restructure.md)
  — the media/BNF boundary.
- [`../README.md`](../README.md#the-ast-is-one-contract) — the AST contract the
  default builders reproduce.
