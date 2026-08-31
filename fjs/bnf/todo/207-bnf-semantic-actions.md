## 207. BNF rule transformers: one shape per rule kind

**Priority:** P3
**Status:** open

> **This is a rewrite.** The previous design attached *semantic actions* to
> functional `Rule` values (`mapRule`), evaluated them as a fold **over a
> materialized AST**, and typed the grammar↔action boundary with RTTI schemas
> checked by `subset` at grammar instantiation. It was blocked on the alphabet
> split, carried an open question it could not answer (§5.3: what to do with a
> boundary `subset` cannot prove), and had grown large enough that it was marked
> "to be split".
>
> This version keeps the goal and replaces the mechanism: a transformer says
> what a rule builds from its children, in **one shape per data rule kind**,
> keyed by the rule value it belongs to, applied by the matcher backends
> themselves. It never materializes the AST, it unblocks (§11.1), and it does
> not need RTTI to be useful. It is one design again, so the split is off.
>
> **A note on the four kinds.** An intermediate draft had a single uniform
> `RuleTransformer` folding one child at a time. That shape cannot type a
> child — a uniform `update`'s item is the union of everything any rule
> produces, which is `unknown` — so every child type in a map was an unchecked
> annotation, and review found the same class of bug in the worked example three
> times running. Splitting by kind makes the children's types come from the
> rule's own shape, lets construction check that an entry's kind matches its
> rule's, and leaves the `init`/`update`/`end` fold where it is actually needed:
> `Repeat`, the one kind whose size the grammar does not bound (§12).
>
> **One change reaches shipped code before any transformer does.** Every kind
> carries a metadata channel `M`, and both backends implement it — so
> `fjs/bnf/ll1`'s leaf becomes `Meta<CodePoint, M>`, the one `fjs/bnf/descent`
> already has. That is a breaking change to `ll1`'s public types with no caller
> outside its own proofs, and it deletes two workarounds that exist only because
> the two backends disagreed about their leaf (§7).
>
> **The three decisions that gated implementation are made.** Refusal is an
> engine-level channel, each map entry declares its child shape as data, and
> silent children are a combinator's job rather than a protocol change. Each was
> settled by writing §10's worked map both ways and compiling it; the evidence
> is in Tasks, stage 0.

### Problem

Parsing a `RuleSet` yields a generic AST (`Ast<L>` in
[`../matcher/types.ts`](../matcher/types.ts)) — a tree of `{ tag, sequence }`
nodes over leaves. Every consumer that wants a domain value has to walk that
tree afterwards, and each one writes the walk again:

- `fjs/djs/parser/module.f.mjs` parses DJS with `descentParserRuleSet` and then
  spends ~200 lines recovering values from the AST: `slot`, `keyOf`,
  `descendantsTagged` (a search, because an array's elements are *not* its
  direct children — they sit inside the option/repeat scaffolding), and
  `foldValue`, which needs its own explicit stack so deep nesting does not
  overflow the JS one.
- `fjs/bnf`'s own example grammars can be *matched* but not *evaluated*: a
  grammar that describes JSON produces an AST, and turning that into a value to
  check against a test vector is another hand-written walk.
- A BNF backend cannot answer *"does this input match?"* without building the
  whole AST first ([recognizer-backend](./recognizer-backend.md)), because the
  AST is built whether or not anyone wants it.

**Not in this list: `fjs/media/json`.** Its codec keeps a hand-written tokenizer
and container-stack parser *by decision* —
[parser-serializer-restructure](../../../todo/parser-serializer-restructure.md)
settles that "the media codecs take no runtime dependency on `fjs/bnf`", and
names it one of three things not to reopen. So the JSON grammar's role stays
what that plan gives it: spec text, plus proof-covered examples under
`fjs/bnf/**`. This issue makes those examples able to produce values; it does
not make them a codec (§11.6).

Three costs, one cause. The AST is **mandatory** (a document of *n* symbols
costs O(*n*) nodes even for a yes/no question), it is **anonymous** (a node
records the variant tag that matched but not the rule that produced it, so a
post-hoc walk cannot dispatch on rule identity and has to re-derive it by
position or by searching), and it is **complete before anything else starts**
(so nothing downstream can be incremental).

A rule that could say what to build would remove all three.

### Proposal

#### 1. The protocol

A transformer says what a rule builds from its children. There is **one shape
per data rule kind**, not one shape for all four, and each carries a metadata
channel `M` alongside the value:

```ts
type Meta<T, M> = readonly[T, M]
type Branch<C> = { readonly [K in keyof C]: readonly[K, C[K]] }[keyof C]
type Out<T, M> = Result<Meta<T, M>, string>   // the refusal channel — §6

type TerminalTransformer<M, T> = (v: Meta<CodePoint, M>) => Out<T, M>
type SequenceTransformer<M, C extends readonly unknown[], T> = (v: Meta<C, M>) => Out<T, M>
type VariantTransformer<M, C, T> = (v: Meta<Branch<C>, M>) => Out<T, M>
type RepeatTransformer<M, C, S, T> = {
    readonly init: S
    readonly update: (state: S, c: Meta<C, M>) => S
    readonly end: (state: S) => Out<T, M>
}
```

Every kind returns `Out<T, M>`: a value with its metadata, or a **refusal**.
That is the engine-level refusal channel of §6, and an author who never refuses
never writes it — the §9 helpers wrap in `ok`.

- **`TerminalTransformer`** receives the one symbol the rule matched, with its
  metadata. `Meta<CodePoint, M>` is the **leaf**: a symbol paired with what the
  layer below knows about it. That is not a new shape —
  `fjs/bnf/descent`'s `CodePointMeta<M>` is `readonly[CodePoint, M]`, which is
  `Meta<CodePoint, M>` exactly, so a terminal transformer's parameter is that
  backend's shipped leaf type. **Both backends carry it** — §7.

  **The symbol type is `CodePoint`, written concretely and not as a free
  parameter.** Both backends use it today, so parameterizing the protocol by an
  alphabet now would add a type argument to `Transformer`, `TransformerMap` and
  `transformers` for a generality nothing yet supplies.
  [The alphabet split](./unicode-rules.md) is what introduces it, and when it
  lands the change is mechanical: `CodePoint` becomes a parameter here and
  threads through those four.
- **`SequenceTransformer`** receives its children as a **typed tuple**. A
  `Sequence`'s arity is fixed and known from the `RuleSet`, so there is nothing
  to stream and no state to keep — the engine collects the items and calls once.
  The arity is also declared to the map as data, so construction can compare it
  against the rule's (§5, §9).
- **`VariantTransformer`** receives the branch name paired with that branch's
  value, and `C` is a record from branch name to value type, so `Branch<C>`
  narrows: matching on the name narrows the value. The branch names are
  likewise declared as data and checked against the rule's.
- **`RepeatTransformer`** is the only kind that keeps state, because a
  repetition is the only kind whose size the grammar does not bound. It is the
  `init`/`update`/`end` fold-as-data this repository already ships (§12) —
  `fjs/types/list`'s `Accumulator` exactly — and it is here rather than
  everywhere because this is where it earns its keep.

**Why four shapes and not one.** A single `RuleTransformer` whose `update` took
one child at a time is expressible — it is what an earlier draft of this issue
proposed — and it costs three things the split recovers:

- **Typed children.** A uniform `update` folds children one at a time, so its
  item type is the union of everything any rule can produce, which is `unknown`.
  Every child type in a map was then an annotation the author wrote and nobody
  checked, invalidated silently whenever the grammar's sequence changed under
  it. Here the types come from the rule's own shape: `C` is a tuple for a
  sequence and a record for a variant.
- **Kind agreement.** The `RuleSet` says which kind each name is, so supplying a
  `RepeatTransformer` for a `Sequence` is a construction-time error (§5). A
  uniform shape fits every rule by definition and can never catch it.
- **State only where it is needed.** Three of the four kinds are plain
  functions. The existential state of §5 exists for `Repeat` alone.

**A tag is a variant's business and no one else's.** The uniform version paired
every child with an `AstTag` that was `undefined` except under a variant. Only
`VariantTransformer` receives a name now, and it is paired with the value in
**one** parameter rather than passed beside it — not for symmetry but because
TypeScript will not otherwise correlate them. Written
`<K extends keyof C>(k: K, v: Meta<C[K], M>) => …`, matching on `k` leaves `v`
at the union of every branch type and forces a cast in the one place the design
is trying to make safe; destructuring a single `readonly[K, C[K]]` union
narrows. That is also what
[uncurry-accumulator-types](../../types/function/todo/uncurry-accumulator-types.md)
and the `StateScan` uncurrying in
[#763](https://github.com/functionalscript/functionalscript/pull/763) are
about: data belongs in one parameter, not spread across several.

**`M` is any additional information, not a source span.** It is the channel a
layer uses to carry what the value channel cannot. A tokenizer's output symbol
`n` says only "a number is here"; *which* number rides in `M`, and the next
layer's terminal transformer reads it straight off its leaf. Source ranges are
one instance, lexemes another, and `null` — nothing at all — is what a caller
that wants none instantiates. This replaces
the previous design's mandatory `(leaf, merge, empty)` monoid merged into every
node with a channel that is generic in what it carries (§7).

**How a parent's `M` is produced: a `Monoid<M>` supplied at construction.** A
sequence transformer receives one `M` for the whole tuple, so the engine
combines its children's. That is
[`fjs/common/monoid`](../../common/monoid/module.f.mjs)'s shipped `Monoid<T>` —
identity plus an associative operation — passed to `transformers` once rather
than declared per rule. The identity is what an empty `Sequence` and a
zero-round `Repeat` produce, so every kind is total without a special case, and
a caller that wants no metadata picks `M = null` and the trivial monoid. A
transformer's *output* `M` is its own to choose: it may forward what it was
handed, replace it, or return the identity.

The state a `RepeatTransformer` keeps stays **plain data**, which is what
[`todo/flow.md`](../../../todo/flow.md) requires of an operator and what §4.2
needs: a parser state that is a closure cannot be serialized, checkpointed, or
shipped to another process, and a resumable streaming parse is the point.

A rule with no entry is not transformed — it builds its AST node exactly as
today. That is what makes adoption incremental: a grammar with an empty map
behaves bit for bit as it does now.

Two invariants the engine owes the author, both checkable:

- **A transformer runs once per successful rule invocation**, and a
  `RepeatTransformer` sees one `update` per round in input order before its
  `end`. An invocation the parser abandons runs no transformer at all except a
  repetition's `update`s for rounds it had already completed, whose state is
  dropped with the frame; children that already succeeded inside it did run,
  and their values are dropped too.
- **Every name resolves, every kind agrees, and no tag is silently dropped.**
  The map's keys, each entry's kind, and the start rule are checked against the
  `RuleSet` when the parser is built (§5, §8), so a typo, a renamed rule, or a
  transformer written for the wrong rule kind fails at construction rather than
  as a transformer that never fires. The same pass refuses a map that transforms
  the branch of an *unmapped* variant, which is the one shape where partial
  adoption would lose a tag (§3).

#### 2. What each kind receives

| Data rule kind  | The transformer receives                                        |
|-----------------|-----------------------------------------------------------------|
| `TerminalRange` | `[leaf, M]` — the matched symbol and its own metadata            |
| `TerminalRange` matching EOF | `[EOF, identity]` — see below                       |
| `Sequence`      | `[[c₀, …, cₙ], merged M]`, one tuple slot per item               |
| empty `Sequence`| `[[], identity]`                                                 |
| `Variant`       | `[[branchName, value], that branch's M]`                         |
| `Repeat`        | `init`, one `update(state, [item, M])` per round, then `end`      |
| `Repeat`, zero rounds | `init` then `end` — no `update`                            |

Each `cᵢ` and each `item` is the child's *transformed* value where it has a
transformer and its AST node where it does not (§3).

**The `Result` is the engine's, not the child channel's.** A transformer returns
`Result<Meta<T, M>, string>` and the engine eliminates it before the parent sees
anything: an `ok` is unwrapped, so a child arrives as `T` and not `['ok', T]`;
an `error` never reaches the parent at all, because the parent is not called —
the refusal takes the place of the whole invocation (§6). So no transformer ever
matches on a child's `Result`, and both backends owe the same event stream. That
is why §10's callbacks destructure `xs` rather than `['ok', xs]`.

**A terminal that consumed the synthesized end-of-input symbol has no source
element**, so there is nothing to attach metadata to and no leaf in the AST —
that is [the EOF contract](../README.md#logical-eof-in-parser-input), and
`leafAt` in `fjs/bnf/matcher` is where it already lives: it yields the leaf
inside the physical input and an empty sequence at the end. An `eof` terminal's
default node is therefore `{ tag, sequence: [] }`, exactly as it is today.

Its transformer is still called, with the `EOF` symbol and the monoid's
identity. A terminal transformer is a function of one argument, so there is no
call to skip the way an `update` could be skipped, and not calling it would
leave the rule with no value at all. **So a terminal transformer for a rule that
can match EOF has to handle `EOF` itself** — `String.fromCodePoint(leaf)` on
`-1` is garbage, not an empty string. The default builder in §3 shows the
branch, and the `terminal` helper in §9 does not: a rule that can reach EOF
either writes the bare function or, far more usually, is `unit`, which is not
called at all.

The alternative — putting a `-1` leaf in the node — would contradict the EOF
contract, which is the one thing not on the table.

Rule identity is what the AST lacks and this has: the map is keyed by the rule
**value**, so a transformer always knows which rule it is building — the "key
observation" the previous design had to work around by walking the grammar and
the AST in lockstep. §5 says why the key is the rule rather than its name.

#### 3. What an unmapped rule builds

Its AST node, exactly as today — and the node builders are ordinary
transformers, so the AST is one instance of this protocol rather than a rival to
it. One per kind, which is itself the clearest statement of what the kinds are:

```ts
const terminal: TerminalTransformer<M, Ast<unknown>> =
    v => ok([{ tag: undefined, sequence: v[0] === EOF ? [] : [v] }, v[1]])

const sequence: SequenceTransformer<M, readonly unknown[], Ast<unknown>> =
    ([items, m]) => ok([{ tag: undefined, sequence: items }, m])

const variant: VariantTransformer<M, StringMap<Ast<unknown>>, Ast<unknown>> =
    ([[, node], m]) => ok([node, m])   // identity: a variant contributes no node

const repeat = (m: Monoid<M>): RepeatTransformer<M, unknown, _Rounds, Ast<unknown>> => ({
    init: [null, m.identity],
    update: ([items, acc], [item, im]) => [concat(items)([item]), m.operation(acc)(im)],
    end: ([items, acc]) => ok([{ tag: undefined, sequence: toArray(items) }, acc]),
})
type _Rounds = readonly[List<unknown>, M]
```

Their node is `Ast<unknown>`, because a child of an unmapped rule may itself be
transformed, so what a node holds is no longer only nodes and leaves. A
repetition accumulates as a `List`, which is also a small improvement on today's
sequence frame — that one spreads an array per item.

None of the four ever refuses — the AST is what a rule builds when nobody said
otherwise, so an unmapped rule cannot fail semantically. (`ok` here is the
`Meta`-shaped constructor, `<M, T>(v: Meta<T, M>) => Out<T, M>`; a bare
`<T>(v: T) => Result<T, never>` widens `[node, m]` to an array before the
contextual type reaches it.) Three further details
are the contract rather than the implementation's choice.

`terminal` stores the **whole leaf**, `v`, not the symbol `v[0]`. The AST is
`Ast<Meta<L, M>>` now that both backends carry metadata (§7), so a default that
destructured the pair and kept only the symbol would drop every per-code-point
position from every terminal node — and an empty-map parse would stop matching
`descent`, which is the one thing §3 exists to preserve.

`terminal` also **drops the leaf entirely at EOF**, because the EOF contract
says that node has none (§2). A default that appended the synthesized symbol
would change the AST for every grammar ending in `eof`.

And `repeat` carries the merged metadata in its own state, because it is the one
kind the engine cannot merge for: the others get their children all at once, a
repetition gets its rounds one at a time, so combining them is the fold's job.
That is why a `RepeatTransformer` written by hand takes the monoid (§9).

**The node's *tag* is an inherited attribute, and none of these four can supply
it.** A rule invocation is entered *with* a tag and the node it builds carries
that tag; a variant contributes no node at all, it re-enters its chosen branch
with the branch's tag, so `ll1` does not even allocate a frame for one — it
retargets the current task (`fjs/bnf/ll1/module.f.mjs`). Nest two variants and
the inner one overwrites: `{ outer: { inner: … } }` tags the node `inner`,
because each variant on the way down replaces the tag before the node exists.

A transformer is synthesized-only — it sees its children, never what it was
entered with — so no builder above can produce that. `variant` is therefore the
**identity**: it hands its branch's value up unchanged, which is exactly the
engine's "contributes nothing". The other three write `tag: undefined` as a
placeholder for a tag the engine supplies at entry.

So these four specify the **children** an unmapped rule's node holds, not its
tag. "The AST is one contract"
([`../README.md`](../README.md#the-ast-is-one-contract)) stays checkable two
ways: the `descentEquivalence` proof group in `../ll1/proof.f.mjs` pins the whole
empty-map parse, tags included, and a proof that these four produce the same
*children* pins the specification to the implementation on the part it actually
specifies.

A variant *with* a transformer does get a frame (`descent` already has one for
trying branches; `ll1` gains one) and its one tagged call — an addition to the
AST model, not a reimplementation of it, paid for only where it is used.

A transformed value sitting inside an untransformed parent is an opaque child of
that parent's node, so `AstSequence<L>` widens to admit it. For a sequence or a
repetition that costs nothing — those children carry no tag anyway (§2), so
there is nothing to lose.

**A variant is the one place where it would lose something, and that map is
refused.** An unmapped variant owns no node: the engine hands its branch's node
the tag and that node *is* the variant's. If the branch is mapped, there is no
node to tag, so the tag has nowhere to go at all — the unmapped variant would
silently stop building the AST §3 promises, and a transformed ancestor could not
tell which branch matched. So `build` refuses at construction when a
mapped rule is the branch of an *unmapped* variant, naming both rules: transform
the variant too, or drop the branch's transformer.

Refusing rather than repairing is the point. The engine could wrap the value in
`{ tag, sequence: [value] }`, but that node is not the one this grammar builds
today — the branch's own node is — so the repair would quietly change the AST
in the name of preserving it, which is worse than saying no
([DESIGN.md §10](../../../DESIGN.md#10-refuse-what-you-cannot-handle)). Both
endpoints stay legal: an empty map has no mapped rules to refuse, and an
all-`unit` map has no unmapped variants.

#### 4. Streaming

Three independent levels. Only the first is this issue's core; the other two
are what it makes possible, and both are named here because the protocol has to
be shaped to admit them.

**4.1 Fold-level (this issue).** A repetition's rounds are folded as they are
matched and every other kind's children are bounded by its arity, so nothing
accumulates that a transformer did not ask to keep. Memory is O(depth) frames,
plus the live states of the repetitions along the spine, plus the partly
collected children of the fixed-arity rules on it — and that last term is
bounded by the grammar rather than the input. A 1M-element array is one
repetition frame whose state the author chose; a map that answers `unit` for
every rule keeps nothing at all, so the whole parse is O(depth) whatever the
input size — which is what [recognizer-backend](./recognizer-backend.md) wants
from a payload-free backend and cannot get while the AST is mandatory.

This is also where the AST's O(*n*) cost goes away rather than being paid and
discarded: an untransformed rule allocates its node, a transformed one does not.

**Only a `Repeat` streams, and only a `Repeat` can be quadratic.** The other
three kinds have an arity the grammar fixes, so the engine collects their
children and calls once — there is nothing to stream and no state to grow. A
repetition is the one kind whose size is the input's, and a `RepeatTransformer`
whose `update` spreads an array per round makes its rule quadratic in the number
of items: the exact trap `descent`'s `_Items` and DJS's `_FoldFrame.done`
comments already record. Accumulate with `List` (or `Vec`) and flatten in `end`;
the helpers in §9 do this so most authors never touch it.

That is not a narrowing of what 4.1 promises. Memory is still O(depth) frames
plus the live states along the spine, because a fixed-arity rule's collected
children are bounded by its arity and released as soon as it is built.

**4.2 Input-level.** [43](./043-stateful-parser.md) proposes
`init`/`append`/`end` over input chunks — the same trio this protocol uses, one
level up, and the shape `fjs/crypto/sha2` already ships (§12). It composes with
this protocol directly, because the parser state is a value: the frame stack,
each frame's `(rule name, state)`, and the cursor. Nothing here is mutable and
nothing is a closure, so the state can be snapshotted, resumed, forked — or
serialized and resumed elsewhere, which is the property
[`todo/flow.md`](../../../todo/flow.md) keeps operator state as plain data for,
and what an incremental re-parse would need later.

Bounded-memory input streaming is a **backend property, not a protocol
property**, and only `fjs/bnf/ll1` has it: it never backtracks, so a consumed
chunk can be released. `fjs/bnf/descent` backtracks arbitrarily far and must
retain input back to the oldest live rewind point; it gets streaming *output*
from 4.1 regardless.

**4.3 Output-level — not designed, and this is what it would take.** A fold
produces its value at the root's `end`, so a 1 GB document is a 1 GB value
unless the transformers discard. Getting results out *early*, without letting a
transformer perform effects (§6), needs a channel this protocol does not have.

An earlier draft proposed a read-only `partial(s)` returning the start rule's
state, with the caller draining records between chunks. It does not work, and
the reason is worth keeping: states are immutable, so a caller that *reads* the
accumulated records has no way to hand back a state without them. Nothing is
freed, memory stays O(n), and the reading half alone buys nothing. The write
half is the whole problem, and it needs two things this design does not supply:

- **A typed drain** — `(rootState) => [emitted, rootState']`, folded back into
  the parser state. It only means anything when the start rule is a `Repeat`,
  since that is the only kind with a state to drain; and that state's type is
  its `S`, which `Transformer<M, T>` erases (§5), so it is `unknown` in and
  `unknown` out unless that erasure changes.
- **A rule for speculation.** Under `descent` a rewind can discard updates a
  caller has already drained, so draining is sound only where the parse cannot
  rewind past the drain point — always true under `ll1`, never guaranteed under
  `descent`.

The other way is flow's: give `update`/`end` an **output chunk**, which makes a
transformer a `Transducer` in full (§12) and is the same channel chaining needs.
Its cost is that every rule pays for a channel almost none of them use.

Neither is designed here, and neither should be until a consumer asks for it: a
recognizer wants no output at all (§4.1), and the value case is served by the
root's `end`. **What 4.1 and 4.2 promise does not depend on it** — bounded
memory over a stream is a property of what the transformers *keep*, not of an
emission channel.

**4.4 What each backend can promise.**

| | `fjs/bnf/ll1` | `fjs/bnf/descent` |
|---|---|---|
| Metadata channel `M` (§7) | yes, after this change | yes, shipped |
| Fold-level streaming (4.1) | yes | yes |
| Bounded-memory input (4.2) | yes | retains back to the oldest live rewind |
| A drained value can be un-drained by a rewind (4.3) | no | yes |
| Transformer may run on an abandoned branch | never | yes |

#### 5. Where it lives, and how the value gets out

In the shared matcher layer, not in a new pass over the AST and not twice.

Both backends are already the same machine: an explicit-stack loop whose frames
hold an `AstSequence` under construction, finished with `mrSuccess(tag, seq, pos)`
from [`../matcher/`](../matcher/). The change is to replace that
`AstSequence` with the invocation's collected children — or, for a `Repeat`,
its transformer state — and those constructor calls with the rule's transformer.
So:

- the four transformer types, the erased `Transformer` and `TransformerMap` go
  in `fjs/bnf/matcher/types.ts`, the four default builders (§3) in its
  `module.f.mjs`;
- each backend gains one entry point that takes a map (`transformers`/`build`
  below), and its frames carry `(rule name, collected children — or, for a
  `Repeat`, state)` where they carried an `AstSequence`;
- no third walk exists to desync from the other two.

**Where the existential is eliminated, and how little of it is left.** Only a
`RepeatTransformer` has a state, so a frame holds one whose type the map has
erased, and calling `update` on it is the one place a cast is needed — it is
what "this state belongs to this transformer" means, and the frame carrying the
rule name is what makes the claim checkable by eye. The other three kinds are
plain functions applied once to children the engine already holds, so nothing
about them is existential at all. Keeping the *name* in the frame rather than a
closure is also what keeps a suspended parse plain data: `(rule name, state)`
pairs and a cursor serialize, so §4.2's checkpoint is a real one.

That is the answer to what the previous design called "parser-neutral
evaluation" (its `Semantics<R>` algebra). The algebra is right; it belongs in
the layer the backends already share, and it should be a fold over children
rather than a `reduce` over a materialized child array — see §11.2.

**Threading states through frames is not enough to return one.** Both public
results are typed to the AST — `DescentMatchResult.ast` and `ll1`'s
`MatchResult[0]` — so a transformed root has nowhere to go. A transforming
parse needs its own entry point and its own result:

```ts
// the erased upper bound: tagged by rule kind, and carrying the child shape the
// author declared, so construction can check both against the `RuleSet`
type Transformer<M, T> =
    | readonly['terminal', TerminalTransformer<M, T>]
    | readonly['sequence', number, SequenceTransformer<M, never, T>]
    | readonly['variant', readonly string[], VariantTransformer<M, never, T>]
    | readonly['repeat', FRule, {
        readonly init: unknown
        readonly update: (state: never, c: Meta<never, M>) => unknown
        readonly end: (state: never) => Out<T, M> }]
    | readonly['unit']
// keyed by the rule value — reference identity, the `===` `toData` already dedups on
type Entry<M, T> = readonly[FRule, Transformer<M, T>]
type TransformerMap<M> = ReadonlyMap<FRule, Transformer<M, unknown>>

// `fjs/bnf/ll1`'s own shape: its remainder and its result. Its *input* is the
// shared leaf now, the same one `descent` takes (§7).
type Leaf<M> = Meta<CodePoint, M>
type TransformMatchResult<T, M> =
    | readonly['ok', Meta<T, M>, readonly Leaf<M>[]]  // matched, finished, nothing refused
    | readonly['refused', Refusal, readonly Leaf<M>[]]  // a transformer said no (§6)
    | readonly['no-match', Remainder<M>]     // rejected, or the input ran out (`null`)

type TransformMatch<T, M> = (s: readonly Leaf<M>[]) => TransformMatchResult<T, M>

// `M` is bound once, by the factory, for the helpers and the engine alike (§9)
const transformers: <M>(monoid: Monoid<M>) => Transformers<M>
// …whose `build` is the entry point:
//   build: (rest: TransformerMap<M>) => <T>(start: Entry<M, T>) => TransformMatch<T, M>
```

**Why a factory rather than a free `transformRuleSet(monoid)(map)(start)`.** `M`
appears in both an input and an output position of `Transformer<M, T>`, so it is
invariant and has to be pinned. A helper call like `terminal(c => …)` mentions no
metadata at all, so written free it infers `M = unknown` — fine inside a map with
a contextual type, and **not** fine for the start entry, which stands alone:
`Entry<unknown, T>` is not an `Entry<M, T>`, and the builder rejects it. Binding
`M` once at `transformers(monoid)` makes every helper it returns, every entry, and
`build` agree by construction, with no type argument written anywhere. That the
monoid was already a once-per-parser thing (§1) is what makes this the natural
place to bind it.

**Every kind erases to that bound.** A terminal, sequence or variant transformer
is a function whose parameter is `Meta<C, M>` for its own `C`, and
`Meta<never, M>` is assignable to every one of those, so each erases however its
children are typed; a `RepeatTransformer<M, C, S, T>` erases for every `S`. `T`
appears only in an output position in each arm that has one, so
`Transformer<M, T>` stays covariant in `T`. No `any`, and no cast to build a map.

**The start rule's value type comes from its own entry, and nothing else.** The
map is a `ReadonlyMap` keyed by rule *values*, so there are no literal keys for a
conditional type to read — and none are needed. `build` takes the start rule's
entry separately, typed `Entry<M, T>`, and the parse's result is
`TransformMatch<T, M>` with that same `T`.

That is smaller than what it replaces and loses nothing. An earlier revision
keyed the map by rule *name* and recovered the output with a conditional type
reading `Map_[K]`. It worked, but only if the author wrote `satisfies` and never
an annotation — an annotation made every declared key optional and present in
`keyof Map_` at once, and *every* start rule then resolved to `never`: a map that
compiled and a value that did not. With the type coming from one entry, there is
no conditional to defeat, no annotation trap, and no `never` to explain.

**`unit` is the fifth arm and it is not a kind.** It is the transformer that
keeps nothing, so it has no children to be typed by and no state — which makes
it the one entry that fits any rule. The engine does not call anything for it:
it yields `[undefined, identity]` directly. That is what makes the all-`unit`
recognizer of §10 allocation-free in the strong sense — not "builds cheap values
and discards them" but "makes no call and holds no state" — and it is also why a
rule that can match EOF is almost always `unit` rather than a terminal
transformer that has to branch on `-1` (§2).

**`unit` is declared `Transformer<M, undefined>`, not the bare `['unit']`
literal**, so that `entry(rule, unit)` infers `Entry<M, undefined>`. The literal
type contains no occurrence of `entry`'s `T`, so there is nothing to infer from
and `T` would fall back to `unknown` — a start matcher typed
`TransformMatch<unknown, M>` whose value is always `undefined`. The arm itself
stays `readonly['unit']`, which is why the declaration is sound: it is assignable
at any `T`, and `undefined` is the honest one, since a `unit` entry kept nothing.

**The tag is there because nothing else can carry the kind.** Erased, a
terminal, a sequence and a variant transformer are the *same function type* —
each takes one argument that `Meta<never, M>` is assignable to — so without a
tag a map could supply a terminal transformer for a variant rule and neither the
type nor a runtime inspection would notice: at runtime all three are just
functions. It would fail as a variant handing its `[branchName, value]` pair to
a callback expecting a leaf. The tag is written by the §9 helpers, never by
hand, and it makes the kind visible exactly where the rule is available to
compare it against.

**The child shape rides beside it, for the same reason.** `C` is a type
parameter and is erased, so a sequence's arity and a variant's branch names
would otherwise reach no check at all — an author's claim that a grammar change
could silently invalidate (§8). Each entry now carries it as data: a sequence's
arity, a variant's branch names, a repetition's repeated rule. The §9
helpers take it, and the type system makes it self-checking rather than a second
thing to keep in step — `seq`'s parameter is typed `C['length']`, so a `3` beside
a four-slot tuple is a compile error, and `variant`'s is `keyof C & string`, so a
name absent from the branch record is one too.

**Seven things are resolved when the parser is built**, all O(rules) and none of
them able to be incomplete:

- **Every keyed rule is reachable from the start rule.** Keying by value makes a
  *misspelled* key impossible — there is no spelling — but not a stale one: a
  rule dropped from the grammar while its entry stayed behind is a transformer
  that never fires, and looks like a parser bug. `toData` already visits every
  reachable rule value, so this is a set difference.
- **Every entry's kind agrees with its rule's.** The entry's tag against the
  `RuleSet`'s kind, all four ways — `unit` excepted, which matches any kind
  because it reads nothing. This is a *construction*-time check and not a
  type-level one, and it cannot be otherwise: the map's type does not know the
  `RuleSet`, so a terminal transformer supplied for a variant rule type-checks
  perfectly and is caught only here. The uniform protocol of the earlier draft
  could not catch it at all, at either time, because one shape fits every rule
  by definition (§1).
- **Every entry's declared child shape agrees with its rule's.** A sequence's
  arity against the rule's item count, a variant's branch names against the
  rule's branch set — in both directions, so a branch the grammar has and the
  map forgot fails here too — and a repetition's declared repeated rule against
  the rule's. This is what closes the gap §8 used to end on: a grammar edit that
  invalidates a map now fails at construction instead of calling a callback with
  a shape it did not expect.
- **`start` is a rule value**, so it cannot be mistyped either — but it must be
  a rule of the grammar being built, and that is checked here.
- **`start`'s rule has no entry in `rest`.** The two are supplied separately and
  nothing in the types stops a map from also containing the start rule, at an
  unrelated `T`. An implementation would then have to either honour the map
  entry and break the `TransformMatch<T, M>` it advertised, or override it and
  give a *recursive* invocation of that rule different semantics from the root
  one — both silent. Refusing the collision is the only answer that keeps one
  rule meaning one thing.
- **No mapped branch sits under an unmapped variant.** The tag would have
  nowhere to go, so that map is refused here too, naming both rules — §3 is
  where the reasoning is.
- **Every branch a mapped variant declares has an entry** — the same rule from
  the other side. §10 states it as an obligation ("declaring a type for a
  variant means transforming all of it"), and without this check nothing
  enforced it: a variant could declare `noItems` in its branch list, omit the
  entry, pass every other check, and hand its callback the branch's default AST
  node where `C` said `readonly number[]`. A silently wrong value, which is what
  §6 exists to prevent. The alternative — letting the author type such a branch
  as an AST value in `C` — is worse: it puts the engine's node shape in the
  author's value domain for no gain, since the point of mapping a variant is to
  stop dealing in nodes.

**A parse that did not finish has no value, and the type says so.** The root's
transformer never runs when the grammar rejects the input — a failure propagates
straight out, past every frame — so there is no `T` to report and none is
invented. The same holds when the input **runs out** mid-rule: no transformer on
the spine is called, rather than a sequence transformer being handed a tuple
that is missing its last items (§6 — a transformer is total for the shapes its
rule can produce, and a truncated sequence is not one of them; with children
typed as a tuple this is now a type error waiting to happen rather than only a
contract). Both are `no-match`, told apart by the remainder: where matching
stopped, or `null` for input that ended first.

**That is why the result is a tagged union rather than a tuple with a boolean.**
A `[value, success, remainder]` tuple mirroring `MatchResult` can spell states
this design forbids — a refusal beside `success: false`, a value beside a `null`
remainder — and a type that admits what the contract rules out has to be
explained twice and checked by hand. Here each state carries exactly what it
has: only `ok` carries a value, and `ok` and `refused` alike promise a
non-`null` remainder, because both mean the *grammar* matched and finished. It
reads as `Result` does elsewhere in the repository, so nothing new is invented,
and `parserRuleSet`'s own `MatchResult` is untouched.

`refused` carries a physical remainder for the same reason `ok` does: it can
only happen after the matched rule finished and ran its transformer, and a parse
that ran out of input mid-rule never reaches one at all — that is `no-match`
with a `null` remainder. Using `Remainder<M>` there would re-admit
`['refused', reason, null]`, which is precisely the contradiction this union
exists to rule out.

The root's `M` comes out with its value, which is the whole metadata channel
arriving where a caller can use it: the merged span of the document, or whatever
the start rule chose to publish.

The AST path is unaffected either way — an unmapped rule's node is the engine's
own (§3), so `parserRuleSet` still reports the partial node it always has.

**The shape above is `ll1`'s, not a shared one — but less of it is `ll1`'s than
before.** The *input* is now shared: both backends take `readonly Leaf<M>[]`,
because both carry metadata (§7). What stays each machine's own is how it
reports where it stopped. `fjs/bnf/descent` returns
`{ ast, success, idx, failure? }` rather than a remainder tuple — its
furthest-failure record is the reason that backend's result is an object — and
its transforming entry keeps all of that, replacing `ast` with the same three
outcomes. Two backends, one input type, two result types, one protocol: the
split [`../matcher/README.md`](../matcher/README.md) already draws between what
is shared and what is each machine's own, with the leaf moving from the second
column to the first.

The start rule moves into the builder as a typed `Entry`, and that is what
connects the map to the parse's type — no cast, no conditional, and no
unconstrained type parameter for a caller to fill in by annotation. A start rule
with no transformer is passed as `[rule, unit]` and yields `undefined`; a caller
who wants the AST uses `parserRuleSet`.

The remainder keeps its present meaning in every case: what is left where the
match stopped, and `null` where the input ran out. It is a suffix of the input,
so it is leaves rather than bare symbols now — the metadata a caller passed in
comes back with whatever it did not consume.

**`parserRuleSet` keeps its own native path**, and does *not* become this
machine with an empty map. It cannot: this machine is parameterized by `M` and
needs a `Monoid<M>` — the default `repeat` builder combines its rounds'
metadata with it (§3) — while `parserRuleSet` has no use for one and cannot
conjure an identity for an arbitrary `M`. Giving it a monoid parameter would tax
every AST caller for a channel none of them read.

That is not a compromise, because §3 already said the four builders are a
*specification* rather than what the engine runs: the untransformed path
allocates no frame for a variant and applies tags at rule entry, neither of
which a synthesized builder expresses. So the relationship is the one a
specification has to an implementation — proved, not asserted by construction —
and the stage-1 proof is where it is discharged.

What does change for `parserRuleSet` is its leaf: it builds its AST over
`Meta<CodePoint, M>` like everything else (§7), generic in `M` and taking no
monoid. That is a breaking type change whose only callers are `ll1`'s own
proofs.

#### 6. Backtracking, purity, refusals

A transformer **must be pure and total**: same inputs, same outputs, no effects,
no `throw` (the repository has no `try`/`catch`). Two reasons, and the first is
not negotiable:

- `descent` speculates. A branch it abandons may already have run transformers
  for children that succeeded inside it, and a repetition inside it may already
  hold state from completed rounds. Because that state is immutable, discarding
  it is dropping a frame — no undo protocol, which is the property that makes
  this design work under a backtracking parser at all, and the reason effects
  cannot be allowed.
- A transformer that is expensive multiplies backtracking cost. Under the four
  kinds this is sharper than it was: a terminal, sequence or variant transformer
  runs exactly once, when its rule succeeds — including inside an alternative a
  later sibling then fails — and a repetition's `update` runs per round. So
  under `descent` all of it wants to be cheap, and only `ll1` guarantees no
  transformer runs on work that is thrown away.

**Totality is now partly the type system's job.** A transformer must be total
for the shapes its rule can produce, and with children typed as a tuple (a
sequence) or a named union (a variant), most of "the shapes its rule can
produce" is written down: a variant transformer that forgets a branch fails to
compile rather than falling through at runtime, and a sequence transformer
cannot destructure a position its rule does not have. What is left to the
contract is what the types still cannot say — that a truncated sequence never
reaches a transformer at all (§5).

**Refusal is a channel, and it is the engine's.** Every kind returns
`Out<T, M>` = `Result<Meta<T, M>, string>` (§1), so a rule that must reject a
value it can parse but cannot represent — `1e999`, a duplicate `__proto__` key,
an unresolved `const`, everything
[DESIGN.md §10](../../../DESIGN.md#10-refuse-what-you-cannot-handle) says to
refuse rather than answer with a plausible value — returns an `error` and stops
there.

**The alternative was tried and measured.** An earlier revision put the error in
the transformer's own `T` and gave the protocol no channel at all — a refusing
rule declared `Result<number, string>` as its value and every ancestor dealt
with it. That is elegant on paper and expensive in fact: written out against
§10's twelve-rule grammar, one refusing rule put a `Result` into six of the
eleven others, forced the list-building rule to sequence its children with an
`allOk` that needed explicit type arguments, forced an empty branch to return
`ok([])` so its variant's arms agreed, and introduced two type aliases that
existed only to name the plumbing. The engine channel deletes all of it: §10's
map now differs from the no-refusal version in exactly one entry.

**What a refusal carries is split between the two who know something.** A
transformer returns a `string`: the reason, which is the only part it knows —
it has no idea what it is called or where in the input it ran. The engine knows
both, and attaches them, so what reaches the caller is structured:

```ts
type Refusal = {
    readonly rule: string     // the data-`RuleSet` name whose transformer refused
    readonly at: number       // the physical index its invocation ended at
    readonly message: string  // what the transformer said
}
```

That is the `refused` payload of §5's result. The alternative — a bare `string`
all the way out — would make a semantic refusal the *least* diagnosable outcome
a parse has, next to a syntactic failure that already reports a position and an
expected set. It also means a grammar gets refusal positions **without** having
to carry them in `M`: the engine has the cursor. `M` remains free for what only
the layer below knows (§7).

**A refusal never changes what the grammar accepts.** Aborting the parse at the
refusing rule would be wrong, and `descent` is where it shows: a child can
succeed and run its transformer inside a branch that a *later* item then fails,
so the parser moves on to another alternative. Try `[specialNumber, 'x']` before
`[plainText, 'y']` on an input ending in `y`: if `specialNumber` refuses,
aborting rejects an input the grammar accepts, and which inputs parse becomes
branch-order dependent. Restricting transformers to non-speculative rules is the
other way out, and it is worse — it would make the protocol mean something
different on each backend.

So a refusal is a **value**. The refusing invocation's result is the error; it
takes the place of that invocation's value, the enclosing rule is not called,
and it travels up the spine unchanged, so the first refusal is the one reported.
Matching continues exactly as it would have, and a branch the parser abandons
drops its refusal like any other value it produced.

**`ll1` needs this rule too, for a reason of its own.** It is not merely
inheriting a constraint from the backtracking backend: a refusal is not final
when it happens even where nothing can be abandoned, because a *later sibling
can still fail syntactically*. Match `[specialNumber, 'x']` on input where
`specialNumber` matches, its transformer refuses, and the next symbol is not
`x`: the sequence does not match, so the honest answer is a syntax failure with
no value (§5), not a semantic error about a parse that never happened. Carrying
the refusal as a value gets both right — it is discarded with everything else
the failed match produced.

An author who wants a refusal to be an ordinary value rather than an outcome can
still put `Result` in their own `T`; nothing prevents it. What changed is that
they no longer *must*.

#### 7. Metadata: both backends carry it

`M` is the channel, it is generic in what it carries, every transformer has it
(§1), and **`fjs/bnf/ll1` and `fjs/bnf/descent` both implement it**. That is the
one structural change from the earlier draft, which had no metadata channel at
all and said none was needed.

**It is not a source span.** A span is one instance. The motivating case is a
layered parse: a tokenizer's output symbol `n` says only *that* a number is
here, and *which* number rides in `M`, so the next layer's terminal transformer
reads the value straight off its leaf. Lexemes, positions, a token's precomputed
payload, and `null` — nothing at all — are all the same channel at different
instantiations.

**The leaf is `Meta<L, M>` in both backends, and that is the change.** Today
they disagree: `descent` consumes `readonly CodePointMeta<T>[]` and builds
`Ast<CodePointMeta<T>>`, while `ll1` consumes `readonly CodePoint[]` and builds
`Ast<CodePoint>`. The shared layer is already parameterized for it —
`Ast<L>`, `AstSequence<L>` and `AstResult<L, P>` in
[`../matcher/types.ts`](../matcher/types.ts) take the leaf as a parameter, and
that module's own comment says a backend picks `L` for "the code point alone, or
the code point with metadata". So the split is `ll1`'s hard-coded choice, not a
contract, and closing it is a rename plus a type parameter rather than a new
mechanism.

Concretely, in `fjs/bnf/ll1`:

- `Match` becomes `<M>(name: string, s: readonly Meta<CodePoint, M>[]) => MatchResult<M>`;
- `MatchResult<M>` is `readonly[Ast<Meta<CodePoint, M>>, boolean, Remainder<M>]`
  and `Remainder<M>` is `readonly Meta<CodePoint, M>[] | null`;
- `_Position`, `_Result`, `_SeqFrame`, `_RepeatFrame` and `_Items` in
  [`../ll1/private.ts`](../ll1/private.ts) are written over `CodePoint` and
  become `Meta<CodePoint, M>`.

And `CodePointMeta<T>` moves from `fjs/bnf/descent/types.ts` to the shared
`fjs/bnf/matcher/types.ts` as `Meta<T, M>`. That module's doc comment currently
says the metadata leaf "stays here rather than moving to the shared layer"
*because* "preserving metadata per consumed code point is what distinguishes
this backend" — which stops being true the moment `ll1` does it too, so the
comment is part of the change rather than a casualty of it.

**This is a breaking change to a shipped public type whose only callers are its
own proofs.** `fjs/djs` uses `descent` alone; nothing outside `fjs/bnf/ll1`
imports `ll1`. And the proofs get *simpler*, which is the useful signal:

- `bothBackends` in [`../ll1/proof.f.mjs`](../ll1/proof.f.mjs) feeds the two
  backends different inputs today — `toArray(map(mapCodePoint)(cp))` to
  `descentParser` and bare `cp` to `parser` — purely to bridge the leaf types.
  One input serves both afterwards.
- `showAst` in [`../testlib.f.mjs`](../testlib.f.mjs) is typed over
  `Ast<number | readonly[number, unknown]>`, a leaf union that exists only
  because the backends disagree. It collapses to one case.

**The adapters already exist, and so does a real use.** `fjs/djs/tokenizer`
ships both halves against `descent`:

- `descentParserCpOnly` — `cp => [cp, undefined]` over the input, the "I want no
  metadata" wrapper. It is the template for whatever `ll1` offers callers that
  do not want `M`, and it generalizes rather than being copied.
- `metadataScan` — a `StateScan` pairing each code point with the
  `{ path, line, column }` *before* it is consumed, producing
  `CodePointMeta<TokenMetadata>`. That is the `M` channel in production, built
  by hand, today.

**A parent's `M` is the monoid's, its own output `M` is its choice.** The engine
combines the children's with the `Monoid<M>` given at construction (§1, §5) and
hands a sequence transformer one `M` for its whole tuple; what the transformer
*returns* is unconstrained — forward it, replace it, or return the identity. The
identity also covers the empty sequence and the zero-round repetition, so no
kind needs a special case.

DJS's shipped `TokenMetadata` is worth checking against that, because it is a
*per-symbol position* and not obviously combinable. It is: take `M` as
`TokenMetadata | undefined`, identity `undefined`, and the operation "leftmost
defined". That is associative with a two-sided identity, and it gives every rule
the position of its first symbol.

**Refusal positions are *not* what this is for**, and that is a change from an
earlier revision. With the engine-level refusal channel (§6) the engine attaches
`{ rule, at, message }` from its own cursor, so a grammar does not have to carry
positions in `M` to get diagnosable refusals. `M` is free for what only the
layer below knows — a token's payload, a lexeme, a range a caller wants for its
own reasons.

**One `M`, and a payload coexists with a mergeable field inside it.** The
obvious worry is that these are two different things: a tokenizer's decoded
number is consumed at the leaf and no parent wants it merged, while a position
does want merging. They do not need two channels, because `M` may be a product
and a monoid on a product is componentwise:

```ts
type M = readonly[Pos, Payload]                    // Pos = a range, Payload = a token's value
const monoid: Monoid<M> = {
    identity: [undefined, undefined],
    operation: ([p0, q0]) => ([p1, q1]) =>       // componentwise leftmost-defined
        [p0 === undefined ? p1 : p0, q0 === undefined ? q1 : q0],
}
```

Both components are "leftmost defined", which is associative with a two-sided
identity — so this is a monoid, and every field of a product `M` must be one for
the same reason.

**The monoid does not stop a payload from propagating, and it must not try.** An
earlier draft made the payload component's operation constantly the identity, so
that no parent would inherit a token's value. That is associative but **not
unital** — `operation(identity)([pos, payload])` gives `[pos, undefined]`, not
the original — so it is not a monoid at all, and its behaviour would depend on
grammar shape: a one-child sequence would fold `identity ⊕ m` and lose the
payload, while a variant forwarding its branch's `M` would keep it.

What stops the propagation is the **transformer**, which §1 already puts in
charge of its own output `M`: the terminal transformer that consumed a payload
returns an `M` without it. That is a per-rule decision made where the knowledge
is, rather than a law the carrier cannot satisfy. A grammar that does not bother
simply carries a stale payload upward, which is imprecise and harmless — nothing
reads it.

**So the design commits to one `M`** — a second, unmerged channel would change
`Meta`, every transformer signature, the erased map representation and the
matcher API, and it is not needed to express this.

This is the previous design's `(leaf, merge, empty)` monoid, kept but demoted:
it is supplied once per parser rather than declared per rule, it is generic
rather than fixed to spans, and a grammar that wants none instantiates it
trivially. What it is *not* is optional — the earlier draft made an automatic
span a `span(inner)` helper (§9) and left `M` out of the protocol, which could
not work, because a helper wrapping one transformer has no access to its
children's metadata unless the protocol already threads it.

For the [layered parser](./layered-parser.md) this is the mechanism it wanted,
now named: each layer is one grammar plus one transformer map, a layer's output
symbol is its value channel, and its payload is `M`. `fjs/djs` already runs
exactly this shape by hand, and with both backends carrying `M` a layer may be
matched by either one.

#### 8. Types

The previous design proved that TypeScript cannot type a *functional* cyclic
grammar: the `: Rule` annotations that break the inference cycle erase the
structure an action would be inferred from. That result stands and is not worked
around here — it is sidestepped, because nothing in this design infers a
transformer's types *from* a rule's type. An entry pairs a rule value with a
transformer whose types the author writes; the rule contributes identity, not
structure. There is no cycle to break.

So each transformer is checked where it is written, and the parse's value type
comes from the start entry (§5) rather than from a table of rule names. What an
author declares is:

- **the value a transformer produces**, which is just its callback's return
  type;
- **the types of that rule's children**, as the tuple `C` of a sequence or the
  branch record of a variant.

The second is the claim worth being exact about, and §5 already narrows it. `C`
is a type parameter and is erased, so the *shape* is carried as data alongside
it and compared with the grammar at construction — a sequence's arity, a
variant's branch names in both directions, a repetition's repeated rule. The
declaration cannot drift from `C`, because the type system ties them:

- **`seq`'s arity parameter is typed `C['length']`.** A tuple type's `length` is
  a numeric literal, so `seq(3, …)` beside a four-slot `C` is a compile error.
- **`variant`'s names are typed `keyof C & string`**, so a name absent from the
  branch record does not compile. The reverse direction — a branch the *grammar*
  has that neither `C` nor the list mentions — is what the construction check
  catches, since only the grammar knows it.
- **The kind** is checked the same way, from the tag the §9 helpers write.

What is left to the author is which types the slots *hold*, not how many there
are or what they are called. That is a claim a reader can check against the
grammar, and it is the residue this design accepts.

RTTI is **not** on this path. `in`/`out` schemas per transformer, `subset`
compatibility at instantiation, and per-node `parse` remain available as an
optional debug layer for anyone who wants values checked at a boundary, and
their open question (a boundary `subset` cannot prove) stops being this issue's
blocker because nothing here depends on the answer.

#### 9. Helpers

The four shapes are the primitive; the ergonomics come from a small library over
them. It is also what writes the §5 kind tag, so an author never types one:

**Everything below comes from one factory**, `transformers(monoid)`, which binds
`M` once (§5). Nothing here takes a type argument at a call site:

```ts
type Transformers<M> = {
    // pairs a rule value with its transformer; the start entry's `T` is the parse's
    readonly entry: <T>(rule: FRule, t: Transformer<M, T>) => Entry<M, T>
    readonly map: (...entries: readonly Entry<M, unknown>[]) => TransformerMap<M>

    // tagging constructors: a §1 shape plus its declared child shape in,
    // a map-installable `Transformer` out
    readonly terminalOf: <T>(f: TerminalTransformer<M, T>) => Transformer<M, T>
    readonly seqOf: <C extends readonly unknown[], T>(
        arity: C['length'], f: SequenceTransformer<M, C, T>) => Transformer<M, T>
    readonly variantOf: <C, T>(
        branches: readonly (keyof C & string)[], f: VariantTransformer<M, C, T>) => Transformer<M, T>
    readonly repeatOf: <C, S, T>(item: FRule, r: RepeatTransformer<M, C, S, T>) => Transformer<M, T>

    // sugar: the callback sees the value alone, `M` is forwarded, the result is `ok`
    readonly terminal: <T>(f: (symbol: CodePoint) => T) => Transformer<M, T>
    readonly seq: <C extends readonly unknown[], T>(
        arity: C['length'], f: (children: C) => T) => Transformer<M, T>
    readonly seqR: <C extends readonly unknown[], T>(
        arity: C['length'], f: (children: C) => Result<T, string>) => Transformer<M, T>
    readonly variant: <C, T>(
        branches: readonly (keyof C & string)[], f: (b: Branch<C>) => T) => Transformer<M, T>
    readonly list: <C>(item: FRule) => Transformer<M, readonly C[]>
    readonly text: (item: FRule) => Transformer<M, string>
    readonly unit: Transformer<M, undefined>

    readonly build: (rest: TransformerMap<M>) => <T>(start: Entry<M, T>) => TransformMatch<T, M>
}
```

`map(...entries)` is part of it for a reason worth stating: entries have
different `T`s, so a bare `new Map([…])` unifies its value type from the first
element and rejects the rest. Taking `Entry<M, unknown>` widens each one where it
is passed — `Transformer<M, T>` is covariant in `T` (§5) — so the map is written
without an annotation. `list` and `text` no longer take the monoid either; the
factory already has it.

**`map` throws on a duplicate rule**, and that is the third face of one
invariant: *one rule value means one transformer*. §5 refuses a start rule that
is also in `rest`; §3 refuses a mapped branch under an unmapped variant and its
converse. Here the widening to `Entry<M, unknown>` is what makes the hazard
invisible — two entries for the same rule at unrelated `T` both type-check, and
`Map` construction silently keeps the last. The parser's own checks then see
only the survivor, so a parent whose `C` declared the *other* one's type gets a
plausible wrong value at runtime, which is the outcome §6 exists to prevent.
Merging a combinator's fragment (§10) with local entries is exactly where this
would happen, so it is refused where the entries meet rather than left to be
discovered downstream.

- **The four `…Of` constructors are the primitive, and there is no way around
  them.** A map entry must carry the §5 kind tag — the construction-time kind
  check reads it, and at runtime nothing else can distinguish a terminal
  transformer from a variant one — so a bare `TerminalTransformer` or a
  hand-written `RepeatTransformer` is *not* installable as written. It is
  `terminalOf(f)` and `repeatOf(r)` that make it one. An author still never
  types a tag; the constructor writes it.
- `terminal`, `seq`, `variant` — the same three composed with "forward `M`
  unchanged, wrap in `ok`", for the common case of a transformer that neither
  reads metadata nor refuses. One that *does* care about `M` is the §1 shape
  passed to its `…Of`; one that only refuses uses `seqR` and its siblings, whose
  callback returns a `Result` while `M` still rides along untouched.
  `terminal`'s callback is **not** given an EOF branch, so a rule that can match
  the synthesized end-of-input symbol is `unit` or a `terminalOf` that handles
  `EOF` (§2).
- `entry(rule, t)` pairs a rule **value** with its transformer — the only place
  the two meet, and `map` refuses two entries for the same rule. The start rule's entry goes to `build` separately, because it
  carries the parse's value type (§5), and it is the entry that most needs `M`
  bound: standing outside any map, it has no contextual type to infer from.
- **The child-shape argument comes first in each**, and the compiler keeps it
  honest: `arity` is typed `C['length']` and `branches` is `keyof C & string`
  (§8), so neither can drift from the tuple or record it describes.
- `list(item)` — `repeatOf` applied to the identity fold: children in, array
  out, O(1) per item. It takes the repeated **rule value**, which is a `Repeat`'s
  child shape; the monoid it needs to combine its rounds' metadata (§3) comes
  from the factory.
- `text(item)` — the common lexeme case: the repeated rule's results
  concatenated into a string. **Its item rule must produce a string**, because a
  `Repeat`'s children are rule *results* and never raw leaves — only a terminal
  transformer sees a leaf (§2), and an unmapped item rule would hand `text` its
  default AST node (§3). That is why §10 maps `digit` before using
  `text(digit)` for `digits`.
- `unit` — keeps nothing, and is not a kind: it fits any rule, and the engine
  answers it without calling anything (§5). It is declared at `undefined` so an
  `entry` built from it says so (§5). Its own subtree costs nothing,
  though it still occupies a slot in its parent's tuple rather than disappearing
  from it (see §10). Whitespace, punctuation, a rule that can match EOF, and a
  recognizer's every rule.

**There is no `span` helper, and §7 is why.** An earlier draft had
`span(inner)`, a wrapper that gave a transformer's result the source range
merged from its children's metadata. A wrapper cannot do that: it sees one
transformer, not that transformer's children, so the merge has to be the
engine's. It is — the `Monoid<M>` of §1, supplied once per parser. What was
sugar for a channel the protocol lacked is now the channel.

**The O(1)-`update` discipline (§4.1) applies to `list`, `text` and anything
else passed to `repeatOf`**, because they are the only shapes with an `update`.
A sequence transformer receives its whole tuple at once and cannot be quadratic
in a length the grammar fixes.

#### 10. Worked examples

**A complete small grammar.** Written out in full rather than sketched, because
a map and a grammar summarized in a comment can disagree — and in five
successive review rounds against an abbreviated JSON sketch, they did, every
time (see the end of this section). Twelve rules, exercising all four kinds and
one refusal:

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
// the rules are ordinary values the author holds; the map is keyed by them.
// one factory binds `M`, so no call below takes a type argument (§9).
const { entry, map, terminal, seq, seqR, variant, list, text, build } = transformers(m)

const rest = map(
    entry(digit,   terminal(c => String.fromCodePoint(c))),
    entry(digits,  text(digit)),
    entry(minus,   terminal(() => '-')),
    entry(noSign,  seq(0, () => '')),
    entry(sign,    variant(['minus', 'noSign'],
                       ([, x]: Branch<{ minus: string, noSign: string }>) => x)),
    entry(item,    seqR(3, ([s, d0, ds]: readonly[string, string, string]) => {
                       const n = Number(`${s}${d0}${ds}`)
                       // §6: refuse what cannot be represented
                       return Number.isSafeInteger(n) ? ok(n)
                           : error(`${s}${d0}${ds} not a safe integer`)
                   })),
    entry(next,    seq(2, ([, it]: readonly[unknown, number]) => it)),
    entry(more,    list<number>(next)),
    entry(some,    seq(2, ([first, rest]: readonly[number, readonly number[]]) =>
                       [first, ...rest])),
    entry(noItems, seq(0, () => [])),
    entry(items,   variant(['some', 'noItems'],
                       ([, xs]: Branch<{ some: readonly number[], noItems: readonly number[] }>) => xs)),
)

// the start entry is passed separately because it carries the parse's type (§5)
const match = build(rest)(
    entry(list, seq(3, ([, xs]: readonly[unknown, readonly number[], unknown]) => xs)))
```

Read the shapes off it. `digit` is a terminal and gets a leaf. `sign` and
`items` are variants and get a branch. `more` and `digits` are repetitions and
are the only two folds. Everything else is a sequence and gets a tuple — one
slot per item, punctuation included, which is where the cost below lives.

`item` takes a `digit` *and* a `digits` repetition because a `Repeat` matches
zero rounds (§2). With `[sign, digits]` alone, and `noSign` also empty, `item`
would match nothing at all: `Number('')` is `0`, so `[,]` would be accepted and
answer `ok([0, 0])`. One-or-more has to be spelled as one plus zero-or-more.

**One rule refuses and no other rule mentions it.** `item` is `seqR`, so its
callback returns a `Result`; the engine takes an `error` as that invocation's
outcome, attaches the rule name and position, and reports `refused` (§6). Every
other entry is written as though refusal did not exist, and `next`, `more`,
`some`, `items` and `list` all say plainly what they build: `number` and
`readonly number[]`.

That is the measured difference between the two refusal designs, not a claim
about them. Written against this same grammar with the error in the
transformer's own `T` instead, six of the other eleven rules gained a `Result`
in their declared value, `some` had to `allOk` its children with explicit type
arguments, `noItems` had to return `ok([])` so the variant's arms agreed, and
two type aliases existed only to name the plumbing. The engine channel costs a
`Result` in four signatures nobody writes by hand, and this map is what it buys.

**Each entry is keyed by the rule value, not a name.** `digit`, `items` and the
rest are the grammar's own `const`s — no named-thunk rewrite and no generated
names to predict. `text(digit)` and `list<number>(next)` name their repeated rule
the same way, by handing over the rule.

**No call above takes a type argument, and that is what the factory is for.**
`M` is invariant in `Transformer<M, T>`, and a call like `terminal(c => …)`
mentions no metadata, so written against free helpers it would infer
`M = unknown` — which a contextually typed map would paper over and the
standalone start entry would not (§5). `transformers(m)` binds it once. The one
explicit argument left is `list<number>`, because a repetition's item type
appears nowhere in its arguments.

**Each entry declares its child shape, and the compiler will not let it drift.**
`seq(3, …)` beside a four-slot tuple does not compile — the parameter is typed
`C['length']` — and `variant(['some', 'nope'], …)` does not compile against a
branch record without `nope` (§8). What the *compiler* cannot know is whether
the grammar agrees; that is the construction-time check of §5, which compares
each declaration with the `RuleSet` in both directions. A branch added to
`items` in the grammar and forgotten in the map fails when the parser is built.

**`list` sees its own brackets, and that is the sharpest remaining ergonomic
cost.** Every direct child occupies a slot: a punctuation rule with no
transformer contributes its AST node, and `unit` contributes `undefined` rather
than removing itself from the tuple. `list`'s tuple is three slots — `[`, the
items, `]` — and the `unknown`s above are where the brackets land.

That is tolerable for a rule the author wrote, and **not** tolerable for one a
combinator built: `commaJoin0Plus(ws)('[]', item)` expands into exactly the
`items`/`some`/`more`/`next`/`noItems` scaffolding above, except that the author
never wrote it and cannot see it.

**The answer is that a combinator supplies transformers too**, not that the
engine learns to hide children. Two mechanisms were considered and rejected
first, and the reason is the same one both times:

- **A designated `unit` the engine drops from the tuple** cannot reach the
  children that need dropping. `list`'s brackets are inline literals, so
  `toData` gives them *generated* names (§11.3) — a map cannot address them at
  all, let alone mark them `unit`. To use this an author would have to name and
  map every punctuation rule, which is more work than counting slots.
- **A rule marked silent in the grammar** would work, but it is a change to the
  data `Rule` — a new field through `toData`, both backends, and every consumer
  of `fjs/bnf/data` — to solve a problem that does not need one.

What the author is missing is not a way to *hide* the scaffolding but a
transformer *for* it, and the thing that knows its shape already exists: the
combinator that built it. So `commaJoin0Plus` returns rules **and a map
fragment** for the rules it generated, which the author merges into their own.
They never count through scaffolding because they never write an entry for it —
and the fragment declares its own arities and branch names (§8), so it is
checked at construction like everything else.

This needs no protocol change, which is why it is stage-2 library work rather
than a stage-0 decision (Tasks). Hand-written sequences are still counted by
hand, which is fair: the author wrote them, and `seq`'s arity argument now makes
a miscount a compile error.

**Declaring a type for a variant means transforming all of it.** `items`
declares two branches and `sign` declares two, so all four must be mapped —
`noItems` and `noSign` included, which is why two rules exist only to return
`[]` and `''`. An unmapped branch would hand its variant an AST node, and
`Branch<{ some: readonly number[], noItems: readonly number[] }>` says that is
wrong at the map rather than at some later use of the value, and the
construction check (§5) catches a branch the grammar has that the map forgot.
Separately, a mapped branch under an *unmapped* variant is refused at
construction (§3).

So adoption is incremental *up to* the first variant whose value you want typed,
and from there down it is all-or-nothing.

**What this saves is the tree, not every node.** A partial map leaves
punctuation terminals and the grammar's anonymous rules untransformed, so each
of those still builds its own node (§3). What no longer happens is the O(*n*)
part: a mapped rule builds no node, and the nodes its unmapped children built
are dropped as soon as it folds them, so nothing accumulates into a root AST.
Only a map with an entry for every reachable rule — the recognizer below —
allocates no node at all.

**Why this is not the JSON example, and what JSON adds.** Stage 2 wants a JSON
grammar checkable against the spec's test vectors (§11.6), and the map for one
is this shape at four or five times the size. Counting the rules it needs makes
the costs above concrete rather than rhetorical:

- **A string** is six rules — `string`, `characters`, `character`, `escape`,
  `escaped`, and the simple/hex escape forms under it — because a character is a
  *variant* over plain and escaped, not a terminal.
- **A number** is around nine: an optional sign, an integer part, an optional
  fraction, an optional exponent with its own optional sign, and the digit
  repetitions inside them. Each "optional" is a `Variant` with an empty branch,
  so each needs two transformers, and neither may be a `Repeat` — a repetition
  there would accept `--1` and `1.5.5`.
- **An object and an array** are five rules each, the comma-list scaffolding
  above.
- **`value`** is a seven-branch variant, all seven of which must be mapped.

And the refusal plumbing multiplies through every one of those containers, since
JSON's `1e999` refuses exactly where this example's out-of-range integer does.

**Five findings against the abbreviated version, kept as the reason for the
change.** Each was a way a design document can look finished while describing
something that does not work, and each was found in a JSON grammar that existed
only as a comment:

- `character` annotated as taking a `CodePoint` — false for `\n` or `A`,
  because `character` is a variant over plain and escaped. Under the uniform
  protocol nothing caught it: the child was `unknown` and the annotation was the
  author's word. Under the four kinds it is not writable, since a variant
  transformer's parameter is `Branch<C>`. **This is the finding the whole
  redesign came from.**
- `members = repeat(member)` — cannot parse `{"a":1,"b":2}`, whose second round
  starts at a comma.
- `number = [digits]` — rejects `-1`, `1.5`, `1e2`.
- `Number(d)` answering `Infinity` for `1e999`, the value §6 names by name as
  one to refuse.
- Then, after fixing that one: `member` still declared its value child as bare
  `Json`, so an object silently accepted a member whose value was an error
  tuple. The refusal was typed at the top of the spine and dropped in the
  middle.
- And the optional number parts were mapped with `text()`, a `RepeatTransformer`
  — which the construction-time kind check (§5) would have rejected, since they
  are `Variant` rules. The check catching its own document's example is the best
  evidence for it in this issue.

The first three were the abbreviation's fault and the last three were the
example's own. Writing the grammar out in full fixes the first class; the
example being small enough to check by eye fixes the second.

**Recognizing without building.** The same grammar, with a map that answers
`unit` for every rule. The parse is O(depth) memory and no value is built — the
payload-free mode [recognizer-backend](./recognizer-backend.md) asks a backend
for, without a second traversal to discard what the first one built.

**The verdict is `ok` with an empty remainder, not the outcome tag alone.** A
match succeeds as soon as the *start rule* does, so on a grammar that does not
end in `eof` the tag alone would accept a valid prefix followed by garbage —
which is not the complete-stream contract a recognizer owes. The remainder is
what closes that gap, and this backend's own proofs already say so:
`isMatchSuccess` in [`../ll1/proof.f.mjs`](../ll1/proof.f.mjs) is
`success && remainder?.length === 0`. A grammar that *does* end in `eof`
consumes the synthesized end-of-input symbol and leaves the remainder empty, so
one rule covers both spellings.

That is *folding* payload-free, and it is not the whole of a streaming
recognizer. [streaming-recognizer](../../media/json/todo/streaming-recognizer.md)
specifies a per-`U16` `recognizerStep` with a depth cap chosen at init, which
needs incremental **input** (§4.2, [43](./043-stateful-parser.md)) as well — and
belongs to `fjs/media/json` as its own hand-written module either way, by the
boundary in §11.6. This issue supplies one half of the mechanism and none of
that module.

**DJS module.** `foldValue`, `descendantsTagged`, `slot`, `keyOf` and
`_FoldFrame` all delete: elements arrive at their container's transformer
instead of being searched for, and the engine's stack is the parser's already-
explicit one, so the hand-rolled stack that exists to survive deep nesting is
not needed.

One thing does not fall out, and it is the design's honest limit: DJS resolves
`const` references against names bound by *earlier* statements, which is an
**inherited** attribute, and a transformer only synthesizes. Three ways out, and
this has to be settled now rather than at the port, because two of them change
what stage 1 publishes:

- **A downward channel** in the engine, so a rule can see what its ancestors
  bound. No §1 signature accepts one and `build` has nowhere to supply it, so
  this is a protocol change — the transformer types, the erased map, the frames
  and the entry point. Deferring it would mean republishing the stage-1 API.
- **The value transformer returns a closure** `(refs) => AstConst` that the
  module transformer applies. No protocol change, but a closure nested in a
  half-built array or object *is* a repetition's state while later siblings are
  parsed, so a parse suspended there holds functions — contradicting §1 and
  §4.2, where a suspended parse is plain data.
- **Resolve in a second pass** over the value the parse produced. The
  transformers build a module whose `const` references are unresolved names, and
  an ordinary function walks the statements in order and resolves them.

**Take the second pass.** It needs no protocol change, so stage 1's types are
safe; it keeps every transformer state plain data, so §4.2's checkpoint survives;
and "const not found" becomes a check on a built value, which is where a
name-resolution error belongs anyway — it is not a parse concern, and it gets to
report its own position from the metadata the value carries (§7). The cost is
one extra traversal of a module's statements, which is bounded by the program
rather than the input, and a value type that admits unresolved references
between the two passes.

That leaves the protocol synthesized-only, deliberately. Inherited attributes are
a real gap, and the answer here is that a fold is the wrong place to close it.

Worth noting against `M`: an inherited attribute is *not* what the metadata
channel provides. `M` flows up with values, so it can carry where a `const`
reference was — which is what the second pass needs to report an unresolved
one — but not what an earlier statement bound to it.

#### 11. What this replaces

**11.1 It is not blocked.** The previous design was blocked by
[unicode-rules](./unicode-rules.md) because it described `string` as a generic
`Rule` kind that the alphabet split removes. This one is defined over the data
`RuleSet`, where the functional Unicode-literal string never arrives —
`toData` has already expanded it to terminals, and the only string case there is
`Repeat`. The split may change which rules a *grammar* has and what they are
named, which is that grammar's business (JSON's is tracked in
[bnf-grammar-single-owner](../../media/json/todo/bnf-grammar-single-owner.md)),
not this protocol's.

**11.2 Fold, not `reduce`.** The previous `Semantics<R>` gave `reduce` the whole
child array. The conversion only goes one way: `init`/`update`/`end` gives you
`reduce` (accumulate, then apply), while `reduce` cannot give you streaming,
because it must materialize every child list first. That distinction survives
the split to four kinds exactly where it matters: a `Repeat` is the unbounded
kind and it folds, while the fixed-arity kinds do take their children as a
tuple — an array whose length the grammar bounds, not one the input grows.

**11.3 `mapRule` is dropped, and keying by rule value costs the grammar
nothing.** Wrapping rules in the functional form to carry actions required every
consumer (`toData`, `dispatchMap`, both backends) to learn to skip a wrapper, in
exchange for TypeScript inference that §8's predecessor proved does not survive
a cyclic grammar. Keying a separate map by the rule **value** keeps the grammar
untouched instead, and — unlike keying by name — asks nothing of how it is
written.

That last point was not free, and an intermediate revision of this issue got it
wrong. Keyed by *name*, only rules `toData` can name could carry a transformer:
it takes a name from a thunk's `fr.name`, so a named `() =>` thunk keeps its
name while anything else — a `const` bound to an array or an object literal, an
inline combinator call — is anonymous and gets a generated one, with `newName`
disambiguating collisions. Measured on the shipped example:
`toData(deterministic())` ([`../testlib.f.mjs`](../testlib.f.mjs)) produces
**92 rules**, named `1`…`87`, `r`, `r0`…`r3`, `value`, and `""` for the entry —
**one name in ninety-two** is meaningful, because `value` is the only rule that
grammar spells as a thunk. Under name-keying, a grammar meant to carry
transformers had to be rewritten so every interesting rule was a named thunk,
and a combinator could not address the rules it generated at all (§10).

Keying by value deletes all of that. `find` in
[`../data/module.f.mjs`](../data/module.f.mjs) already identifies rules by
`v === fr`, so a rule value is a key whether or not it has a name, and whoever
holds the rule holds the key. `deterministic()` can carry transformers as it is
written. A combinator can hand back a fragment for the rules it built, because
it holds them (§10). What `toData` owes this design is one thing rather than a
naming convention: **expose the rule-value → name mapping it already builds**
(`_FRuleMap`), so the engine can attach each entry to the rule it names.

**11.4 List flattening is already done.** The structural right-recursion
detection the previous design spent a section on shipped as the `Repeat` rule,
and `RepeatTransformer` (`init`, one `update` per round, `end`) is the one kind
that keeps the fold-as-data shape — §12.

**11.6 It does not reopen the media/BNF boundary.** An earlier draft of this
issue had `fjs/media/json` running its grammar through the transformer matcher.
It cannot:
[parser-serializer-restructure](../../../todo/parser-serializer-restructure.md)
settles that "the media codecs take no runtime dependency on `fjs/bnf` or on
`fjs/js/tokenizer`, which is the whole point of the restructure", and lists it
among three decisions not to reopen without a reason. `fjs/bnf/**` may hold the
JSON and DataJS grammars only as **proof-covered examples** cross-checked
against the spec's test vectors — an unproved example is how the dead `fjs/fsc`
copy silently drifted.

Transformers make those examples *evaluable*, which is exactly what
cross-checking a grammar against a value vector needs, and that is the whole of
this issue's claim on JSON. The codec, its container-stack parser, and its
streaming recognizer stay `fjs/media/json`'s own hand-written modules. The
runtime consumer of this protocol is the front end that already runs on BNF —
`fjs/djs` today, `fjs/fsc` after the restructure moves it.

**11.5 The split is off.** What made the previous issue too big was the RTTI
contract, the metadata monoid, and the flattening analysis. The first is
optional (§8), the third has shipped. The second is the one this rewrite kept —
it comes back as `M` and a construction-time `Monoid<M>` (§1, §7) — but it is a
fraction of what it was: one monoid per parser instead of a `(leaf, merge,
empty)` triple declared per rule, generic in what it carries instead of fixed to
spans, and trivially instantiated by a grammar that wants none. What is left is
one protocol and its two backends.

#### 12. `RepeatTransformer` is the repository's fold-as-data shape

`init`/`update`/`end` is not a new invention here. It is already shipped four
times and designed a fifth, and §1's `RepeatTransformer` is deliberately the
same shape rather than a sibling of it:

| Where | Shape |
|---|---|
| [`fjs/crypto/sha2/types.ts`](../../crypto/sha2/types.ts) | `Sha2 = { init: State, append: Fold<Vec, State>, end: (state) => Vec }` |
| [`fjs/types/list/types.ts`](../../types/list/types.ts) | `Accumulator<I, T, R> = { init: T, update: (i, state) => Nullable<T>, end: (state) => R }`, driven by `tryFold` |
| [`fjs/types/patricia_trie/types.ts`](../../types/patricia_trie/types.ts) | `{ push, end }` |
| [`fjs/sul/types.ts`](../../sul/types.ts) | `Encode<S> = { push, end }` |
| [`todo/flow.md`](../../../todo/flow.md) | `Transducer<I, S, O, A> = { init: Step, update: (state, item) => Step, end: (state) => Terminal }` — the universal operator |

Around them sits the closure-form family in
[`fjs/types/function/operator`](../../types/function/operator/types.ts) —
`Fold<I, O>`, `Scan<I, O>`, `StateScan<I, S, O>` — with drivers `fold`,
`tryFold`, `scan`, `stateScan`, `foldScan` in `fjs/types/list`.
[recognizer-backend](./recognizer-backend.md) already tells this issue's
neighbours to use that family as the streaming contract rather than inventing a
type, and this protocol is that instruction taken literally — for the one kind
that needs it.

**The claim is `RepeatTransformer`'s, not every transformer's.** Splitting the
protocol by rule kind (§1) is also a claim about *where* the fold-as-data shape
belongs: a repetition is the only rule whose children the grammar does not
count, so it is the only one with a state to carry between them. Terminal,
sequence and variant transformers are plain functions of children the engine
already holds, and calling those a degenerate three-event fold — `init` that
nothing updates, one `update`, `end` — would be describing a function in a
fold's vocabulary for the sake of a uniformity that costs typed children (§1).

Stated against flow's operator, a `RepeatTransformer` **is** a `Transducer` with
two of its four channels removed: no output stream (`O`) — a rule produces one
value, not a stream — and no early `done`, because a fold over a rule's rounds
ends when the rule does, not when the transformer decides. What is left is
`init`, `update: (state, item) => state`, and `end` yielding the summary `A`.
Its alphabet `I` is `Meta<C, M>`, the round's value paired with its metadata,
which is one item type and not two parameters — the same reason a variant's
branch name rides with its value (§1).

One deliberate difference remains: **the state is existential in a map.**
`Accumulator` and `Transducer` are each used one at a time; a `TransformerMap`
holds many with unrelated states, which is what §5's erased `Transformer<M, T>`
bound and its single elimination are for.

Settle the parameter order below and `RepeatTransformer<M, C, S, T>` has nothing
of its own left to be: it becomes `Accumulator<Meta<C, M>, S, Meta<T, M>>`, and
this part of the section becomes an import — modulo one thing `Accumulator` does
not have: **a refusal carries a reason.** `Accumulator`'s `update`
short-circuits with `Nullable<T>` and flow's `Step` with `done`; neither says
*why*, and [DESIGN.md §10](../../../DESIGN.md#10-refuse-what-you-cannot-handle)
wants a refusal, not a silence. Hence `end: (state) => Result<Meta<T, M>, string>`
(§6). Unifying the two would mean giving the shipped folds a reason channel, not
taking this one away.

Two things this alignment hands to whoever implements it. `todo/flow.md`'s
"explicit state `S`, not self-returning closures — the closure form is
derivable, not canonical" is the decision §1 now follows, and its reasons
(content-addressing, checkpointing, shipping to a remote engine) are exactly
§4.2's. And **composition is flow.md's, not this issue's**: transducers are
closed under composition, so chaining stages — `map(a)(b)`, fusing a tokenizer
into a parser — belongs to that operator family, where
[layered-parser](./layered-parser.md) already puts the `bytes → code-points →
tokens → AST` cascade. Note *which* channel that needs: chaining consumes one
stage's output stream, the `O` a rule transformer does not have. So transformers
do not chain with each other, and should not be made to — a transformer map is
one layer's semantics, and it is the **layers** that compose, each one's output
stream being the next one's leaves.

One inconsistency worth settling while the family is in view, and not by this
issue alone: `Accumulator.update` is `(item, state)` and flow's `Transducer` is
`(state, item)`. §1 follows flow's order, `state` first.

### How binding this is

Detailed, and [REVIEW.md](../../../REVIEW.md#designs) says what that means: **the
implementer is not bound by it, but deviating silently is not allowed — the
reason goes here.** Three tiers, so it is clear which is which:

- **Settled, and changing one is a design change.** The four kinds and their
  signatures (§1), the metadata channel and its monoid (§7), refusal as an
  engine channel (§6), the map keyed by rule value (§5), and the three stage-0
  decisions with their evidence (Tasks). Each was decided against a compiled
  example rather than an argument; if one turns out wrong, the finding belongs
  in this document before the code changes.
- **Specified because it was cheaper to settle than to leave open.** The seven
  construction-time checks, the four default builders, the helper set (§9).
  These are what two implementers would otherwise get differently, which is
  [REVIEW.md](../../../REVIEW.md#designs)'s test for missing detail. Deviate
  where the code disagrees; say so here.
- **Deliberately left to the implementer.** Frame layout, where the existential
  cast lives, how `toData` exposes its rule → name mapping, whether the helpers
  are one module or several, and every error message's wording. The document
  names the constraint (§5's checks must throw at construction, §4.1's `update`
  must be O(1)); how is not its business.

Nothing here is a prototype's output. The type-level claims were compiled, the
grammar and worked map were written out in full and checked, and the monoid laws
were tested — but no parser was built against any of it, so the first thing
stage 1 should expect is that something in the middle tier is wrong.

### Tasks

Staged. **Stage 0 was three decisions and no code** — each changed what stage 1
publishes, so taking them afterwards would have meant republishing it. They are
settled below. Then **`fjs/bnf/ll1` is stage 1** — not because it is the easier
machine (it is, marginally) but because it is the one that settles the rest of
the design:

- It **never backtracks**, so no transformer runs on a branch the parse goes on
  to abandon — which removes the *speculative* half of §6 from stage 1. With a
  refusal carried as a *value* rather than an abort (§6), a refused invocation
  inside a failed match is discarded with everything else it produced — so
  stage 1 has that case and stage 3 adds only the abandoned-branch one.
- It is the backend that can promise **bounded-memory input streaming** (§4.2),
  which is what a payload-free recognizer over a stream needs and what the
  fold-level guarantee alone does not give.
- It is the **smaller change**, and stage 1 is where the protocol's shape is
  still cheap to move: `ll1` has no rewind state and no furthest-failure record,
  so its machine is the one to be wrong on first. `fjs/djs`'s port is the
  larger, riskier change; its inherited-attribute question is settled in §10 —
  a second pass over the built value, chosen because the alternatives would
  change what stage 1 publishes.
- It is the backend that **does not carry metadata yet**, so the leaf change of
  §7 lands here. Doing it in stage 1 is what lets stage 3 inherit the channel
  instead of adding it: `descent`'s leaf is already `CodePointMeta`, so once
  `ll1` matches, `M` is settled before the harder backend starts.
- `descentEquivalence` in `../ll1/proof.f.mjs` **already pins the AST both
  backends build**, so the conformance test for "the default transformer
  reproduces today's AST" exists before the change that has to keep it passing.

**Stage 0 — decided, with the evidence.** Three choices changed what stage 1
publishes, so each was settled before any code by writing §10's twelve-rule map
against both candidates and compiling them. All three are recorded here rather
than in the open questions, because a design document that leaves its public
types undecided cannot be implemented against.

- [x] **The refusal channel: the engine's.** Every kind returns
      `Result<Meta<T, M>, string>` and §5's result regains `refused` (§6). The
      alternative — the error in the transformer's own `T`, no channel at all —
      put a `Result` into six of §10's other eleven rules, forced an `allOk`
      with explicit type arguments, forced an empty branch to return `ok([])`,
      and added two aliases that named nothing but plumbing. The channel costs a
      `Result` in four signatures that the §9 helpers write for you. It also
      restores the engine-attached `{ rule, at, message }`, so a grammar no
      longer has to carry positions in `M` to diagnose a refusal.
- [x] **The child shape: carried as data.** Each entry declares its arity,
      branch names, or repeated rule, and construction compares them with
      the `RuleSet` in both directions (§5, §8). The duplication worry does not
      materialize, because the type system ties the declaration to `C`:
      `seq`'s parameter is `C['length']` and `variant`'s is `keyof C & string`,
      so neither can drift from the shape it describes. Cost: one literal per
      entry.
- [x] **Silent children: not a protocol change.** A combinator supplies
      transformers for the rules it generates, so an author never writes an
      entry for scaffolding they did not write (§10). The two mechanisms that
      *would* have been protocol changes are rejected there: an engine-dropped
      `unit` cannot address inline punctuation, whose `toData` names are
      generated, and a grammar-level silent flag changes the data `Rule` to
      solve a problem that does not need it. This one leaves stage 0 entirely —
      it is stage-2 library work.

      **This is what forced the map's key to be the rule value** (§1, §11.3). A
      fragment keyed by *name* runs into the same wall as the engine-dropped
      `unit`: a combinator cannot predict the names `toData` will generate for
      the rules it built. Keyed by value it simply hands back what it holds, and
      `toData` exposing its rule → name mapping is the one small addition that
      makes the engine able to use it.

**Stage 1 — the protocol and `fjs/bnf/ll1`.**

- [ ] Add `Meta`, `Branch`, the four transformer types, `Entry`, the tagged
      erased `Transformer` and `TransformerMap` to `fjs/bnf/matcher/types.ts`,
      and the four default builders (§3) to its `module.f.mjs`.
- [ ] Have `toData` **expose the rule-value → name mapping** it already builds
      (`_FRuleMap` in `fjs/bnf/data`), so the engine can attach an entry keyed by
      a rule value to the data rule that value became (§5, §11.3). Additive: it
      neither changes the `Rule` model nor the AST, which is what distinguishes
      it from the silent-rule flag rejected in stage 0.
- [ ] Move `CodePointMeta<T>` out of `fjs/bnf/descent/types.ts` into
      `fjs/bnf/matcher/types.ts` as `Meta<T, M>`, and rewrite the doc comment
      that calls the metadata leaf "what distinguishes this backend" — it does
      not, once `ll1` carries it too (§7).
- [ ] **Give `fjs/bnf/ll1` the metadata leaf.** `Match`, `MatchResult` and
      `Remainder` become generic in `M` over `readonly Meta<CodePoint, M>[]`,
      and `_Position`, `_Result`, `_SeqFrame`, `_RepeatFrame` and `_Items` in
      `ll1/private.ts` follow (§7). This is a breaking change to a shipped
      public type; nothing outside `fjs/bnf/ll1` imports it, since `fjs/djs`
      uses `descent`.
- [ ] Simplify what that unblocks rather than leaving it: `bothBackends` in
      `ll1/proof.f.mjs` stops building two different inputs, and `showAst` in
      `testlib.f.mjs` loses the `number | readonly[number, unknown]` leaf union
      that exists only because the backends disagreed.
- [ ] Offer `ll1` the no-metadata adapter, generalizing
      `descentParserCpOnly` in `fjs/djs/tokenizer` rather than copying it, so a
      caller that wants no `M` still passes bare symbols.
- [ ] Take a `Monoid<M>` at construction and thread `M` through every kind (§1,
      §7). Prove it on a monoid that is not trivial — `TokenMetadata` under
      "leftmost defined", which gives every rule the position of its first
      symbol (§7) — not only on `Monoid<null>`, or the merge is untested.
- [ ] Replace the `AstSequence` in `fjs/bnf/ll1`'s frames with the invocation's
      collected children — for a `Repeat`, its `(rule name, state)` — and its
      `mrSuccess` calls with the rule's transformer. The frame keeps its `tag`,
      which stays the engine's own for unmapped rules (§3), and the one cast
      that eliminates a repetition's existential state lives at its `update`.
- [ ] Add a variant frame — `ll1` has none today, because a variant only
      retargets the current task — and push it **only** for a variant the map
      names, so the untransformed path keeps costing neither a frame nor a node.
- [ ] Prove the four default builders (§3) produce the same children the
      engine's native path does, so the specification and the implementation of the
      default cannot drift. Prove it on **children**, not whole nodes: a node's
      tag is inherited at rule entry and no synthesized builder can produce it
      (§3), which is why `variant`'s default is the identity. `descentEquivalence`
      already pins the tags.
- [ ] Add `transformers`/`build` (§5) and run all five construction-time checks:
      every keyed rule is reachable from the start rule; every entry's **kind
      tag matches its rule's kind**; every entry's **declared child shape
      matches its rule's** — a sequence's arity, a variant's branch names in
      both directions, a repetition's repeated rule; `start` is a rule of the
      grammar; `start`'s rule is **not** also in `rest`, since one rule must
      mean one thing at the root and under recursion; no mapped branch sits
      under an unmapped variant; and every branch a mapped variant declares has
      an entry of its own. Throw rather than parse. None of these is
      expressible in the type: the map's type does not know the grammar, so a
      terminal transformer supplied for a variant rule, or an entry for a rule
      the grammar no longer has, type-checks perfectly and is caught only here.
- [ ] Have `map` refuse two entries for the same rule value, before the parser
      is built (§9). It is the one place a duplicate can enter — the widening to
      `Entry<M, unknown>` hides it from the type, and `Map` construction would
      silently keep the last — and the parser's own checks cannot see it because
      only the survivor reaches them.
- [ ] Answer a `unit` entry without calling anything and without allocating —
      it is the fifth arm of `Transformer`, it matches any rule kind, and it is
      what makes stage 2's recognizer mode free (§5, §9).
- [ ] Refuse, in the same pass, a map that transforms the branch of an unmapped
      variant (§3): the branch has no node for the engine to tag, so the tag
      would vanish. Name both rules in the error, and prove that an empty map
      and an all-`unit` map both stay legal.
- [ ] Keep `parserRuleSet` on its **native path** — it is not this machine with
      an empty map, and cannot be: the machine needs a `Monoid<M>` that the AST
      API has no use for and cannot conjure for an arbitrary `M` (§5). What it
      owes instead is the proof above: the same children the four default
      builders specify.
- [ ] Carry a refusal as a value (§6): it takes the place of the refusing
      invocation's result, the enclosing rule is not called, and it propagates
      unchanged so the first refusal is the one reported. Attach `rule` and `at`
      from the engine's own cursor. Prove the case `ll1` has on its own — a
      later sibling failing syntactically after a refusal, with the result a
      syntax failure and no value rather than a semantic error.
- [ ] Skip the transformer when the input runs out mid-rule, for every frame on
      the spine, so none is ever handed a truncated tuple (§5, §6).
      That reports `no-match` with a `null` remainder, as a rejected match
      reports `no-match` with the position it stopped at; the engine's native
      AST path keeps building its partial node, so `parserRuleSet` is unchanged.
- [ ] Proofs: `descentEquivalence` and the existing AST expectations unchanged
      under the empty map; what each kind receives per §2, including the EOF
      terminal, an empty `Sequence` and a zero-round `Repeat` (both of which
      must see the monoid's identity); all five construction-time checks; and a
      deep-nesting case, since a repetition's fold now runs on the machine's
      explicit stack.

**Stage 2 — helpers and the first consumer.** The consumer is inside `fjs/bnf`,
not `fjs/media/json`: the boundary in §11.6 keeps the codecs off BNF at runtime,
so what transformers buy JSON here is an *example grammar that can produce a
value* to check against a spec vector.

- [ ] Add the §9 helpers. They write the kind tag, so an author never does, and
      the O(1) accumulation lives inside `list`/`text` — the only helpers with
      an `update` to be quadratic in.
- [ ] Ship §10's twelve-rule grammar and its map first, as the proof that all
      four kinds, an empty variant branch, and a refusal work end to end. It is
      small enough to check by eye, which is what the JSON sketch was not.
- [ ] Have the combinators return **transformers alongside rules** — a map
      fragment for the scaffolding they generate — so an author never writes an
      entry for a rule they did not write (§10). This is stage 0's third
      decision landing as library work: no protocol change, and the fragment
      declares its own arities and branch names so it is checked like any other
      entry. It is keying by rule *value* that makes it possible at all: a
      combinator holds the rules it built, and does not have to predict the
      names `toData` will generate for them (§11.3).
- [ ] Give the JSON example grammar a transformer set **as it is written** — no
      rewrite into named thunks, which name-keying would have required and value
      keying does not (§11.3). Budget for what §10 counts:
      six rules for a string, about nine for a number (each "optional" a
      `Variant` with an empty branch, never a `Repeat`), five each for objects
      and arrays, and a seven-branch `value`. Prove it against the spec's
      test vectors — the proof coverage
      [parser-serializer-restructure](../../../todo/parser-serializer-restructure.md)
      requires of every example grammar, now checkable on values rather than on
      an AST shape.
- [ ] Take the all-`unit` map to [recognizer-backend](./recognizer-backend.md)
      as its payload-free mode. Do **not** claim it as
      [streaming-recognizer](../../media/json/todo/streaming-recognizer.md)'s
      `recognizerStep`: that one is per-`U16`, depth-capped, and
      `fjs/media/json`'s own (§10, §11.6).
- [ ] Leave output-level streaming (§4.3) alone until a consumer asks for it,
      then decide between a typed drain and flow's output chunk — with
      [43](./043-stateful-parser.md) in place, since neither is useful without
      incremental input.

**Stage 3 — `fjs/bnf/descent`.**

- [ ] Thread transformer states through `fjs/bnf/descent`'s frames, keeping the
      untransformed path byte-identical. Its leaf already carries `M`, so this
      stage inherits the channel rather than adding it — stage 1 did that work
      on the backend that did not have it.
- [ ] Prove the speculative cases stage 1 cannot reach: a transformer that runs
      on an abandoned branch, and a refusal inside one that the parse recovers
      from by taking another branch (§6).
- [ ] Port `fjs/djs/parser` onto transformers and delete `foldValue`,
      `descendantsTagged`, `slot`, `keyOf`, `_FoldFrame`. Resolve the inherited
      `refs` attribute in a **second pass** over the built module (§10), not in
      the parse: the protocol stays synthesized-only and every transformer state
      stays plain data.
- [ ] Register any new module in `deno.json` per AGENTS.md, then run the check
      set that file prescribes — `tsc` (the environment's compiler, not a
      registry fetch: the repository pins no `typescript` package) and
      `fjs test`.

### Open questions

The three that gated stage 1 are **settled** — the refusal channel, the child
shape as data, and silent children. Their decisions and the evidence are in
Tasks, stage 0. What is left cannot change stage 1's public types:

- **Does the product monoid read well on a real tokenizer (§7)?** Not a stage-0
  question, because the design is committed: **one `M`**, a product whose every
  component is a lawful monoid — "leftmost defined" on each, per §7 — with the
  transformer, not the carrier, deciding when to stop propagating a consumed
  payload. A second, unmerged channel would change `Meta`, every transformer
  signature, the erased map representation and the matcher API — the stage-0
  property — which is why it is ruled out here rather than left open. What the
  layered-parser port should report back is only whether the product is
  *pleasant* to write, and a helper for building one would be the answer if it
  is not.
- **The repository-wide `(state, item)` argument (§12), not this issue's.**
  `RepeatTransformer.update` is **`(state, item)`**, committed, following
  `todo/flow.md`'s `Transducer`; `fjs/types/list`'s `Accumulator` is the other
  way round. That is settled here because stage 1 publishes it and every
  hand-written repeat transformer depends on it — an open question that could
  move a published parameter order would belong in stage 0, and this one does
  not, because it is decided. What stays open is the *repository's* eventual
  unification, which this issue should not settle for `Accumulator` and `Sha2`
  on its own; if it lands the other way, that is a breaking change with a
  migration, not a question left dangling here.
- **Output-level streaming (§4.3).** A typed drain needs the start rule to be a
  `Repeat` and needs its `S`, which the map erases; flow's output chunk taxes
  every rule with a channel it does not use. Deferred until a consumer names
  which cost it would rather pay.
- **Input streaming (§4.2) is [43](./043-stateful-parser.md)'s.** This issue
  only has to leave the parser state plain data so that one can suspend and
  resume it; which of the two lands first decides where the entry points live.
- **Helper set (§9).** `terminalOf`/`seqOf`/`variantOf`/`repeatOf` are the
  primitives and are settled by §5's representation; `terminal`, `seq`, `seqR`,
  `variant`, `list`, `text`, `unit` is a guess at the sugar. Let the JSON and
  DJS ports pick the final list.
- **What a combinator's map fragment looks like (§10).** Stage 2's answer to
  silent children is that `commaJoin0Plus` and its siblings return rules *and*
  transformers for the rules they generate. Whether that is a second return
  value, a paired builder, or a convention is a library-shape question with no
  protocol consequence — which is exactly why it is here and not in stage 0.

### Related

- [43. Stateful parser](./043-stateful-parser.md) — `init`/`append`/`end` on the
  input side; the same three-event shape at the other end of the pipeline, and
  what §4.2 needs.
- [`todo/flow.md`](../../../todo/flow.md) — the universal `Transducer` operator
  `RepeatTransformer` is shaped after (§12), where operator composition and
  stage fusion belong.
- [`fjs/types/list/types.ts`](../../types/list/types.ts) — `Accumulator` and
  `tryFold`, the shipped fold-as-data `RepeatTransformer` becomes (§12).
- [`fjs/common/monoid`](../../common/monoid/module.f.mjs) — the shipped
  `Monoid<T>` a parser takes at construction to combine children's `M` (§1, §7).
- [`fjs/crypto/sha2`](../../crypto/sha2/module.f.mjs) — `init`/`append`/`end`
  over a stream, the same trio one level up.
- [uncurry-accumulator-types](../../types/function/todo/uncurry-accumulator-types.md)
  — why a variant's branch name rides with its value in one parameter (§1).
- [recognizer-backend](./recognizer-backend.md) — "use the existing `Scan`
  family as the streaming contract (no new type)", which §12 follows.
- [i165](./layered-parser.md) — layered parser. `M` (§7) is the mechanism it
  wanted for carrying a payload between layers; each layer is one grammar plus
  one transformer map.
- [`fjs/bnf/descent/types.ts`](../descent/types.ts) — `CodePointMeta<M>`, which
  is `Meta<CodePoint, M>` and so is already a terminal transformer's parameter.
  §7 moves it to the shared layer, because it stops being what distinguishes
  this backend once `ll1` carries metadata too.
- [`fjs/bnf/matcher/types.ts`](../matcher/types.ts) — `Ast<L>` is already
  parameterized by the leaf, so §7's change to `ll1` is a type parameter it
  was written for rather than a new mechanism.
- [`fjs/djs/tokenizer/module.f.mjs`](../../djs/tokenizer/module.f.mjs) —
  `metadataScan` builds `CodePointMeta<TokenMetadata>` by hand today, and
  `descentParserCpOnly` is the no-metadata adapter `ll1` needs too (§7).
- [`../README.md`](../README.md#the-ast-is-one-contract) — the AST contract the
  four default builders (§3) have to keep reproducing.
- [`../data/README.md`](../data/README.md#the-repeat-rule) — the `Repeat` rule,
  the one kind that keeps a fold (§11.4, §12).
- [JSON BNF grammar owner](../../media/json/todo/bnf-grammar-single-owner.md) —
  where the JSON grammar lands; §11.6 is the constraint it also records.
- [parser-serializer-restructure](../../../todo/parser-serializer-restructure.md)
  — the media/BNF boundary of §11.6, and the proof-coverage requirement stage 2
  satisfies.
- [recognizer-backend](./recognizer-backend.md) — the payload-free mode the
  all-`unit` map supplies.
- [streaming-recognizer](../../media/json/todo/streaming-recognizer.md) — what
  this issue does **not** supply: a per-`U16`, depth-capped recognizer in
  `fjs/media/json`.
- [157. JSON/DJS shared value machine](../../djs/todo/157-json-djs-shared-value-machine.md)
  — what the DJS port leaves behind on the parser side.
- [Separate alphabet-specific BNF helpers](./unicode-rules.md) — no longer
  blocks this issue (§11.1); it changes the grammars, not this protocol.
- i172 (retired; shipped as [`fjs/rtti/validate/`](../../rtti/validate/module.f.mjs)
  and [`fjs/rtti/parse/`](../../rtti/parse/module.f.mjs)) — value-vs-schema
  validation, now optional (§8) rather than the type-safety mechanism.
- i143 (retired; shipped as [`fjs/rtti/data/`](../../rtti/data/module.f.mjs)) —
  the `subset` predicate the previous design's instantiation-time check was
  built on; §5 replaces that check with name, kind and `start` resolution.
