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
> keyed by rule name over the *data* `RuleSet`, applied by the matcher backends
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

type TerminalTransformer<M, T> = (v: Meta<L, M>) => Meta<T, M>
type SequenceTransformer<M, C extends readonly unknown[], T> = (v: Meta<C, M>) => Meta<T, M>
type VariantTransformer<M, C, T> = (v: Meta<Branch<C>, M>) => Meta<T, M>
type RepeatTransformer<M, C, S, T> = {
    readonly init: S
    readonly update: (state: S, c: Meta<C, M>) => S
    readonly end: (state: S) => Meta<T, M>
}
```

- **`TerminalTransformer`** receives the one symbol the rule matched, with its
  metadata. `L` is the alphabet's *symbol* — `CodePoint` today, generic after
  [the alphabet split](./unicode-rules.md) — and `Meta<L, M>` is the **leaf**:
  a symbol paired with what the layer below knows about it. That is not a new
  shape. `fjs/bnf/descent`'s `CodePointMeta<M>` is `readonly[CodePoint, M]`,
  which is `Meta<CodePoint, M>` exactly, so a terminal transformer's parameter
  is that backend's shipped leaf type. **Both backends carry it** — §7.
- **`SequenceTransformer`** receives its children as a **typed tuple**. A
  `Sequence`'s arity is fixed and known from the `RuleSet`, so there is nothing
  to stream and no state to keep — the engine collects the items and calls once.
- **`VariantTransformer`** receives the branch name paired with that branch's
  value, and `C` is a record from branch name to value type, so `Branch<C>`
  narrows: matching on the name narrows the value.
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
identity plus an associative operation — passed to `transformRuleSet` once
rather than declared per rule. The identity is what an empty `Sequence` and a
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
transformer and its AST node where it does not (§3). There is no `Result` in
that channel and nothing to unwrap: a transformer returns `Meta<T, M>` and the
parent receives the `T` (§6).

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

Rule identity is what the AST lacks and this has: the map is keyed by rule name,
so a transformer always knows which rule it is building — the "key observation"
the previous design had to work around by walking the grammar and the AST in
lockstep.

#### 3. What an unmapped rule builds

Its AST node, exactly as today — and the node builders are ordinary
transformers, so the AST is one instance of this protocol rather than a rival to
it. One per kind, which is itself the clearest statement of what the kinds are:

```ts
const terminal: TerminalTransformer<M, Ast<unknown>> =
    v => [{ tag: undefined, sequence: v[0] === EOF ? [] : [v] }, v[1]]

const sequence: SequenceTransformer<M, readonly unknown[], Ast<unknown>> =
    ([items, m]) => [{ tag: undefined, sequence: items }, m]

const variant: VariantTransformer<M, StringMap<unknown>, Ast<unknown>> =
    ([[tag, value], m]) => [{ tag, sequence: [value] }, m]

const repeat = (m: Monoid<M>): RepeatTransformer<M, unknown, _Rounds, Ast<unknown>> => ({
    init: [null, m.identity],
    update: ([items, acc], [item, im]) => [concat(items)([item]), m.operation(acc)(im)],
    end: ([items, acc]) => [{ tag: undefined, sequence: toArray(items) }, acc],
})
type _Rounds = readonly[List<unknown>, M]
```

Their node is `Ast<unknown>`, because a child of an unmapped rule may itself be
transformed, so what a node holds is no longer only nodes and leaves. A
repetition accumulates as a `List`, which is also a small improvement on today's
sequence frame — that one spreads an array per item.

Three details of these four are the contract rather than the implementation's
choice.

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

**`variant` above is a specification, not what the engine runs.** A node's tag
names the branch of the *enclosing variant* that reached it, and a variant
contributes no node of its own: both backends pass the branch tag *down* at rule
entry and let the branch's node be the variant's, so `ll1` does not even
allocate a frame for a variant — it retargets the current task. Building the
node written above would cost a frame and a second node allocation per variant
invocation, on the path that is supposed to be unchanged. So the tag stays the
**engine's** business for unmapped rules, and the four transformers above are
the *specification* of what an unmapped parse builds. "The AST is one contract"
([`../README.md`](../README.md#the-ast-is-one-contract)) is then checkable two
ways: the `descentEquivalence` proof group in `../ll1/proof.f.mjs` pins the
empty-map parse unchanged, and a proof that these four produce the same children
pins the specification to the implementation.

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
tell which branch matched. So `transformRuleSet` refuses at construction when a
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
- each backend gains one entry point that takes a map (`transformRuleSet`
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
// the erased upper bound: tagged by rule kind, so construction can check all four
type Transformer<M, T> =
    | readonly['terminal', TerminalTransformer<M, T>]
    | readonly['sequence', SequenceTransformer<M, never, T>]
    | readonly['variant', VariantTransformer<M, never, T>]
    | readonly['repeat', {
        readonly init: unknown
        readonly update: (state: never, c: Meta<never, M>) => unknown
        readonly end: (state: never) => Meta<T, M> }]
    | readonly['unit']
type TransformerMap<M> = StringMap<Transformer<M, unknown>>

// `fjs/bnf/ll1`'s own shape: its remainder and its result. Its *input* is the
// shared leaf now, the same one `descent` takes (§7).
type Leaf<M> = Meta<CodePoint, M>
type TransformMatchResult<T, M> =
    | readonly['ok', Meta<T, M>, readonly Leaf<M>[]]  // matched and finished
    | readonly['no-match', Remainder<M>]     // rejected, or the input ran out (`null`)

type TransformMatch<T, M> = (s: readonly Leaf<M>[]) => TransformMatchResult<T, M>

const transformRuleSet:
    <M>(ruleSet: RuleSet, monoid: Monoid<M>) =>
    <Map_ extends TransformerMap<M>>(map: Map_) =>
    <K extends string>(start: K) => TransformMatch<_Output<M, Map_, K>, M>

type _Output<M, Map_, K> = K extends keyof Map_
    ? Map_[K] extends Transformer<M, infer T> ? T : never
    : unknown
```

**Every kind erases to that bound, and `_Output` still reads the value back
out.** A terminal, sequence or variant transformer is a function whose parameter
is `Meta<C, M>` for its own `C`, and `Meta<never, M>` is assignable to every one
of those, so each erases however its children are typed; a
`RepeatTransformer<M, C, S, T>` erases for every `S`. `T` appears only in an
output position in each arm that has one, so `Transformer<M, T>` stays covariant
in `T` and `infer T` recovers the rule's declared value through the union. No
`any`, and no cast to build a map.

**`unit` is the fifth arm and it is not a kind.** It is the transformer that
keeps nothing, so it has no children to be typed by and no state — which makes
it the one entry that fits any rule. The engine does not call anything for it:
it yields `[undefined, identity]` directly. That is what makes the all-`unit`
recognizer of §10 allocation-free in the strong sense — not "builds cheap values
and discards them" but "makes no call and holds no state" — and it is also why a
rule that can match EOF is almost always `unit` rather than a terminal
transformer that has to branch on `-1` (§2). `_Output` reads `unknown` for a
`unit` start rule, which is honest: it kept nothing.

**The tag is there because nothing else can carry the kind.** Erased, a
terminal, a sequence and a variant transformer are the *same function type* —
each takes one argument that `Meta<never, M>` is assignable to — so without a
tag a map could supply a terminal transformer for a variant rule and neither the
type nor a runtime inspection would notice: at runtime all three are just
functions. It would fail as a variant handing its `[branchName, value]` pair to
a callback expecting a leaf. The tag is written by the §9 helpers, never by
hand, and it makes the kind visible exactly where the `RuleSet` is available to
compare it against.

**Four things are resolved when the parser is built**, all O(rules) and none of
them able to be incomplete:

- **Every map key names a rule.** This catches the failure that actually happens
  — a rule renamed or misspelled, whose transformer then never fires and whose
  absence looks like a parser bug.
- **Every entry's kind agrees with its rule's.** The entry's tag against the
  `RuleSet`'s kind, all four ways — `unit` excepted, which matches any kind
  because it reads nothing. This is a *construction*-time check and not a
  type-level one, and it cannot be otherwise: the map's type does not know the
  `RuleSet`, so `character: terminal(…)` for a variant rule type-checks
  perfectly and is caught only here. The uniform protocol of the earlier draft
  could not catch it at all, at either time, because one shape fits every rule
  by definition (§1).
- **`start` resolves.** `K extends string` accepts any name — it has to, since a
  start rule the map does not transform is legal (`_Output` gives it `unknown`)
  — so nothing in the type stops a typo. The builder resolves `start` against
  the `RuleSet` alongside every map key, and throws there rather than letting a
  mistyped start rule reach the machine and fail on the first parse.
- **No mapped branch sits under an unmapped variant.** The tag would have
  nowhere to go, so that map is refused here too, naming both rules — §3 is
  where the reasoning is.

The type reads `Map_` as the map literal's *own* type, which is why §8 says to
check the map with `satisfies` and never to annotate it: an annotation makes
every declared key optional and present in `keyof Map_` at once, and then
`_Output` cannot tell a rule the map supplies from one it omits.

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
this design forbids — a value beside a `null` remainder — and a type that admits
what the contract rules out has to be explained twice and checked by hand. Here
each state carries exactly what it has: only `ok` carries a value, and only `ok`
promises a non-`null` remainder, because a parse that ran out of input has
neither. It reads as `Result` does elsewhere in the repository, so nothing new
is invented, and `parserRuleSet`'s own `MatchResult` is untouched.

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
its transforming entry keeps all of that, replacing `ast` with the same two
outcomes. Two backends, one input type, two result types, one protocol: the
split [`../matcher/README.md`](../matcher/README.md) already draws between what
is shared and what is each machine's own, with the leaf moving from the second
column to the first.

The start rule moves into the builder, and that is what connects the map to the
parse's type: a map written as an object literal keeps its literal keys, so
`Map_[K]` is the start rule's *own* transformer and `_Output` reads the output
type out of it — no cast, and no unconstrained type parameter for a caller to fill in
by annotation. A start rule the map does not name gives `unknown`, which is
honest: it builds an AST node whose children may themselves be transformed
values, so it is not an `Ast<CodePoint>` and must not claim to be.

The remainder keeps its present meaning in every case: what is left where the
match stopped, and `null` where the input ran out. It is a suffix of the input,
so it is leaves rather than bare symbols now — the metadata a caller passed in
comes back with whatever it did not consume.

`parserRuleSet` then **is** this machine with an empty map and the trivial
`Monoid<null>`: with no entries every value is a node the four default builders
of §3 produce, over the shared leaf. Its type does change, and only there — the
leaf it builds its AST over gains metadata like everything else (§7), which is a
breaking change whose only callers are `ll1`'s own proofs.

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

**Refusal is not a channel in the protocol.** The four signatures return
`Meta<T, M>` and nothing else: there is no `Result` for a transformer to refuse
through. A rule that must reject a value it can parse but cannot represent —
`1e999`, a duplicate `__proto__` key, an unresolved `const`, everything
[DESIGN.md §10](../../../DESIGN.md#10-refuse-what-you-cannot-handle) says to
refuse rather than answer with a plausible value — does it by making `Result`
part of its **own** `T`. A rule that can overflow declares
`Result<number, string>` as its value,
its parent's child type says so, and the parent decides whether to propagate or
handle it.

That is a real simplification rather than a deletion, because it makes the
guarantee this issue most needed hold by construction:

**A refusal never changes what the grammar accepts** — and with the refusal
inside `T`, there is no longer any mechanism by which it could. Aborting the
parse at the refusing rule would have been wrong, and `descent` is where it
shows: a child can succeed and run its transformer inside a branch that a
*later* item then fails, so the parser moves on to another alternative. Try
`[specialNumber, 'x']` before `[plainText, 'y']` on an input ending in `y`: if
`specialNumber` refuses, aborting rejects an input the grammar accepts, and
which inputs parse becomes branch-order dependent. `ll1` needs the same answer
for a reason of its own — a refusal is not final even where nothing can be
abandoned, because a later sibling can still fail syntactically, and then the
honest answer is a syntax failure with no value (§5), not a semantic error about
a parse that never happened. Both are now non-questions: an error is a value, it
travels up as any value does, and a branch the parser abandons drops it with
everything else it produced.

**What it costs is the diagnostic the engine used to attach.** An earlier draft
had `end` return `Result<T, string>` and the engine complete it into
`{ rule, at, message }`, because a transformer knows only the reason — not what
it is called or where in the input it ran. With refusal in `T`, that completion
has nowhere to happen, and the position has to come from `M` instead. This is
the concrete reason `M` matters even for a grammar that wants no metadata for
its own sake: a grammar whose transformers refuse should carry positions in `M`,
and one that does not can only report *what* went wrong, not *where*.

That trade is what the signatures say, and it is the one part of the redesign
not yet confirmed — see the open question. The alternative is to wrap the return
as `Result<Meta<T, M>, Refusal>` in all four kinds, restoring `refused` to §5's
result at the cost of a channel every rule pays for and a second error union
beside the one a transformer's `T` can already carry.

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

**That position is a refusal's, but only if the refusing rule captures it.** A
refusing transformer has its own merged `M` in hand, which under this monoid is
where its rule started — so it can put that position *into the error value* it
returns (§6). What it cannot do is leave the position on the channel and expect
an ancestor to recover it: by then the `M` a parent sees is the merge of *its*
children, which under "leftmost" is the parent's own start, and a tuple with two
refusing slots has no way to tell them apart at all. So the rule is capture at
the point of refusal, and it is a constraint on how a refusing transformer is
written rather than something the channel does for it. This is the diagnostic
the engine used to attach, moved to the only place that still knows the
answer — and it is a cost of the refusal decision, not a free consequence of
having `M`.

**One `M`, and a payload coexists with a mergeable field inside it.** The
obvious worry is that these are two different things: a tokenizer's decoded
number is consumed at the leaf and no parent wants it merged, while a position
does want merging. They do not need two channels, because `M` may be a product
and a monoid on a product is componentwise:

```ts
type M = readonly[Pos, Payload]                    // Pos = a range, Payload = a token's value
const monoid: Monoid<M> = {
    identity: [undefined, undefined],
    // position: leftmost defined. payload: never merges, so no parent sees one.
    operation: ([p0]) => ([p1]) => [p0 === undefined ? p1 : p0, undefined],
}
```

The payload field's operation is constantly the identity, which is associative
and unital, so this is a monoid. Its effect is exactly the semantics wanted: a
leaf keeps its payload (the input supplied it, the monoid never touches it), the
terminal transformer reads it, and every parent sees `undefined` there while
positions keep combining. **So the design commits to one `M`** — a second,
unmerged channel would change `Meta`, every transformer signature, the erased
map representation and the matcher API, and it is not needed to express this.

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
structure an action would be inferred from. That result stands and is not
worked around here — it is sidestepped, because this map is keyed over the
**data** `RuleSet`, which is a flat `Record<string, Rule>` whose recursion goes
through string names. There is no type-level cycle to break.

So an author declares the value domain by rule name and gets ordinary static
checking of every transformer's result:

```ts
type Values = {
    readonly digits: string
    readonly item: Result<number, string>
    readonly list: Result<readonly number[], string>
    // …
}
type Transformers = { readonly[K in keyof Values]?: Transformer<M, Values[K]> }

const map = { /* … */ } satisfies Transformers   // checked, never annotated
```

**`satisfies`, not an annotation**, and the difference is not stylistic. The
properties are optional, because a grammar has rules no one transforms — so
`const map: Transformers = …` widens every key to
`Transformer<M, T> | undefined`, whether or not the map supplies it. `Map_[K]`
is then a union in a non-distributive position, `_Output`'s conditional does not
match, and **every** start rule resolves to `never`: the map compiles, and the
first use of the parse's value does not. `satisfies` checks each result against
`Values[K]` while keeping the
literal's own keys, so a rule the map supplies infers its `T` and one it omits
falls through to `unknown` — exactly the reason
[`fjs/AGENTS.md` §3.2](../../AGENTS.md#prefer-satisfies-over-type-when-checking-not-overriding)
prefers `@satisfies` wherever the goal is to check a shape rather than to
declare one.

**Do not "fix" that `never` with `NonNullable<Map_[K]>`.** It looks like the
obvious repair and it is the unsound one: stripping the `undefined` makes an
*omitted* start rule infer `Values[K]` while the parse takes the unmapped path
and returns an AST node — a wrong type reported confidently, in place of a
compile error. The `never` is the failure worth having, and the fix belongs at
the map, not at `_Output`.

Every transformer's result is checked against the rule's declared output, and
`_Output` (§5) reads the start rule's entry back out of the same map to type the
parse's result. A `RepeatTransformer`'s own `S` is checked where it is written;
the map only ever sees the erased `Transformer<M, T>`.

**Children are typed, and this is what the four kinds bought.** A uniform
`update` taking one child at a time has `unknown` as its item type, so every
child type in a map was an annotation the author wrote and nobody checked. Here
a sequence transformer declares its children as a tuple and a variant
transformer as a record of branches; the callback destructures them and each
child arrives at its declared type.

**What is *not* checked, and it is worth being exact about it.** `C` is a type
parameter, so it is erased: neither a sequence's tuple nor a variant's record of
branches survives to construction, and nothing compares either against the
`RuleSet`. A `C` with the wrong arity, two positions transposed, or a branch
name the grammar does not have still compiles and still builds a parser. So `C`
is the author's claim about the grammar, exactly as the old per-callback
annotation was.

What changed is how much that claim can go wrong and how visibly:

- **It is one claim per rule instead of one per child**, written where the rule
  is named rather than inline in a callback.
- **A variant's claim is keyed by name.** Positions can transpose silently;
  names cannot. And the compiler enforces the claim *internally* — a callback
  that fails to handle a branch it declared does not compile — so the residue is
  narrowed to "did I declare the branches this grammar actually has", not "did I
  handle the ones I declared".
- **The kind itself *is* checked**, at construction, against the `RuleSet` (§5).
  That is the one part of the shape the map carries to runtime, because the §9
  helpers write it as a tag.

Making `C` checkable would mean carrying the branch names or the arity as data
rather than only as types — the helpers could take them — which is a real option
and is left to the open question below rather than assumed here.

The rest of what runs at parser construction is in §5.

RTTI is **not** on this path. `in`/`out` schemas per transformer, `subset`
compatibility at instantiation, and per-node `parse` remain available as an
optional debug layer for anyone who wants values checked at a boundary, and
their open question (a boundary `subset` cannot prove) stops being this issue's
blocker because nothing here depends on the answer.

#### 9. Helpers

The four shapes are the primitive; the ergonomics come from a small library over
them. It is also what writes the §5 kind tag, so an author never types one:

```ts
// tagging constructors: a §1 shape in, a map-installable `Transformer` out
const terminalOf: <M, T>(f: TerminalTransformer<M, T>) => Transformer<M, T>
const seqOf:      <M, C extends readonly unknown[], T>(f: SequenceTransformer<M, C, T>) => Transformer<M, T>
const variantOf:  <M, C, T>(f: VariantTransformer<M, C, T>) => Transformer<M, T>
const repeatOf:   <M, C, S, T>(r: RepeatTransformer<M, C, S, T>) => Transformer<M, T>

// sugar over them: the callback sees the value alone, `M` is forwarded unchanged
const terminal: <M, T>(f: (leaf: L) => T) => Transformer<M, T>
const seq:      <M, C extends readonly unknown[], T>(f: (children: C) => T) => Transformer<M, T>
const variant:  <M, C, T>(f: (b: Branch<C>) => T) => Transformer<M, T>
const list:     <M, C>(m: Monoid<M>) => Transformer<M, readonly C[]>
const text:     <M>(m: Monoid<M>) => Transformer<M, string>
const unit:     readonly['unit']
```

- **The four `…Of` constructors are the primitive, and there is no way around
  them.** A map entry must carry the §5 kind tag — the construction-time kind
  check reads it, and at runtime nothing else can distinguish a terminal
  transformer from a variant one — so a bare `TerminalTransformer` or a
  hand-written `RepeatTransformer` is *not* installable as written. It is
  `terminalOf(f)` and `repeatOf(r)` that make it one. An author still never
  types a tag; the constructor writes it.
- `terminal`, `seq`, `variant` — the same three composed with "forward `M`
  unchanged", for the common case of a transformer that does not care about
  metadata. A transformer that *does* care is the §1 shape passed to its
  `…Of`. `terminal`'s callback is **not** given an EOF branch, so a rule that
  can match the synthesized end-of-input symbol is `unit` or a
  `terminalOf` that handles `EOF` (§2).
- `list(m)` — `repeatOf` applied to the identity fold: children in, array out,
  O(1) per item. It takes the monoid because a repetition is the one kind that
  has to combine its rounds' metadata itself (§3).
- `text(m)` — the common lexeme case: its children concatenated into a string,
  whether they are matched leaves or the strings a child rule's own transformer
  already produced.
- `unit` — keeps nothing, and is not a kind: it fits any rule, and the engine
  answers it without calling anything (§5). Its own subtree costs nothing,
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
type Item = Result<number, string>
type Nums = Result<readonly number[], string>
{
    digit:   terminal(c => String.fromCodePoint(c)),
    digits:  text(m),
    minus:   terminal(() => '-'),
    noSign:  seq(() => ''),
    sign:    variant(([, s]: Branch<{ minus: string, noSign: string }>) => s),
    item:    seq(([s, d0, ds]: readonly[string, string, string]) => {
                 const n = Number(`${s}${d0}${ds}`)
                 // §6: refuse what cannot be represented
                 return Number.isSafeInteger(n) ? ok(n) : error(`${s}${d0}${ds} not a safe integer`)
             }),
    next:    seq(([, it]: readonly[unknown, Item]) => it),
    more:    list<M, Item>(m),
    some:    seq(([first, rest]: readonly[Item, readonly Item[]]) =>
                 allOk<number, string>([first, ...rest])),
    noItems: seq(() => ok([])),
    items:   variant(([, xs]: Branch<{ some: Nums, noItems: Nums }>) => xs),
    list:    seq(([, xs]: readonly[unknown, Nums, unknown]) => xs),
}
```

Read the shapes off it. `digit` is a terminal and gets a leaf. `sign` and
`items` are variants and get a branch. `more` and `digits` are repetitions and
are the only two folds. Everything else is a sequence and gets a tuple — one
slot per item, punctuation included, which is where the cost below lives.

`item` takes a `digit` *and* a `digits` repetition because a `Repeat` matches
zero rounds (§2). With `[sign, digits]` alone, and `noSign` also empty, `item`
would match nothing at all: `Number('')` is `0`, so `[,]` would be accepted and
answer `ok([0, 0])`. One-or-more has to be spelled as one plus zero-or-more.

**Every rule above `item` carries the refusal, and that is the open question's
price in code.** `item` refuses, so its value is `Result<number, string>` (§6).
`next` forwards one. `more` collects a list *of results*. `some` has to
`allOk` them into a single result — and needs explicit type arguments to do it,
because `Result`'s two arms make `E` ambiguous to infer. `noItems` returns
`ok([])` rather than `[]`, so the variant's two branches agree. `items` and
`list` then thread the result outward, and `Nums` appears in four signatures
that have nothing to do with numbers being out of range.

That is refusal-in-`T` working exactly as specified, and exactly what it costs:
**one refusing rule puts a `Result` in every container above it, and every
container has to sequence its children's.** The alternative —
`Result<Meta<T, M>, Refusal>` in all four kinds — deletes `allOk`, `noItems`'s
`ok`, and `Nums`, and moves the propagation into the engine where a caller never
writes it, at the price of a channel every rule pays for. This example is the
argument; stage 0 is where it is decided.

**`list` sees its own brackets, and that is the sharpest remaining ergonomic
cost.** Every direct child occupies a slot: a punctuation rule with no
transformer contributes its AST node, and `unit` contributes `undefined` rather
than removing itself from the tuple. `list`'s tuple is three slots — `[`, the
items, `]` — and the `unknown`s above are where the brackets land. Typed
children make this *safer* than it was without making it shorter: a mis-counted
sequence is now a type error at the first use of a child rather than a runtime
surprise, but the count is still the author's to get right, and nothing checks a
`C` whose length or order disagrees with the rule (§8).

That is tolerable for a rule the author wrote, and **not** tolerable for one a
combinator built: `commaJoin0Plus(ws)('[]', item)` expands into exactly the
`items`/`some`/`more`/`next`/`noItems` scaffolding above, except that the author
never wrote it and cannot see it, so counting positions through it is guesswork
against an implementation detail. That is why the silent-rules question is
stage 0 (§8, Tasks) rather than stage-2 sugar: a rule marked silent, a
designated `unit` the engine drops from the tuple, or combinator-aware helpers
that know the shapes they build.

**Declaring a type for a variant means transforming all of it.** `items`
declares two branches and `sign` declares two, so all four must be mapped —
`noItems` and `noSign` included, which is why two rules exist only to return
`ok([])` and `''`. An unmapped branch would hand its variant an AST node, and
`Branch<{ some: Nums, noItems: Nums }>` says that is wrong at the map rather
than at some later use of the value. Separately, a mapped branch under an
*unmapped* variant is refused at construction (§3).

So adoption is incremental *up to* the first variant whose value you want typed,
and from there down it is all-or-nothing.

**What this saves is the tree, not every node.** A partial map leaves
punctuation terminals and the grammar's anonymous rules untransformed, so each
of those still builds its own node (§3). What no longer happens is the O(*n*)
part: a mapped rule builds no node, and the nodes its unmapped children built
are dropped as soon as it folds them, so nothing accumulates into a root AST.
Only a map that names every reachable rule — the recognizer below — allocates no
node at all.

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
inherited attribute, and a fold only synthesizes. Two ways out, to be chosen
when that work starts:

- **A downward channel** in the engine, so a rule can see what its ancestors
  bound. New mechanism, but the state stays plain data.
- **The value transformer returns a closure** `(refs) => AstConst` that the
  module transformer applies. Pure and needs no new mechanism, but it costs two
  things: "const not found" moves out of the parse and needs the offending
  metadata captured in the closure, and — the one that matters — a closure
  nested in a half-built array or object *is* a repetition's state while later
  siblings are parsed, so a parse suspended there holds functions. That
  contradicts §1 and §4.2, where a suspended parse is plain data.

So the closure is not the cheap default it looks like: taking it means saying
out loud that a DJS parse is exempt from the checkpointing contract. Prefer the
downward channel unless that exemption is acceptable, and decide it with the
port rather than now.

Worth noting against `M`: an inherited attribute is *not* what the metadata
channel provides. `M` flows up with values, so it can carry where a `const`
reference was but not what an earlier statement bound to it.

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

**11.3 `mapRule` is dropped, and name-keying costs the grammar its spelling.**
Wrapping rules in the functional form to carry actions required every consumer
(`toData`, `dispatchMap`, both backends) to learn to skip a wrapper, in exchange
for TypeScript inference that §8's predecessor proved does not survive a cyclic
grammar. Keying by data-rule name keeps the grammar untouched instead — but only
rules `toData` can *name* may carry a transformer, and that bites harder than "a
caveat".

`toData` takes a name from a thunk's `fr.name`, so a rule written as a named
`() =>` thunk keeps its name, while anything else — a `const` bound to an array
or an object literal, an inline combinator call — is anonymous and gets a
generated one (with `newName` disambiguating collisions). Measured on the
shipped example: `toData(deterministic())`
([`../testlib.f.mjs`](../testlib.f.mjs)) produces **92 rules**, named `1`…`87`,
`r`, `r0`…`r3`, `value`, and `""` for the entry. One name in ninety-two is
meaningful, because `value` is the only rule that grammar spells as a thunk.

So a grammar meant to carry transformers has to be *written* for it, with every
rule an author wants to transform bound as a named thunk. That is an authoring
rule rather than a limit of the protocol, but it is work on every existing
grammar — which is why stage 2 starts by giving the example grammar stable names
instead of by writing transformers for it. The construction-time name check (§1)
is what turns getting this wrong into a failure at construction rather than a
transformer that silently never fires.

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
this part of the section becomes an import. Note what the refusal decision in §6
already bought here — with an error living in the transformer's own `T` rather
than in a `Result` around `end`, there is no longer a second difference to
reconcile.

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

### Tasks

Staged. **Stage 0 is three decisions and no code** — each changes what stage 1
publishes, so taking them afterwards means republishing it. Then
**`fjs/bnf/ll1` is stage 1** — not because it is the easier machine (it is,
marginally) but because it is the one that settles the rest of the design:

- It **never backtracks**, so no transformer runs on a branch the parse goes on
  to abandon — which removes the *speculative* half of §6 from stage 1. With a
  refusal living in the transformer's own `T` (§6), a refused value is discarded
  with everything else a failed match produced, so stage 1 has that case for
  free and stage 3 adds only the abandoned-branch one.
- It is the backend that can promise **bounded-memory input streaming** (§4.2),
  which is what a payload-free recognizer over a stream needs and what the
  fold-level guarantee alone does not give.
- It is the **smaller change**, and stage 1 is where the protocol's shape is
  still cheap to move: `ll1` has no rewind state and no furthest-failure record,
  so its machine is the one to be wrong on first. `fjs/djs`'s port is the
  larger, riskier change and needs the inherited-attribute question (§10)
  answered before it starts.
- It is the backend that **does not carry metadata yet**, so the leaf change of
  §7 lands here. Doing it in stage 1 is what lets stage 3 inherit the channel
  instead of adding it: `descent`'s leaf is already `CodePointMeta`, so once
  `ll1` matches, `M` is settled before the harder backend starts.
- `descentEquivalence` in `../ll1/proof.f.mjs` **already pins the AST both
  backends build**, so the conformance test for "the default transformer
  reproduces today's AST" exists before the change that has to keep it passing.

**Stage 0 — three decisions, before any code.** Each one changes stage 1's
*public* types or its construction validator, so taking them later means
republishing an API and rewriting proofs written against it. They are the three
open questions marked below, gathered here because they share that property:

- [ ] **The refusal channel (§6).** `Meta<T, M>` with the error in the
      transformer's own `T`, or `Result<Meta<T, M>, Refusal>` in all four kinds.
      This is `TransformMatchResult` itself. §10's example is the evidence: one
      refusing `item` puts a `Result` in every container above it, and each has
      to sequence its children's.
- [ ] **Silent children (§10).** `unit` currently occupies a slot in its
      parent's tuple. An engine that *dropped* it instead would change every
      sequence's arity, and with it every `C` a map declares and every proof
      written against one. That makes it a protocol decision, not the stage-2
      ergonomics question it was filed as.
- [ ] **Whether `C` is carried as data (§8).** Sequence arity and variant branch
      names are erased today, so only the kind reaches the construction check.
      Carrying them — the §9 helpers taking them alongside the callback — would
      make a grammar change that invalidates a map fail at construction instead
      of calling a callback with the wrong shape. It changes the `Transformer`
      representation and the validator, both of which stage 1 publishes.

Write §10's twelve-rule map against each candidate before choosing. It is short
enough to rewrite three times, complete enough that the map and the grammar
cannot disagree, and it is the only place these costs show up as something other
than prose — the `Result` plumbing, the punctuation slots, and the two rules
that exist only to give a variant's empty branch a value.

**Stage 1 — the protocol and `fjs/bnf/ll1`.**

- [ ] Add `Meta`, `Branch`, the four transformer types, the tagged erased
      `Transformer` and `TransformerMap` to `fjs/bnf/matcher/types.ts`, and the
      four default builders (§3) to its `module.f.mjs`.
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
      engine's native path builds a node from, so the specification and the
      implementation of the default cannot drift.
- [ ] Add `transformRuleSet` (§5) and run all three construction-time checks:
      every map key names a rule, every entry's **kind tag matches its rule's
      kind**, and `start` resolves. Throw rather than parse — `K extends string`
      cannot reject a mistyped start name, since an untransformed start rule is
      legal, and no type can reject a terminal transformer supplied for a
      variant rule, since the map's type does not know the `RuleSet`.
- [ ] Answer a `unit` entry without calling anything and without allocating —
      it is the fifth arm of `Transformer`, it matches any rule kind, and it is
      what makes stage 2's recognizer mode free (§5, §9).
- [ ] Refuse, in the same pass, a map that transforms the branch of an unmapped
      variant (§3): the branch has no node for the engine to tag, so the tag
      would vanish. Name both rules in the error, and prove that an empty map
      and an all-`unit` map both stay legal.
- [ ] Re-express `parserRuleSet` as that machine with an empty map, and keep its
      current result type; the one place the machine's erasure is undone is
      where a value comes back out of it.
- [ ] Prove a refusal is inert as far as the grammar is concerned (§6): with
      the error inside the transformer's `T` there is no engine mechanism to
      test, so what stage 1 owes is the case `ll1` has on its own — a later
      sibling failing syntactically after a rule whose value was an error, with
      the result a syntax failure and no value rather than a semantic one.
- [ ] Skip the transformer when the input runs out mid-rule, for every frame on
      the spine, so none is ever handed a truncated tuple (§5, §6).
      That reports `no-match` with a `null` remainder, as a rejected match
      reports `no-match` with the position it stopped at; the engine's native
      AST path keeps building its partial node, so `parserRuleSet` is unchanged.
- [ ] Proofs: `descentEquivalence` and the existing AST expectations unchanged
      under the empty map; what each kind receives per §2, including the EOF
      terminal, an empty `Sequence` and a zero-round `Repeat` (both of which
      must see the monoid's identity); all three construction-time checks; and a
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
- [ ] Only then rewrite the JSON example grammar's rules as **named thunks**, so
      `toData` keeps their names: `deterministic()` yields 92 rules of which exactly one,
      `value`, is named (§11.3), and no transformer map can address the rest.
      Prove the AST is unchanged — naming a rule must not reshape the grammar.
- [ ] Then give that grammar a transformer set, budgeting for what §10 counts:
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
      `descendantsTagged`, `slot`, `keyOf`, `_FoldFrame`; settle the inherited
      `refs` attribute (§10) there.
- [ ] Register any new module in `deno.json` per AGENTS.md, then run the check
      set that file prescribes — `tsc` (the environment's compiler, not a
      registry fetch: the repository pins no `typescript` package) and
      `fjs test`.

### Open questions

- **Does a transformer need a refusal channel of its own (§6)?** The four
  signatures return `Meta<T, M>`, so a refusing rule puts `Result` in its own
  `T` and the parse has no semantic-error outcome. That makes "a refusal never
  changes what the grammar accepts" true by construction and deletes §5's
  `refused` case, at the price of the diagnostic the engine used to attach: a
  transformer knows the reason but not its rule name or position, so a grammar
  whose transformers refuse has to carry positions in `M`. The alternative is
  `Result<Meta<T, M>, Refusal>` in all four kinds. **Stage 0**, because it is
  the public result type. §10 shows the cost concretely: with the error in `T`,
  a refusing `item` puts a `Result` in `next`, `more`, `some`, `noItems`,
  `items` and `list`, and `some` must `allOk` its children with explicit type
  arguments.
- **`C` is erased, so nothing checks it against the grammar (§8).** A
  sequence's arity and order, and a variant's branch names, are all the author's
  claim; only the *kind* survives to construction, because the §9 helpers write
  it as a tag. Carrying the rest as data would fix it — `variant` taking its
  branch names, `seq` its arity — at the cost of writing each twice and keeping
  them in step. **Stage 0**: it changes the `Transformer` representation and the
  construction validator, so adding it after stage 1 republishes both. It is
  also the silent-rules item below from the other side — a rule a combinator
  built is exactly the one whose arity an author cannot count.
- **Silent rules — stage 0, not stage 2 (§10).** `unit` occupies a tuple
  slot, so a positional callback must count punctuation, whitespace and every
  scaffolding node a combinator built. §10 runs into it immediately: its twelve
  rules *are* what `commaJoin0Plus` would have built, and an author counts slots
  through all of them. A rule marked silent, a
  designated `unit` the engine drops, or combinator-aware helpers. What moves
  this ahead of stage 1 is that the middle option **changes every sequence's
  arity** — and therefore every `C` in a map and every proof written against
  one. It is a protocol decision wearing an ergonomics question's clothes.
- **Does the product monoid read well on a real tokenizer (§7)?** Not a stage-0
  question, because the design is committed: **one `M`**, with a payload and a
  mergeable field coexisting as a product whose payload component's operation is
  constantly the identity (§7). That is a monoid, and it gives a leaf its
  payload while every parent sees only the merged positions. A second, unmerged
  channel would change `Meta`, every transformer signature, the erased map
  representation and the matcher API — the stage-0 property — which is exactly
  why it is ruled out here rather than left open. What the layered-parser port
  should report back is only whether the product is *pleasant* to write, and a
  helper for building one would be the answer if it is not.
- **`(state, item)` or `(item, state)` (§12).** The two shipped folds disagree.
  `RepeatTransformer` follows `todo/flow.md`; whoever unifies them may move it,
  and this issue should not settle a repository-wide argument on its own.
- **Output-level streaming (§4.3).** A typed drain needs the start rule to be a
  `Repeat` and needs its `S`, which the map erases; flow's output chunk taxes
  every rule with a channel it does not use. Deferred until a consumer names
  which cost it would rather pay.
- **The inherited attribute (§10).** Closure-returning transformers, or a
  downward channel in the engine? `M` does not answer it — it flows up. Decide
  with the DJS port, not before.
- **Input streaming (§4.2) is [43](./043-stateful-parser.md)'s.** This issue
  only has to leave the parser state plain data so that one can suspend and
  resume it; which of the two lands first decides where the entry points live.
- **Helper set (§9).** `terminal`, `seq`, `variant`, `list`, `text`, `unit` is a
  guess at the working set; let the JSON and DJS ports pick the final list.

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
