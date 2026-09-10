## 207. BNF rule transformers: one shape per rule kind

**Priority:** P3
**Status:** open

**What this issue is now.** The transformer protocol below was designed for
the classical `fjs/bnf` backends and shipped there as stage 1, on
`bnf/ll1`; that module was deleted with `fjs/bnf`
([ebnf-migration](../../todo/ebnf-migration.md), stage 7). The surviving
backend, [`../ll1`](../ll1/README.md), has the capability this issue asked
for in a different shape — a rewrite set folded into the parse, one mapping
per rule the author holds, each returning one symbol of the next alphabet
with the value in its metadata ([`../ast`](../ast/README.md)) — and
inherits the decisions made here: a mapping is keyed by the rule value, not
a name; what a mapping receives is typed from the rule's own shape; a
recoverable semantic failure is an ordinary value, never an engine channel;
a mapping is pure and total. The text is kept as the record of those
decisions and of what they were weighed against; the classical paths it
names are gone. What is still open is listed under **Open questions** at the
end; the tasks are marked for what shipped in the classical backend and
what the rewrite set answers.

### Problem

Parsing a `RuleSet` yielded a generic AST in the classical backends. Every
consumer that wanted a domain value walked that tree afterwards, and each one
wrote the walk again:

- `fjs/djs/parser` spent ~200 lines recovering values — `slot`, `keyOf`,
  `descendantsTagged` (a *search*, because an array's elements were not its
  direct children), and `foldValue` with its own explicit stack.
- the example grammars could be matched but not *evaluated*, so a grammar
  could not be checked against a spec value vector.
- A backend cannot answer "does this match?" without building the whole AST
  ([recognizer-backend](./recognizer-backend.md)).

One cause: the AST is **mandatory**, **anonymous** (a node records the branch tag
but not the rule that produced it), and **complete before anything else starts**.

**Not in this list: `fjs/media/json`.** Not because its codec stays
hand-written — that decision is withdrawn, and
[parser-serializer-restructure](../../../todo/parser-serializer-restructure.md)
now has JSON's reader coming from a grammar. The reason is the module: that
grammar runs over `fjs/ebnf/`, while `fjs/bnf` held JSON and DataJS
grammars only as proof-covered examples. This issue made those examples
produce values; it did not make them a codec. The capability it describes is
the same one a codec needs, and `fjs/ebnf/` has it:
[`../ll1`](../ll1/README.md) folds a rewrite set into the parse, and
`fjs/media/json` and `fjs/media/datajs` read their formats through it.

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
  the shared parser leaf (§7). *(With `MI`/`MO` this is where the two meet:
  `(v: Meta<MI, Symbol>) => Out<MO, T>`, the one place the boundary is
  crossed — see [43](./043-stateful-parser.md).)*
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
| at EOF          | `[EOF, its own metadata]` — a caller-supplied symbol, contributing no leaf ([eof-as-ordinary-symbol](../terminal/todo/eof-as-ordinary-symbol.md)) |
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
**children** an unmapped rule's node holds, not its tag. (The surviving
backend's variant node is `[tag, node]`, a row of its own, so the question
does not arise there.)

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

It lived in the classical `bnf/matcher`, the layer both backends shared; each backend gained
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

`FRule` was the **functional** `Rule` of the classical front end — the whole
union, the lazy rule included. Narrowing the key to the plain rules would
have looked harmless and excluded the design's central case: a recursive
rule is written as a thunk, so `value` in the JSON and DataJS grammars — the
rules a transformer most wants to key — is a thunk, and a map that cannot
name it cannot evaluate either grammar. The data `Rule` is a different type
and is not the key either: the lowering has already replaced the values a map
is written against. The rewrite set keys by the same identity, through the
name map `toData` returns ([`../data`](../data/README.md)).

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

The classical `descent` returned a record rather than a remainder tuple;
its transforming entry kept the backend's native parse result shape. Two
backends, one input type, two result types.

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

The classical `descent` carried the same pair under a backend-specific
name, and the classical `ll1` gained it in stage 1. The surviving backend
has it as `Meta<I>` from the start ([`../ast`](../ast/README.md)).

**A parent's `M` is the monoid's; its own output `M` is its choice.** The engine
combines children's with a `Monoid<M>` given to the factory
([`fjs/common/monoid`](../../common/monoid/module.f.mjs)), whose identity covers
the empty sequence and the zero-round repetition.

> **This was the shipped API of the classical `bnf/ll1`, and the rewrite set
> replaces it.** `transformers(monoid)` took one `Monoid<M>`; a later draft of
> [43](./043-stateful-parser.md) split `M` into `MI`/`MO` with `translate`
> and a non-associative `reduce`. Neither survives in
> [`../ll1`](../ll1/README.md): a mapping returns a `Meta<O>` of the next
> alphabet, so there is no engine-level fold of metadata, and what an empty
> sequence or a zero-round repetition contributes is the mapping's answer,
> since it receives the empty node. Whether EOF should carry the caller's
> metadata is [eof-as-ordinary-symbol](../terminal/todo/eof-as-ordinary-symbol.md)'s.

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
consumed. The rewrite set's `I` and `O` are the two types instead, and the
componentwise product is no longer the mechanism. The paragraph above about
lawfulness is kept because it says something true and easy to get wrong: a
"component that is constantly the identity" is not a monoid, which is why
suppressing propagation was never the algebra's job.

For the [layered parser](./layered-parser.md), each layer is one grammar plus one
transformer map, and a layer's payload is its output metadata `MO`.

#### 8. Helpers

Everything comes from one factory, `transformers(monoid)`, which binds `M` once.
*(Shipped as written; [43](./043-stateful-parser.md) replaces the `monoid`
argument with `translate`/`reduce` and splits `M` — see §7's note.)*
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
[recognizer-backend](./recognizer-backend.md) wants. The verdict is `ok` **with
the end at the input's length**, not the tag alone: a match succeeds as soon
as the start rule does.

**What JSON adds**, for stage-2 sizing: a string is six rules (a character is a
*variant* over plain and escaped), a number about nine (each "optional" a
`Variant` with an empty branch, never a `Repeat` — a repetition would accept
`--1`), objects and arrays five each, and `value` is a seven-branch variant.

**DJS.** `foldValue`, `descendantsTagged`, `slot`, `keyOf` and `_FoldFrame` all
delete — and did, when `fjs/djs/parser` moved to the rewrite set. Its one
hard case is that `const` references resolve against *earlier* statements —
an inherited attribute, which a mapping cannot see. It is resolved in a
**second pass** over the built module, as `fjs/media/datajs` and
`fjs/djs/parser` both do: no protocol change, all state stays plain data,
and "const not found" is a check on a value, which is where a
name-resolution error belongs. A downward channel in the engine would change
every signature; a closure-returning mapping would put functions in a
suspended parse's state (§4).

#### 10. What this replaces

- **Not blocked.** The previous design was blocked by
  [unicode-rules](../unicode/todo/unicode-rules.md) for describing `string` as a generic `Rule`
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
- **The RTTI map is not the parser map.** The classical `bnf/map` kept its
  checked callbacks as a separate validation API, and went with `fjs/bnf`;
  the surviving backend has no runtime type information, a mapping's
  parameter being typed from its rule in `tsc`.
- **The split is off.** What made the old issue too big was the RTTI contract,
  the metadata monoid and the flattening analysis. The first is optional, the
  third shipped as `Repeat`, and the second is now one monoid per parser rather
  than a triple per rule.

### How binding this is

[REVIEW.md](../../../doc/REVIEW.md#designs): the implementer is not bound, but
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

**Stage 1 — the protocol and the classical `bnf/ll1`** — shipped there, and
deleted with it; the rewrite set carries the protocol's decisions.

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

**Stage 2 — helpers and the first consumer**, answered by the rewrite set:

- [x] A combinator's scaffolding is read by a helper typed by shape —
      `joined` beside `join`, `items` in `fjs/ebnf/lib/json` — rather than a
      transformer per generated rule; a combinator's rules are the author's
      to map where the author holds them.
- [x] The JSON grammar has its mappings: `fjs/media/json/parser`, and
      `fjs/media/datajs/parser` over it.
- [ ] Take the all-`unit` map to [recognizer-backend](./recognizer-backend.md) as
      its payload-free mode — for the rewrite set, a parser with no mapping
      that builds no node. It is **not**
      [streaming-recognizer](../../media/json/todo/streaming-recognizer.md)'s
      `recognizerStep`, which is per-`U16`, depth-capped, and
      `fjs/media/json`'s own.

**Stage 3 — the classical `descent`** — retired with it; `fjs/djs/parser`
reads the rewrite set through `../ll1` and resolves `refs` in a second pass
(§9).

### Open questions

What is still open for the surviving backend:

- **Output-level streaming (§4)** — deferred until a consumer names its cost.
  A repetition mapped as a fold over its rounds is its first piece:
  [repeat-fold-mapping](../ll1/todo/repeat-fold-mapping.md).
- **A precheck of what each mapping receives**, the construction-time checks
  of §5 in the rewrite set's terms: [mapping-precheck](../ll1/todo/mapping-precheck.md).
- **The repository-wide `(state, item)` argument.** `todo/flow.md` has
  `(state, item)`; `Accumulator` is the other way round. Unifying them is the
  repository's call, not this issue's.

### Related

- generic-parser-metadata — the classical backends' metadata contract,
  retired with them; the rewrite set's metadata channel is
  [`../ast`](../ast/README.md).
- [43. Stateful parser](./043-stateful-parser.md) — input-side `init`/`append`/`end`.
- [`todo/flow.md`](../../../todo/flow.md) — the `Transducer` operator
  `RepeatTransformer` follows; composition and stage fusion belong there.
- [`fjs/types/list/types.ts`](../../types/list/types.ts) — `Accumulator`, which
  `RepeatTransformer` is.
- [`fjs/common/monoid`](../../common/monoid/module.f.mjs) — the `Monoid<T>` this
  issue's classical factory took at construction. Note its `fold` is
  *balanced*, so it must not be reused for a `reduce` that is not associative.
- [`fjs/djs/parser`](../../djs/parser/module.f.mjs) — the rewrite set over
  the module grammar, with the names resolved in a second pass.
- [recognizer-backend](./recognizer-backend.md) — the payload-free mode the
  all-`unit` map supplies.
- [layered parser](./layered-parser.md) — each layer is one grammar plus one map.
- [unicode-rules](../unicode/todo/unicode-rules.md) — not blocking; it changes which rule
  *values* a grammar has, not any spelling.
- [parser-serializer-restructure](../../../todo/parser-serializer-restructure.md)
  — the media/grammar boundary.
- [`../ast`](../ast/README.md) — the AST contract, `Ast<R, I, O>`.
