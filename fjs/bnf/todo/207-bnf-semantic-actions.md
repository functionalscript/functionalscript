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
- `fjs/media/json` does not use BNF for values at all; it keeps a hand-written
  tokenizer and a container-stack parser
  ([parser-container-stack-bookkeeping](../../media/json/todo/parser-container-stack-bookkeeping.md)).
- Nothing can answer *"is this stream valid JSON?"* without building the whole
  value first
  ([streaming-recognizer](../../media/json/todo/streaming-recognizer.md),
  [detect-json](../../media/type/todo/detect-json.md)), because the AST is built
  whether or not anyone wants it.

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
type RuleTransformer<S, T> = {
    readonly init: S
    readonly update: (state: S, tag: AstTag, child: unknown) => S
    readonly end: (state: S) => Result<T, string>
}
```

- **`init`** is the state a rule invocation starts from, before its first symbol
  is consumed. A plain value, and that is the whole point: `() => S` adds a
  thunk that buys nothing, and a `create(first)` that starts from the first
  child is strictly *weaker* — it is `v => update(init, undefined, v)`, while
  nothing recovers `init` from it, so a rule that matches empty could not be
  expressed at all. With `init` a value, an empty match is just `end(init)`.
- **`update`** folds in one child: a sequence item, a repetition round, a
  variant's chosen branch, or — for a terminal rule — the matched leaf. `tag`
  is the child's tag, which names the branch when this rule is a variant and is
  `undefined` otherwise. `child` is the child's *transformed* value: its own
  `end` result if it has a transformer, otherwise its AST node (§3).
- **`end`** finishes the invocation. It may **refuse**: a transformer is where
  `1e999`, a duplicate `__proto__` key, or an unresolved `const` is caught, and
  [DESIGN.md §10](../../../DESIGN.md#10-refuse-what-you-cannot-handle) says
  those are refused rather than answered with a plausible value. A refusal is a
  *value*, not a control-flow event — it never changes what the grammar accepts
  (§6).

**Data parameters are uncurried.** `state`, `tag` and `child` are all data, and
currying data invites a partial application that captures an accumulator — the
reason `StateScan` was uncurried in
[#763](https://github.com/functionalscript/functionalscript/pull/763), and what
[uncurry-accumulator-types](../../types/function/todo/uncurry-accumulator-types.md)
is generalizing. `Accumulator` and flow's `Transducer` are both spelled this
way (§12).

Transformers are supplied as a map keyed by **data**-`RuleSet` rule name, which
means one map holds transformers whose states are unrelated types. `S` is
therefore **existential** in the map, and its upper bound is written by putting
`unknown` in every output position and `never` in every input one:

```ts
type Transformer<T> = {
    readonly init: unknown
    readonly update: (state: never, tag: AstTag, child: unknown) => unknown
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
- **Every key resolves.** Names are checked against the `RuleSet` when the
  parser is built (§8), so a typo or a renamed rule fails at construction,
  before any input — never as a transformer that silently never fires.

#### 2. What the events are, per rule kind

| Data rule kind  | Events, starting from `init`                                  |
|-----------------|--------------------------------------------------------------|
| `TerminalRange` | one `update(s, undefined, leaf)`, then `end`                  |
| `TerminalRange` matching EOF | `end` — no child                                 |
| `Sequence`      | one `update(s, undefined, child)` per item, then `end`        |
| `Repeat`        | one `update(s, undefined, item)` per round — none if it matched zero — then `end` |
| `Variant`       | exactly one `update(s, branchTag, value)`, then `end`         |
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
its branch is. `update`'s `tag` parameter is that edge, and it is the only place
a tag is delivered — an `init` that is a plain value has nowhere to receive one,
which is the right answer rather than a limitation.

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
    update: (children, _, child) => concat(children)([child]),
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
of that parent's node, so `AstSequence<L>` widens to admit it. Such a child
carries no tag, because a tag lives on a node and there is no node. If the tag
matters there, transform the parent too; partial adoption is a convenience, not
a contract.

#### 4. Streaming

Three independent levels. Only the first is this issue's core; the other two
are what it makes possible, and both are named here because the protocol has to
be shaped to admit them.

**4.1 Fold-level (this issue).** A rule's children are folded as they are
matched, so nothing accumulates that a transformer did not ask to keep. Memory
is O(depth) frames plus the sum of the live states along the spine. A 1M-element
array is one frame whose state the author chose; a recognizer's states are all
unit, so the whole parse is O(depth) whatever the input size — which is what
[detect-json](../../media/type/todo/detect-json.md) needs and cannot get today.

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

**4.3 Output-level.** A fold produces its value at the root's `end`, which for a
1 GB document is still a 1 GB value unless the transformers discard. The way to
get results *out* early, without letting a transformer perform effects (§6),
is to let the caller read the root:

```ts
const partial: (s: ParserState) => unknown   // the start rule's current transformer state
```

A `document = repeat(record)` grammar accumulates records in the root's state;
the caller drains them between `append` calls and hands back a state with the
drained ones removed. Pull, not push, so purity is untouched.

`partial` is monotone only under `ll1`. Under `descent` a rewind can discard
updates the caller has already seen, so the two backends differ here — the one
place in this design where they do, and it is inherent to backtracking rather
than a wart to fix.

**4.4 What each backend can promise.**

| | `fjs/bnf/ll1` | `fjs/bnf/descent` |
|---|---|---|
| Fold-level streaming (4.1) | yes | yes |
| Bounded-memory input (4.2) | yes | retains back to the oldest live rewind |
| Monotone `partial` (4.3) | yes | no |
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
type TransformMatchResult<T> = readonly[Result<T, string>, boolean, Remainder]
type TransformMatch<T> = (s: readonly CodePoint[]) => TransformMatchResult<T>

const transformRuleSet:
    (ruleSet: RuleSet) =>
    <M extends TransformerMap>(map: M) =>
    <K extends string>(start: K) => TransformMatch<_Output<M, K>>

type _Output<M, K> = K extends keyof M
    ? M[K] extends Transformer<infer T> ? T : never
    : unknown
```

The start rule moves into the builder, and that is what connects the map to the
parse's type: a map written as an object literal keeps its literal keys, so
`M[K]` is the start rule's *own* transformer and `_Output` reads the output type
out of it — no cast, and no unconstrained type parameter for a caller to fill in
by annotation. A start rule the map does not name gives `unknown`, which is
honest: it builds an AST node whose children may themselves be transformed
values, so it is not an `Ast<CodePoint>` and must not claim to be.

The other two slots keep their present meaning, and all three are independent: a
grammar that did not match reports `success: false`, a match that ran out of
input reports a `null` remainder and a value folded from a truncated match, and
a transformer that refused reports `error` with `success: true`. Read the value
when the grammar matched and the remainder is empty.

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
- A transformer that is expensive multiplies backtracking cost. Keep `update`
  cheap; do the work in `end`, which runs only on a branch that survived.

Refusal is `end`-only, on purpose. Anything a child could reject can be recorded
in the state and reported when the rule finishes, so `update` stays a plain
`(state, tag, child) => S` and there is one place to look for a rejection. The
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
dropped with its refusal like any other value it produced. Under `ll1` this is
indistinguishable from aborting — nothing can be abandoned, so the first refusal
is already final — but the rule belongs to the protocol, not to a backend, so
both implement the same one.

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
```

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
- `unit` — discards everything; a whole subtree costs nothing. `ws0`,
  punctuation, and a recognizer's every rule.
- `span(inner)` — wraps a transformer so its result carries the source range
  merged from its children's metadata: the §7 monoid, opt-in.

A fixed sequence that wants positional destructuring uses `map`/`tuple` and pays
one small array; a repetition — where size is unbounded and streaming matters —
uses `list` or a hand-written fold. That is the split the previous design's
"positional elision" section was reaching for.

#### 10. Worked examples

**JSON value.** With the grammar from
[bnf-grammar-single-owner](../../media/json/todo/bnf-grammar-single-owner.md):

```ts
{
    character: map(c => decodeOne(c)),         // one decoded character
    characters: text(),                        // Repeat of character → string
    string:     map(([, chars]) => chars),     // '"' chars '"' → the chars
    member:     map(([key, , , , value]) => [key, value]),
    members:    list(),
    object:     map(entries => Object.fromEntries(entries)),
    ws0:        unit,
}
```

`object` never sees a quote, an escape, or whitespace, because each child rule's
value is what flows up. No AST node is allocated anywhere on this path.

**JSON recognizer.** The same grammar, with a map that answers `unit` for
every rule. The parse is O(depth) memory, no value is built, no token
payload is buffered, and the verdict is the parse's own success —
[streaming-recognizer](../../media/json/todo/streaming-recognizer.md) without a
second implementation of JSON's shape.

**DJS module.** `foldValue`, `descendantsTagged`, `slot`, `keyOf` and
`_FoldFrame` all delete: elements arrive at their container's `update` instead
of being searched for, and the engine's stack is the parser's already-explicit
one, so the hand-rolled stack that exists to survive deep nesting is not needed.

One thing does not fall out, and it is the design's honest limit: DJS resolves
`const` references against names bound by *earlier* statements, which is an
inherited attribute, and a fold only synthesizes. Two ways out, to be chosen
when that work starts — the value transformer returns a closure
`(refs) => AstConst` that the module transformer applies (pure, but the
"const not found" error moves out of the parse and needs the metadata captured
in the closure), or the engine gains an explicit downward channel. The first
costs nothing to try and is where to start.

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

**11.3 `mapRule` is dropped.** Wrapping rules in the functional form to carry
actions required every consumer (`toData`, `dispatchMap`, both backends) to
learn to skip a wrapper, in exchange for TypeScript inference that §8's
predecessor proved does not survive a cyclic grammar. Keying by data-rule name
keeps the grammar untouched. Its cost — only rules `toData` names can carry a
transformer, and it disambiguates collisions with `newName` — is real, and is
what the construction-time name check makes visible instead of silent.

**11.4 List flattening is already done.** The structural right-recursion
detection the previous design spent a section on shipped as the `Repeat` rule,
and a `Repeat`'s events (`create`, one `update` per round, `end`) are the case
this protocol fits best.

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

Three deliberate differences, each with a reason:

- **A refusal carries a reason.** `Accumulator`'s `update` short-circuits with
  `Nullable<T>` and flow's `Step` with `done`; neither says *why*, and
  [DESIGN.md §10](../../../DESIGN.md#10-refuse-what-you-cannot-handle) wants a
  refusal, not a silence. Hence `end: (state) => Result<T, string>` (§6).
- **`update` takes a tag as well as an item.** The edge from a variant to its
  branch carries information no other fold has to carry (§2).
- **The state is existential in a map.** `Accumulator` and `Transducer` are each
  used one at a time; a `TransformerMap` holds many with unrelated states, which
  is what §1's erased `Transformer<T>` bound and §5's single elimination are
  for.

Two things this alignment hands to whoever implements it. `todo/flow.md`'s
"explicit state `S`, not self-returning closures — the closure form is
derivable, not canonical" is the decision §1 now follows, and its reasons
(content-addressing, checkpointing, shipping to a remote engine) are exactly
§4.2's. And **composition is flow.md's, not this issue's**: transducers are
closed under composition, so chaining stages — `map(a)(b)`, fusing a tokenizer
into a parser — belongs to that operator family, where
[layered-parser](./layered-parser.md) already puts the `bytes → code-points →
tokens → AST` cascade. A transformer map is one layer's semantics; the layers
compose there.

One inconsistency worth settling while the family is in view, and not by this
issue alone: `Accumulator.update` is `(item, state)` and flow's `Transducer` is
`(state, item)`. §1 follows flow's order, `state` first.

### Tasks

Staged, and **`fjs/bnf/ll1` is stage 1** — not because it is the easier machine
(it is, marginally) but because it is the one that settles the design:

- It **never backtracks**, so no transformer ever runs on a branch it goes on to
  abandon. Stage 1 therefore ships the whole protocol without depending on the
  speculative-refusal rule (§6) being right: under `ll1` a refusal is final the
  moment it happens, so the rule can be *implemented* there and only *exercised*
  in stage 3.
- It is the backend that can promise **bounded-memory input streaming** (§4.2).
  Fold-level streaming alone is worth having, but the end state this issue is
  for — a JSON recognizer that is O(depth) over a stream — is LL(1)'s.
- Its **consumers are the ones waiting**: JSON's recognizer and value codec are
  LL(1)-shaped work, so stage 1 unblocks them without touching `fjs/djs`, whose
  port is the larger, riskier change and needs the inherited-attribute question
  (§10) answered first.
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
- [ ] Add `transformRuleSet` (§5) and check every map key against the `RuleSet`
      at construction, throwing rather than parsing.
- [ ] Re-express `parserRuleSet` as that machine with an empty map, and keep its
      current result type; the one place the machine's erasure is undone is
      where a value comes back out of it.
- [ ] Carry a refusal as a value (§6): it replaces the fold's state, suppresses
      the rest of its `update`s and its `end`, and propagates unchanged.
- [ ] Settle the truncated-match contract: running out of input mid-sequence
      finishes the enclosing folds early (`pos === null`), so their `end` sees a
      partial fold. Document it on `TransformMatchResult` — the value is
      meaningful only when the remainder is empty.
- [ ] Proofs: `descentEquivalence` and the existing AST expectations unchanged
      under the empty map; the per-rule-kind event order of §2 including the
      EOF terminal and an empty match; a refusal reported with `success: true`;
      the construction-time name check; and a deep-nesting case, since the fold
      now runs on the machine's explicit stack.

**Stage 2 — helpers and the first consumer.**

- [ ] Add the §9 helpers with the O(1)-`update` accumulation inside them.
- [ ] Give `fjs/media/json` a transformer set over its own grammar, and the
      all-`unit` map to
      [streaming-recognizer](../../media/json/todo/streaming-recognizer.md).
- [ ] Revisit `partial` (§4.3) once a real consumer wants results before the
      document ends; it needs [43](./043-stateful-parser.md) to be useful.

**Stage 3 — `fjs/bnf/descent`.**

- [ ] Thread transformer states through `fjs/bnf/descent`'s frames, keeping the
      untransformed path byte-identical.
- [ ] Prove the speculative cases stage 1 cannot reach: a transformer that runs
      on an abandoned branch, and a refusal inside one that the parse recovers
      from by taking another branch (§6).
- [ ] Port `fjs/djs/parser` onto transformers and delete `foldValue`,
      `descendantsTagged`, `slot`, `keyOf`, `_FoldFrame`; settle the inherited
      `refs` attribute (§10) there.
- [ ] Register any new module in `deno.json` per AGENTS.md; `npx tsc`, `fjs t`.

### Open questions

- **What a refusal carries.** `string` is the placeholder in §1. A structured
  error — the rule name the engine already knows, plus a position — would make
  a transformer's refusal as diagnosable as a syntactic failure. Decide with
  stage 1, since the engine is what would attach the rule name.
- **`(state, item)` or `(item, state)` (§12).** The two shipped folds disagree.
  §1 follows `todo/flow.md`; whoever unifies them may move it, and this issue
  should not settle a repository-wide argument on its own.
- **`partial` (§4.3).** Is exposing the start rule's state the right API, or
  should draining be a transformer-level concept? It is the only frame whose
  liveness is guaranteed, which argues for keeping it as narrow as written.
- **The inherited attribute (§10).** Closure-returning transformers, or a
  downward channel in the engine? Decide with the DJS port, not before.
- **Input streaming (§4.2) is [43](./043-stateful-parser.md)'s.** Whether that
  issue absorbs `partial` or this one does depends on which lands first.
- **Helper set (§9).** `map`, `tuple`, `list`, `text`, `unit`, `span` is a
  guess at the working set; let the JSON and DJS ports pick the final list.
- **Silent rules.** `unit` still delivers an `update` to the parent, which then
  ignores it. A "do not report this child at all" marker would make positional
  `tuple` transformers shorter (`[key, value]` instead of six slots). Sugar;
  defer until the JSON port says whether it is missed.

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
  the grammar the JSON transformer set attaches to.
- [streaming-recognizer](../../media/json/todo/streaming-recognizer.md) and
  [detect-json](../../media/type/todo/detect-json.md) — the all-`unit` map is
  the recognizer they specify.
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
