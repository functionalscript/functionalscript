## 207. BNF rule transformers: a streaming fold per rule

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
> This version keeps the goal and replaces the mechanism: a transformer is a
> **fold over a rule's children as they are matched**, keyed by rule name over
> the *data* `RuleSet`, applied by the matcher backends themselves. It never
> materializes the AST, it unblocks (§11.1), and it does not need RTTI to be
> useful. It is one design again, so the split is off.

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

A transformer is a fold over one rule invocation's children, in the shape this
repository already packages a fold as data (§12):

```ts
type Child = readonly[unknown, AstTag]

type RuleTransformer<S, T> = {
    readonly init: S
    readonly update: (state: S, child: Child) => S
    readonly end: (state: S) => Result<T, string>
}
```

- **`init`** is the state a rule invocation starts from, before its first symbol
  is consumed. A plain value, and that is the whole point: `() => S` adds a
  thunk that buys nothing, and a `create(first)` that starts from the first
  child is strictly *weaker* — it is `v => update(init, [v, undefined])`, while
  nothing recovers `init` from it, so a rule that matches empty could not be
  expressed at all. With `init` a value, an empty match is just `end(init)`.
- **`update`** folds in one child: a sequence item, a repetition round, a
  variant's chosen branch, or — for a terminal rule — the matched leaf. A
  `Child` is the child's *transformed* value — its own `end` result where it has
  a transformer, its AST node where it does not (§3) — paired with its tag,
  which names the branch when this rule is a variant and is `undefined`
  otherwise. Value first, annotation second, like `CodePointMeta<T>`
  (`readonly[CodePoint, T]`) in `fjs/bnf/descent`, so the usual transformer
  destructures `(state, [value]) => …` and never mentions the tag.

  **The `Result` is the engine's, not the child channel's.** A child's `end`
  returns `Result<T, string>` and the engine eliminates it before the parent
  sees anything: an `ok` is unwrapped, so a `Child` carries `T` and not
  `['ok', T]`; an `error` never reaches `update` at all, because a refusal
  replaces the enclosing fold's state instead of being folded into it (§6). So
  no transformer ever matches on a child's `Result`, and both backends owe the
  same event stream. That is why the examples in §10 destructure `key` rather
  than `['ok', key]`.
- **`end`** finishes the invocation. It may **refuse**: a transformer is where
  `1e999`, a duplicate `__proto__` key, or an unresolved `const` is caught, and
  [DESIGN.md §10](../../../DESIGN.md#10-refuse-what-you-cannot-handle) says
  those are refused rather than answered with a plausible value. A refusal is a
  *value*, not a control-flow event — it never changes what the grammar accepts
  (§6).

**One state, one item, uncurried.** Pairing the tag with the value rather than
passing it beside them is what makes `update` a fold's step and nothing more:
`(state, item) => state` is flow's `Transducer` exactly (§12), so a rule
transformer *is* a member of that family rather than a look-alike, and the
alphabet it folds — a tagged child — is nameable. Both parameters are data, and
currying data invites a partial application that captures an accumulator, which
is why `StateScan` was uncurried in
[#763](https://github.com/functionalscript/functionalscript/pull/763) and what
[uncurry-accumulator-types](../../types/function/todo/uncurry-accumulator-types.md)
is generalizing.

The engine pays one `Child` per child event, which two arguments would not cost.
It pays it only where a transformer exists: an unmapped rule's node is built by
the engine natively (§3), so an untransformed parse allocates no `Child` at
all.

Transformers are supplied as a map keyed by **data**-`RuleSet` rule name, which
means one map holds transformers whose states are unrelated types. `S` is
therefore **existential** in the map, and its upper bound is written by putting
`unknown` in every output position and `never` in every input one:

```ts
type Transformer<T> = {
    readonly init: unknown
    readonly update: (state: never, child: Child) => unknown
    readonly end: (state: never) => Result<T, string>
}
type TransformerMap = StringMap<Transformer<unknown>>
```

Every `RuleTransformer<S, T>` is assignable to `Transformer<T>` whatever `S` is,
and `Transformer<T>` stays covariant in `T` — `T` appears only in an output —
so a `Transformer<string>` sits in a `TransformerMap` unchanged. No `any`, and
no cast to *build* a map. The bound cannot be *called*, which is correct: the
engine eliminates the existential in one documented place (§5), where a state is
handed back to the transformer that produced it.

The state stays **plain data**, which is what
[`todo/flow.md`](../../../todo/flow.md) requires of an operator and what §4.2
needs: a parser state that is a closure cannot be serialized, checkpointed, or
shipped to another process, and a resumable streaming parse is the point.

A rule with no entry is not transformed — it builds its AST node exactly as
today. That is what makes adoption incremental: a grammar with an empty map
behaves bit for bit as it does now.

Two invariants the engine owes the author, both checkable:

- **`update` is called once per child, in input order, and `end` once per
  successful invocation.** An invocation the parser abandons gets any `update`s
  it reached and never `end`; children that already succeeded
  inside it did get their own `end`, and their values are dropped with the
  frame. An invocation whose child refused gets no further `update` and no
  `end` either: the refusal takes the place of its state (§6).
- **Every name resolves, and no tag is silently dropped.** The map's keys and
  the start rule are checked against the `RuleSet` when the parser is built
  (§5, §8), so a typo or a renamed rule fails at construction rather than as a
  transformer that never fires or a parse that throws on its first input. The
  same pass refuses a map that transforms the branch of an *unmapped* variant,
  which is the one shape where partial adoption would lose a tag (§3).

#### 2. What the events are, per rule kind

| Data rule kind  | Events, starting from `init`                                  |
|-----------------|--------------------------------------------------------------|
| `TerminalRange` | one `update(s, [leaf, undefined])`, then `end`                |
| `TerminalRange` matching EOF | `end` — no child                                 |
| `Sequence`      | one `update(s, [child, undefined])` per item, then `end`      |
| `Repeat`        | one `update(s, [item, undefined])` per round — none if it matched zero — then `end` |
| `Variant`       | exactly one `update(s, [value, branchTag])`, then `end`       |
| empty `Sequence`| `end` alone                                                   |

The leaf is the backend's own: `CodePoint` under `fjs/bnf/ll1`,
`CodePointMeta<T>` under `fjs/bnf/descent`, which is where per-symbol metadata
enters a transformer (§7).

**A terminal that consumed the synthesized end-of-input symbol folds in
nothing.** EOF has no source element, so it contributes no leaf — that is
[the EOF contract](../README.md#logical-eof-in-parser-input), and `leafAt` in
`fjs/bnf/matcher` is where it already lives: it yields the leaf inside the
physical input and an empty sequence at the end. An `eof` terminal's default
node is therefore `{ tag, sequence: [] }`, exactly as it is today, and its
transformer sees `create` then `end` with no `update` between them. The
alternative — synthesizing a `-1` child — would put a leaf in the AST that the
contract says is not there. Every helper (§9) has to be total over zero
children for the same reason a nullable rule makes it necessary.

Rule identity is what the AST lacks and the event stream has: the map is keyed
by rule name, so a transformer always knows which rule it is folding — the
"key observation" the previous design had to work around by walking the grammar
and the AST in lockstep.

**The tag rides on the edge, not on the invocation.** A tag says which branch of
a *variant* was taken, so it is something the variant produced, not something
its branch is. The `Child` an `update` folds in is that edge — value and tag
together — and it is the only place a tag is delivered: an `init` that is a
plain value has nowhere to receive one, which is the right answer rather than a
limitation.

A rule therefore does not learn the tag it was *entered under*, and almost never
wants to: in the data form each branch of a variant is a distinct rule name with
its own transformer, so branches are already told apart by which transformer
runs. What needs the tag is a variant whose branches *share* a rule —
`option(x)`'s `none` is the shared empty sequence — and there the variant's own
transformer reads it off its one `update`. The AST's habit of stamping the tag
on the branch's node is an encoding of the same fact, discussed in §3.

#### 3. What an unmapped rule builds

Its AST node, exactly as today — and the node builder is an ordinary
transformer, so the AST is one instance of this protocol rather than a rival to
it:

```ts
const astTransformer: RuleTransformer<List<unknown>, Ast<unknown>> = {
    init: null,
    update: (children, [child]) => concat(children)([child]),
    end: children => ok({ tag: undefined, sequence: toArray(children) }),
}
```

Its node is `Ast<unknown>`, because a child of an unmapped rule may itself be
transformed, so what a node holds is no longer only nodes and leaves. Children
accumulate as a `List`, which is also a small improvement on today's sequence
frame — that one spreads an array per item.

**The tag is the one thing this transformer cannot supply, and the engine keeps
supplying it.** A node's tag names the branch of the *enclosing variant* that
reached it (§2), and a variant contributes no node of its own: both backends
pass the branch tag *down* at rule entry and let the branch's node be the
variant's, so `ll1` does not even allocate a frame for a variant — it retargets
the current task. Since `init` is a value, a transformer has nowhere to receive
that tag, and the alternatives both cost something real: give the variant its
own default fold that re-tags its one child (a frame and a second node
allocation per variant invocation, on the path that is supposed to be
unchanged), or hand the tag to `init` and lose everything §1 gains from it.

So the tag stays the **engine's** business for unmapped rules. `astTransformer`
above is the *specification* of what an unmapped rule builds — its children, in
order, in one node — and the engine implements it natively so that an
untransformed parse still allocates exactly what it allocates today, a variant
still owning neither node nor frame. "The AST is one contract"
([`../README.md`](../README.md#the-ast-is-one-contract)) is then checkable two
ways: the `descentEquivalence` proof group in `../ll1/proof.f.mjs` pins the
empty-map parse unchanged, and a proof that the transformer above produces the
same children pins the specification to the implementation.

A variant *with* a transformer does get a frame (`descent` already has one for
trying branches; `ll1` gains one) and its one tagged `update` — an addition to
the AST model, not a reimplementation of it, paid for only where it is used.

A transformed value sitting inside an untransformed parent is an opaque child
of that parent's node, so `AstSequence<L>` widens to admit it. For a sequence or
a repetition that costs nothing — an item's own tag is `undefined` anyway (§2),
so there is nothing to lose.

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

**4.1 Fold-level (this issue).** A rule's children are folded as they are
matched, so nothing accumulates that a transformer did not ask to keep. Memory
is O(depth) frames plus the sum of the live states along the spine. A 1M-element
array is one frame whose state the author chose; a map that answers `unit` for
every rule keeps nothing at all, so the whole parse is O(depth) whatever the
input size — which is what [recognizer-backend](./recognizer-backend.md) wants
from a payload-free backend and cannot get while the AST is mandatory.

This is also where the AST's O(*n*) cost goes away rather than being paid and
discarded: an untransformed rule allocates its node, a transformed one does not.

**`update` must be O(1).** A transformer that spreads an array per child makes
its rule quadratic in the number of children — the exact trap `descent`'s
`_Items` and DJS's `_FoldFrame.done` comments already record. Accumulate with
`List` (or `Vec`) and flatten in `end`; the helpers in §9 do this so most
authors never touch it.

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
  the parser state. The root state's type is the start transformer's `S`, which
  `Transformer<T>` erases (§1), so it is `unknown` in and `unknown` out unless
  that erasure changes.
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
| Fold-level streaming (4.1) | yes | yes |
| Bounded-memory input (4.2) | yes | retains back to the oldest live rewind |
| A drained value can be un-drained by a rewind (4.3) | no | yes |
| Transformer may run on an abandoned branch | never | yes |

#### 5. Where it lives, and how the value gets out

In the shared matcher layer, not in a new pass over the AST and not twice.

Both backends are already the same machine: an explicit-stack loop whose frames
hold an `AstSequence` under construction, finished with `mrSuccess(tag, seq, pos)`
from [`../matcher/`](../matcher/). The change is to replace that
`AstSequence` with the invocation's transformer state and those constructor
calls with `create`/`update`/`end`. So:

- `RuleTransformer`, `Transformer` and `TransformerMap` go in
  `fjs/bnf/matcher/types.ts`, `astTransformer` in its `module.f.mjs`;
- each backend gains one entry point that takes a map (`transformRuleSet`
  below), and its frames carry `(rule name, state)` where they carried an
  `AstSequence`;
- no third walk exists to desync from the other two.

**Where the existential is eliminated.** A frame holds a state whose type the
map has erased, so calling `update` on it is the one place a cast is needed — it
is what "this state belongs to this transformer" means, and the frame carrying
the rule name is what makes the claim checkable by eye. Keeping the *name* in
the frame rather than a closure is also what keeps a suspended parse plain data:
`(rule name, state)` pairs and a cursor serialize, so §4.2's checkpoint is a
real one.

That is the answer to what the previous design called "parser-neutral
evaluation" (its `Semantics<R>` algebra). The algebra is right; it belongs in
the layer the backends already share, and it should be a fold over children
rather than a `reduce` over a materialized child array — see §11.2.

**Threading states through frames is not enough to return one.** Both public
results are typed to the AST — `DescentMatchResult.ast` and `ll1`'s
`MatchResult[0]` — so a transformed root has nowhere to go. A transforming
parse needs its own entry point and its own result:

```ts
// `fjs/bnf/ll1`'s own shape: its input, its remainder, its result.
type TransformMatchResult<T> =
    | readonly['ok', T, readonly CodePoint[]]   // matched, finished, nothing refused
    | readonly['refused', string, readonly CodePoint[]] // matched and finished; a transformer said no
    | readonly['no-match', Remainder]           // rejected, or the input ran out (`null`)

type TransformMatch<T> = (s: readonly CodePoint[]) => TransformMatchResult<T>

const transformRuleSet:
    (ruleSet: RuleSet) =>
    <M extends TransformerMap>(map: M) =>
    <K extends string>(start: K) => TransformMatch<_Output<M, K>>

type _Output<M, K> = K extends keyof M
    ? M[K] extends Transformer<infer T> ? T : never
    : unknown
```

`refused` carries a physical remainder for the same reason `ok` does: it can
only happen after the matched rule finished and ran `end`, and a parse that ran
out of input mid-rule never reaches `end` at all — that one is `no-match` with
a `null` remainder. `Remainder` there would re-admit `['refused', reason, null]`,
which is precisely the contradiction this union exists to rule out.

The type reads `M` as the map literal's *own* type, which is why §8 says to
check the map with `satisfies` and never to annotate it: an annotation makes
every declared key optional and present in `keyof M` at once, and then `_Output`
cannot tell a rule the map supplies from one it omits.

**`start` is checked too, not only the map's keys.** `K extends string` accepts
any name — it has to, since a start rule the map does not transform is legal
(`_Output` gives it `unknown`) — so nothing in the type stops a typo. The
builder resolves `start` against the `RuleSet` alongside every map key, and
throws there. Otherwise a mistyped start rule reaches the machine and fails on
the first parse instead of at the boundary that was built to catch exactly this
(§1).

**A parse that did not finish has no value, and the type says so.** The root's
`end` never runs when the grammar rejects the input — a failure propagates
straight out, past every frame — so there is no `T` to report and none is
invented. The same holds when the input **runs out** mid-rule: `end` is skipped
for every frame on the spine rather than called on a fold that is missing
children (§6 — a transformer is total for the shapes its rule can produce, and a
truncated sequence is not one of them). Both are `no-match`, told apart by the
remainder: where matching stopped, or `null` for input that ended first.

**That is why the result is a tagged union rather than a tuple with a boolean.**
A `[value, success, remainder]` tuple mirroring `MatchResult` can spell states
this design forbids — a refusal beside `success: false`, a value beside a `null`
remainder — and a type that admits what the contract rules out has to be
explained twice and checked by hand. Here each state carries exactly what it
has: only `ok` carries a value, and only `ok` promises a non-`null` remainder,
because a parse that ran out of input has neither. It reads as `Result` does
elsewhere in the repository, so nothing new is invented, and `parserRuleSet`'s
own `MatchResult` is untouched.

The AST path is unaffected either way — an unmapped rule's node is the engine's
own (§3), so `parserRuleSet` still reports the partial node it always has.

**The shape above is `ll1`'s, not a shared one.** Only the three *outcomes*
generalize. `fjs/bnf/descent` consumes `CodePointMeta<M>[]`, not `CodePoint[]`,
and returns `{ ast, success, idx, failure? }` rather than a remainder tuple —
its furthest-failure record is the reason that backend's result is an object.
Its transforming entry keeps all of that and replaces `ast` with the same three
outcomes. Two backends, two result types, one protocol: the same split
[`../matcher/README.md`](../matcher/README.md) already draws between what is
shared and what is each machine's own.

The start rule moves into the builder, and that is what connects the map to the
parse's type: a map written as an object literal keeps its literal keys, so
`M[K]` is the start rule's *own* transformer and `_Output` reads the output type
out of it — no cast, and no unconstrained type parameter for a caller to fill in
by annotation. A start rule the map does not name gives `unknown`, which is
honest: it builds an AST node whose children may themselves be transformed
values, so it is not an `Ast<CodePoint>` and must not claim to be.

The remainder keeps its present meaning in every case: what is left where the
match stopped, and `null` where the input ran out.

`parserRuleSet` then **is** this machine with an empty map, keeping its current
type: with no entries every value is a node `astTransformer` built, over leaves
that are this backend's own.

#### 6. Backtracking, purity, errors

A transformer **must be pure and total**: same inputs, same outputs, no effects,
no `throw` (the repository has no `try`/`catch`). Two reasons, and the first is
not negotiable:

- `descent` speculates. A branch it abandons has already had `create` and some
  `update`s. Because `S` is immutable, discarding it is dropping a frame — no
  undo protocol, which is the property that makes this design work under a
  backtracking parser at all, and the reason effects cannot be allowed.
- A transformer that is expensive multiplies backtracking cost, and moving the
  work into `end` does not avoid it: `end` runs for every invocation that
  *succeeded*, including one inside an alternative a later sibling then fails —
  which is the same invariant §1 states about abandoned frames, read from the
  other side. So under `descent` both `update` and `end` want to be cheap, and
  only `ll1` guarantees no transformer runs on work that is thrown away.

Refusal is `end`-only, on purpose. Anything a child could reject can be recorded
in the state and reported when the rule finishes, so `update` stays a plain
`(state, child) => S` and there is one place to look for a rejection. The
cost is that a refusal's *position* is the enclosing rule's, not the offending
child's, unless the transformer kept the child's metadata (§7) — which the
transformers that care already do.

**A refusal never changes what the grammar accepts.** Aborting the parse at the
refusing rule would be wrong, and `descent` is where it shows: a child can
succeed and run `end` inside a branch that a *later* item then fails, so the
parser moves on to another alternative. Try `[specialNumber, 'x']` before
`[plainText, 'y']` on an input ending in `y`: if `specialNumber`'s transformer
refuses, aborting rejects an input the grammar accepts, and which inputs parse
becomes branch-order dependent. Restricting transformers to non-speculative
rules is the other way out, and it is worse — it would make the protocol mean
something different on each backend.

So a refusal is a **value**. The refusing invocation's value is the error; the
enclosing fold takes it in place of its state and stops calling `update`; it
travels up the spine unchanged, so the first refusal is the one reported.
Matching continues exactly as it would have, and a branch the parser abandons is
dropped with its refusal like any other value it produced.

**`ll1` needs this rule too, for a reason of its own.** It is not merely
inheriting a constraint from the backtracking backend: a refusal is not final
when it happens even where nothing can be abandoned, because a *later sibling
can still fail syntactically*. Match `[specialNumber, 'x']` on input where
`specialNumber` matches, its transformer refuses, and the next symbol is not
`x`: the sequence does not match, so the honest answer is a syntax failure with
no value (§5), not a semantic error about a parse that never happened. Aborting
at the refusing rule would report the refusal instead — and would leave
`success` and the remainder with nothing to say. Carrying the refusal as a value
gets both right: it is discarded with everything else the failed match produced.

So the rule is the protocol's on both backends, and stage 1 exercises it rather
than merely implementing it.

#### 7. Metadata

There is no separate metadata channel, and none is needed. Under
`fjs/bnf/descent` a leaf *is* `readonly[CodePoint, T]`, so metadata arrives at
the terminal rule's `update` already attached, and each transformer keeps
whatever it needs — a span, a lexeme, nothing. A parent sees a child's metadata
only if the child's `end` includes it, the same forwarding rule as everything
else in a fold.

This replaces the previous design's mandatory `(leaf, merge, empty)` monoid
merged into every node. That monoid existed to guarantee error positions and to
carry lexemes across parser layers; the first is the engine's to attach — it
knows the rule and the cursor a refusal happened at, which is what the open
question about a refusal's payload is about — and the second is one transformer
returning a pair. An automatic span
monoid remains available as a *helper* (§9) for grammars that want one
everywhere, which is the right altitude for it — sugar, not a channel every
rule pays for.

For the [layered parser](./layered-parser.md) this is the same mechanism it
already wanted: a tokenizer layer's transformers reduce code points to a token
whose value channel is one symbol and whose payload rides in the value the
transformer returns; the next layer's leaves are those tokens. `fjs/djs` already
runs exactly this shape by hand.

#### 8. Types

The previous design proved that TypeScript cannot type a *functional* cyclic
grammar: the `: Rule` annotations that break the inference cycle erase the
structure an action would be inferred from. That result stands and is not
worked around here — it is sidestepped, because this map is keyed over the
**data** `RuleSet`, which is a flat `Record<string, Rule>` whose recursion goes
through string names. There is no type-level cycle to break.

So an author declares the value domain by rule name and gets ordinary static
checking of every `end`:

```ts
type Values = {
    readonly string: string
    readonly member: readonly[string, Json]
    readonly object: Json
    // …
}
type Transformers = { readonly[K in keyof Values]?: Transformer<Values[K]> }

const map = { /* … */ } satisfies Transformers   // checked, never annotated
```

**`satisfies`, not an annotation**, and the difference is not stylistic. The
properties are optional, because a grammar has rules no one transforms — so
`const map: Transformers = …` widens every key to `Transformer<T> | undefined`,
whether or not the map supplies it. `M[K]` is then a union in a non-distributive
position, `_Output`'s conditional does not match, and **every** start rule
resolves to `never`: the map compiles, and the first use of the parse's value
does not. `satisfies` checks each `end` against `Values[K]` while keeping the
literal's own keys, so a rule the map supplies infers its `T` and one it omits
falls through to `unknown` — exactly the reason
[`fjs/AGENTS.md` §3.2](../../AGENTS.md#prefer-satisfies-over-type-when-checking-not-overriding)
prefers `@satisfies` wherever the goal is to check a shape rather than to
declare one.

**Do not "fix" that `never` with `NonNullable<M[K]>`.** It looks like the
obvious repair and it is the unsound one: stripping the `undefined` makes an
*omitted* start rule infer `Values[K]` while the parse takes the unmapped path
and returns an AST node — a wrong type reported confidently, in place of a
compile error. The `never` is the failure worth having, and the fix belongs at
the map, not at `_Output`.

Every `end` is checked against the rule's declared output, and `_Output` (§5)
reads the start rule's entry back out of the same map to type the parse's
result. Each transformer's own `S` is checked where it is written, against the
`RuleTransformer<S, T>` it is written as; the map only ever sees the erased
`Transformer<T>`.

`update`'s `child` stays `unknown`. The child *names* are known only at runtime
(the `RuleSet` is built by `toData`, so TS never sees the literal), and an
author who narrows it does so unchecked — the same status as any `unknown`
narrowing, and better than the previous design's position, which needed a
schema language to say anything at all.

What runs at parser construction is **name resolution only**: every key in the
map names a rule in the `RuleSet`. That is O(rules), cannot be incomplete, and
catches the failure that actually happens (a rule renamed or misspelled, whose
transformer then never fires and whose absence looks like a parser bug).

RTTI is **not** on this path. `in`/`out` schemas per transformer, `subset`
compatibility at instantiation, and per-node `parse` remain available as an
optional debug layer for anyone who wants values checked at a boundary, and
their open question (a boundary `subset` cannot prove) stops being this issue's
blocker because nothing here depends on the answer.

#### 9. Helpers

The protocol is the primitive; the ergonomics come from a small library over it,
which is also where the O(1)-`update` discipline is enforced once:

- `map(f)` — a transformer from a plain function of the whole child list, for
  small fixed sequences: `map(([, inner]) => inner)`. This is the
  `reduce`-over-children shape of the previous design, recovered as sugar, and
  it is where `tryFold`'s relationship to this protocol is most visible (§12).
- `tuple(f)` — like `map`, positionally typed for a `Sequence`.
- `list()` — the identity fold for a `Repeat`: children in, array out, O(1) per
  item.
- `text()` — leaves in, string out; the common terminal/lexeme case.
- `unit` — keeps nothing: its own subtree costs nothing, though it still hands
  the parent a value to ignore (see §10). Whitespace, punctuation, and a
  recognizer's every rule.
- `span(inner)` — wraps a transformer so its result carries the source range
  merged from its children's metadata: the §7 monoid, opt-in.

A fixed sequence that wants positional destructuring uses `map`/`tuple` and pays
one small array; a repetition — where size is unbounded and streaming matters —
uses `list` or a hand-written fold. That is the split the previous design's
"positional elision" section was reaching for.

#### 10. Worked examples

**JSON value.** Over a JSON grammar in `fjs/bnf` — an example grammar that can
produce a value is what makes it checkable against a spec test vector, and is
not a codec (§11.6). A map names rules, so the grammar has to have names: this
is written against one whose rules are named thunks, which `deterministic()` in
[`../testlib.f.mjs`](../testlib.f.mjs) is **not** (§11.3), and giving it those
names is the first task of stage 2 rather than something this example can
assume:

```ts
// the grammar's rules, as named thunks:
//   value   = () => ({ object, array, string, number, … })
//   string  = () => ['"', characters, '"']
//   member  = () => [string, ws, ':', ws, value]
//   object  = () => ['{', ws, members, '}']
{
    character:  map(([c]) => decodeOne(c)),    // one decoded character
    characters: text(),                        // Repeat of character → string
    string:     map(([, chars]) => chars),
    member:     map(([key, , , , value]) => [key, value]),
    members:    list(),
    object:     map(([, , members]) => Object.fromEntries(members)),
    value:      map(([v]) => v),               // the branch's value, whichever it was
    ws:         unit,
}
```

`value` is in the map because `string` and `object` are its branches: a mapped
branch under an unmapped variant is refused at construction (§3), and here it
would also be the rule that gives a JSON value its type. `object` never sees a
quote, an escape, or a space *in its members* — each child rule's effective
value is what flows up, so the key is decoded and the value is built.

**What this saves is the tree, not every node.** A partial map like this one
leaves punctuation terminals and the grammar's anonymous rules untransformed, so
each of those still builds its own node (§3) — the very next paragraph is about
one of them. What no longer happens is the O(*n*) part: a mapped rule builds no
node, and the nodes its unmapped children built are dropped as soon as it folds
them, so nothing accumulates into a root AST. Only a map that names every
reachable rule — the recognizer below — allocates no node at all.

**But `object` does see its own braces, and that is the design's sharpest
ergonomic cost.** Every direct child reaches the parent: a punctuation rule with
no transformer contributes its AST node, and `unit` contributes a value rather
than suppressing the parent's `update`. So `object`'s callback receives four
children — `{`, the whitespace, the members, `}` — and
`Object.fromEntries(children)` would throw on the first brace. A positional
callback has to account for the whole sequence, which is what the destructuring
above does.

That is tolerable for a rule the author wrote, and **not** tolerable for one a
combinator built: `commaJoin0Plus(ws)('{}', member)` expands into option and
repetition scaffolding whose shape the author never wrote and cannot see, so
counting positions through it is guesswork against an implementation detail. So
the "silent rules" question below is not sugar — it is what makes a transformer
map writable over a grammar built from combinators, and stage 2 has to settle it
while writing this example rather than after. The options are a rule marked
silent (its value never reaches the parent), a designated `unit` value the
engine drops, or combinator-aware helpers that know the shapes they build.

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
`_FoldFrame` all delete: elements arrive at their container's `update` instead
of being searched for, and the engine's stack is the parser's already-explicit
one, so the hand-rolled stack that exists to survive deep nesting is not needed.

One thing does not fall out, and it is the design's honest limit: DJS resolves
`const` references against names bound by *earlier* statements, which is an
inherited attribute, and a fold only synthesizes. Two ways out, to be chosen
when that work starts:

- **A downward channel** in the engine, so a rule's `init` can see what its
  ancestors bound. New mechanism, but the state stays plain data.
- **The value transformer returns a closure** `(refs) => AstConst` that the
  module transformer applies. Pure and needs no new mechanism, but it costs two
  things: "const not found" moves out of the parse and needs the offending
  metadata captured in the closure, and — the one that matters — a closure
  nested in a half-built array or object *is* transformer state while later
  siblings are parsed, so a parse suspended there holds functions. That
  contradicts §1 and §4.2, where a suspended parse is plain data.

So the closure is not the cheap default it looks like: taking it means saying
out loud that a DJS parse is exempt from the checkpointing contract. Prefer the
downward channel unless that exemption is acceptable, and decide it with the
port rather than now.

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
child array. The conversion only goes one way: `create`/`update`/`end` gives you
`reduce` (accumulate, then apply — that is `map` in §9), while `reduce` cannot
give you streaming, because it must materialize every child list first. Both
current backends produce children one at a time, so the array is a construction
`reduce` would force them to build and this protocol does not.

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
and a `Repeat`'s events (`create`, one `update` per round, `end`) are the case
this protocol fits best.

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
optional (§8), the second is a helper (§7, §9), the third has shipped. What is
left is one protocol and its two backends.

#### 12. This is the repository's fold-as-data shape

`init`/`update`/`end` is not a new invention here. It is already shipped four
times and designed a fifth, and §1 is deliberately the same shape rather than a
sibling of it:

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
type, and this protocol is that instruction taken literally: a rule transformer
is an `Accumulator` whose item is a tagged child.

Stated against flow's operator, a rule transformer **is** a `Transducer` with
two of its four channels removed: no output stream (`O`) — a rule produces one
value, not a stream — and no early `done`, because a fold over a rule's children
ends when the rule does, not when the transformer decides. What is left is
`init`, `update: (state, item) => state`, and `end` yielding the summary `A`.
Its alphabet `I` is the `Child` of §1, which is exactly why the tag is paired
with the value instead of passed beside it: a fold has one item type, and
naming it is what makes this an instance rather than a look-alike.

Two deliberate differences remain, each with a reason:

- **A refusal carries a reason.** `Accumulator`'s `update` short-circuits with
  `Nullable<T>` and flow's `Step` with `done`; neither says *why*, and
  [DESIGN.md §10](../../../DESIGN.md#10-refuse-what-you-cannot-handle) wants a
  refusal, not a silence. Hence `end: (state) => Result<T, string>` (§6).
- **The state is existential in a map.** `Accumulator` and `Transducer` are each
  used one at a time; a `TransformerMap` holds many with unrelated states, which
  is what §1's erased `Transformer<T>` bound and §5's single elimination are
  for.

Settle the first and the parameter order below, and `RuleTransformer<S, T>` has
nothing of its own left to be: it becomes `Accumulator<Child, S, Result<T,
string>>`, and this section becomes an import.

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

Staged, and **`fjs/bnf/ll1` is stage 1** — not because it is the easier machine
(it is, marginally) but because it is the one that settles the design:

- It **never backtracks**, so no transformer runs on a branch the parse goes on
  to abandon — which removes the *speculative* half of §6 from stage 1 without
  removing the refusal rule itself: `ll1` still discards a refusal when a later
  sibling fails syntactically (§6), so stage 1 exercises the rule on the case it
  has, and stage 3 adds only the abandoned-branch case.
- It is the backend that can promise **bounded-memory input streaming** (§4.2),
  which is what a payload-free recognizer over a stream needs and what the
  fold-level guarantee alone does not give.
- It is the **smaller change**, and stage 1 is where the protocol's shape is
  still cheap to move: `ll1` has no rewind state and no furthest-failure record,
  so its machine is the one to be wrong on first. `fjs/djs`'s port is the
  larger, riskier change and needs the inherited-attribute question (§10)
  answered before it starts.
- `descentEquivalence` in `../ll1/proof.f.mjs` **already pins the AST both
  backends build**, so the conformance test for "the default transformer
  reproduces today's AST" exists before the change that has to keep it passing.

**Stage 1 — the protocol and `fjs/bnf/ll1`.**

- [ ] Add `RuleTransformer`, `Transformer` and `TransformerMap` to
      `fjs/bnf/matcher/types.ts`, and `astTransformer` to its `module.f.mjs`.
- [ ] Replace the `AstSequence` in `fjs/bnf/ll1`'s frames with the invocation's
      `(rule name, state)`, and its `mrSuccess` calls with `update`/`end`. The
      frame keeps its `tag`, which stays the engine's own for unmapped rules
      (§3), and the one cast that eliminates the state's existential lives at
      the `update` call.
- [ ] Add a variant frame — `ll1` has none today, because a variant only
      retargets the current task — and push it **only** for a variant the map
      names, so the untransformed path keeps costing neither a frame nor a node.
- [ ] Prove `astTransformer` (§3) folds the same children the engine's native
      path builds a node from, so the specification and the implementation of
      the default cannot drift.
- [ ] Add `transformRuleSet` (§5) and check **both** the map's keys and the
      `start` rule against the `RuleSet` at construction, throwing rather than
      parsing — `K extends string` cannot reject a mistyped start name, since an
      untransformed start rule is legal.
- [ ] Refuse, in the same pass, a map that transforms the branch of an unmapped
      variant (§3): the branch has no node for the engine to tag, so the tag
      would vanish. Name both rules in the error, and prove that an empty map
      and an all-`unit` map both stay legal.
- [ ] Re-express `parserRuleSet` as that machine with an empty map, and keep its
      current result type; the one place the machine's erasure is undone is
      where a value comes back out of it.
- [ ] Carry a refusal as a value (§6): it replaces the fold's state, suppresses
      the rest of its `update`s and its `end`, and propagates unchanged — and
      prove the case `ll1` has on its own, where a later sibling fails
      syntactically after a refusal and the result is a syntax failure with no
      value rather than a semantic error.
- [ ] Skip `end` when the input runs out mid-rule, for every frame on the spine,
      so no transformer is ever handed a fold that is missing children (§5, §6).
      That reports `no-match` with a `null` remainder, as a rejected match
      reports `no-match` with the position it stopped at; the engine's native
      AST path keeps building its partial node, so `parserRuleSet` is unchanged.
- [ ] Proofs: `descentEquivalence` and the existing AST expectations unchanged
      under the empty map; the per-rule-kind event order of §2 including the
      EOF terminal and an empty match; a refusal reported with `success: true`;
      the construction-time name check; and a deep-nesting case, since the fold
      now runs on the machine's explicit stack.

**Stage 2 — helpers and the first consumer.** The consumer is inside `fjs/bnf`,
not `fjs/media/json`: the boundary in §11.6 keeps the codecs off BNF at runtime,
so what transformers buy JSON here is an *example grammar that can produce a
value* to check against a spec vector.

- [ ] Settle the silent-child question (§10) — a silent rule, an engine-dropped
      `unit`, or combinator-aware helpers — before writing the example's map,
      since a rule a combinator built has scaffolding the author cannot count.
- [ ] Add the §9 helpers with the O(1)-`update` accumulation inside them.
- [ ] Rewrite the JSON example grammar's rules as **named thunks**, so `toData`
      keeps their names: `deterministic()` yields 92 rules of which exactly one,
      `value`, is named (§11.3), and no transformer map can address the rest.
      Prove the AST is unchanged — naming a rule must not reshape the grammar.
- [ ] Then give that grammar a transformer set, and prove it against the spec's
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
      untransformed path byte-identical.
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

- **What a refusal carries.** `string` is the placeholder in §1. A structured
  error — the rule name the engine already knows, plus a position — would make
  a transformer's refusal as diagnosable as a syntactic failure. Decide with
  stage 1, since the engine is what would attach the rule name.
- **`(state, item)` or `(item, state)` (§12).** The two shipped folds disagree.
  §1 follows `todo/flow.md`; whoever unifies them may move it, and this issue
  should not settle a repository-wide argument on its own.
- **Output-level streaming (§4.3).** A typed drain needs the start
  transformer's `S`, which the map erases; flow's output chunk taxes every rule
  with a channel it does not use. Deferred until a consumer names which cost it
  would rather pay.
- **The inherited attribute (§10).** Closure-returning transformers, or a
  downward channel in the engine? Decide with the DJS port, not before.
- **Input streaming (§4.2) is [43](./043-stateful-parser.md)'s.** This issue
  only has to leave the parser state plain data so that one can suspend and
  resume it; which of the two lands first decides where the entry points live.
- **Helper set (§9).** `map`, `tuple`, `list`, `text`, `unit`, `span` is a
  guess at the working set; let the JSON and DJS ports pick the final list.
- **Silent rules — no longer optional (§10).** `unit` still delivers an `update`
  to the parent, so a positional callback must count punctuation, whitespace and
  every scaffolding node a combinator built. That is guesswork against an
  implementation detail for any rule the author did not spell out, which the
  JSON example runs into immediately. A rule marked silent, a designated `unit`
  the engine drops, or combinator-aware helpers — pick one in stage 2, with the
  example as the test of whether it reads.

### Related

- [43. Stateful parser](./043-stateful-parser.md) — `init`/`append`/`end` on the
  input side; the same three-event shape at the other end of the pipeline, and
  what §4.2 needs.
- [`todo/flow.md`](../../../todo/flow.md) — the universal `Transducer` operator
  this protocol is shaped after (§12), where operator composition and stage
  fusion belong.
- [`fjs/types/list/types.ts`](../../types/list/types.ts) — `Accumulator` and
  `tryFold`, the shipped fold-as-data and its driver.
- [`fjs/crypto/sha2`](../../crypto/sha2/module.f.mjs) — `init`/`append`/`end`
  over a stream, the same trio one level up.
- [uncurry-accumulator-types](../../types/function/todo/uncurry-accumulator-types.md)
  — why §1's data parameters are uncurried.
- [recognizer-backend](./recognizer-backend.md) — "use the existing `Scan`
  family as the streaming contract (no new type)", which §12 follows.
- [i165](./layered-parser.md) — layered parser. §7 is the mechanism it wanted
  for carrying a lexeme between layers; each layer is one grammar plus one
  transformer map.
- [`../README.md`](../README.md#the-ast-is-one-contract) — the AST contract the
  default transformer (§3) has to keep reproducing.
- [`../data/README.md`](../data/README.md#the-repeat-rule) — the `Repeat` rule,
  whose events are §11.4.
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
  built on; §8 replaces that check with name resolution.
