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

A transformer is a fold over one rule invocation's children:

```ts
type RuleTransformer<S, T> = {
    readonly create: (tag: AstTag) => S
    readonly update: (s: S) => (tag: AstTag) => (child: unknown) => S
    readonly end: (s: S) => Result<T, string>
}
```

- **`create`** starts a rule invocation, before its first symbol is consumed.
  It receives the tag this invocation was *entered under* — exactly the
  `AstTag` the AST would have stamped on its node, and `undefined` where the
  parent is not a variant. It takes no child, so a rule that matches empty is
  not a special case: it gets `create` then `end`, with no `update` in between.
- **`update`** folds in one child: a sequence item, a repetition round, a
  variant's chosen branch, or — for a terminal rule — the matched leaf. `tag`
  is the child's tag, which names the branch when this rule is a variant and is
  `undefined` otherwise. `child` is the child's *transformed* value: its own
  `end` result if it has a transformer, otherwise its AST node (§3).
- **`end`** finishes the invocation. It may fail: a transformer is where
  `1e999`, a duplicate `__proto__` key, or an unresolved `const` is caught, and
  [DESIGN.md §10](../../../DESIGN.md#10-refuse-what-you-cannot-handle) says
  those are refused rather than answered with a plausible value. The engine
  short-circuits the parse on an error and reports it with the rule name and
  the input position, so a transformer does not carry a position itself.

Transformers are supplied as a map keyed by **data**-`RuleSet` rule name:

```ts
type TransformerMap = StringMap<RuleTransformer<unknown, unknown>>
```

`S` is **existential** there: the engine never inspects a state and never hands
one to a transformer that did not produce it, but TypeScript has no way to say
so — `update: (s: number) => …` is not assignable to `update: (s: unknown) => …`
under `strictFunctionTypes`. Two spellings, and the choice is an open question
below: hide `S` behind a continuation the engine applies (a real existential, no
cast), or keep the map as written and confine one documented cast to the engine,
where the invariant that justifies it is enforced. `any` is not a candidate.

A rule with no entry is not transformed — it builds its AST node exactly as
today. That is what makes adoption incremental: a grammar with an empty map
behaves bit for bit as it does now.

Two invariants the engine owes the author, both checkable:

- **`update` is called once per child, in input order, and `end` once per
  successful invocation.** An invocation the parser abandons gets `create` and
  any `update`s it reached, and never `end`; children that already succeeded
  inside it did get their own `end`, and their values are dropped with the
  frame.
- **Every key resolves.** Names are checked against the `RuleSet` when the
  parser is built (§8), so a typo or a renamed rule fails at construction,
  before any input — never as a transformer that silently never fires.

#### 2. What the events are, per rule kind

| Data rule kind  | Events                                                       |
|-----------------|--------------------------------------------------------------|
| `TerminalRange` | `create(tag)`, `update(s)(undefined)(leaf)`, `end`            |
| `Sequence`      | `create(tag)`, one `update(s)(undefined)(child)` per item, `end` |
| `Repeat`        | `create(tag)`, one `update(s)(undefined)(item)` per round — none if it matched zero — `end` |
| `Variant`       | `create(tag)`, exactly one `update(s)(branchTag)(value)`, `end` |
| empty `Sequence`| `create(tag)`, `end`                                         |

The leaf is the backend's own: `CodePoint` under `fjs/bnf/ll1`,
`CodePointMeta<T>` under `fjs/bnf/descent`, which is where per-symbol metadata
enters a transformer (§7).

Rule identity is what the AST lacks and the event stream has: the map is keyed
by rule name, so a transformer always knows which rule it is folding — the
"key observation" the previous design had to work around by walking the grammar
and the AST in lockstep.

**Both tags are needed, and neither is redundant.** `create`'s tag is the
role *this* invocation plays in its parent; `update`'s tag is which branch a
variant took. A variant whose branches are distinct rules rarely needs the
latter — in the data form each branch is a distinct rule name, so distinct
branches already have distinct transformers — but branches that *share* a rule
(`option(x)`'s `none` is the shared empty sequence) are distinguishable only
by the tag. Neither costs an allocation: the engine holds both at the moment
it delivers them.

#### 3. The AST is the default transformer

The default is not a parallel code path; it is an instance of the protocol:

```ts
const astTransformer = {
    create: tag => ({ tag, items: null }),               // items: List, not Array
    update: s => () => child => ({ ...s, items: concat(s.items)([child]) }),
    end: s => ok({ tag: s.tag, sequence: toArray(s.items) }),
}
```

So "the AST is one contract" ([`../README.md`](../README.md#the-ast-is-one-contract))
survives by construction, and the `descentEquivalence` proof group in
`../ll1/proof.f.mjs` becomes the conformance test for the default map.

One rule kind stays special-cased, deliberately. A **variant** contributes no
node of its own today: both backends pass the branch tag *down* and let the
branch's node be the variant's, so no node is allocated for the variant itself
and `ll1` does not even need a frame — it retargets the current task at the
branch. That stays exactly as it is when the variant has no transformer. A
variant *with* a transformer gets a frame of its own (`descent` already has one
for trying branches; `ll1` gains one) — an addition to the AST model, not a
reimplementation of it — and pays for it only where it is used.

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
`init`/`append`/`end` over input chunks. It composes with this protocol
directly, because the parser state is a value: the frame stack, each frame's
transformer state, and the cursor. Nothing here is mutable, so the state can be
snapshotted, resumed, or forked — which is also what an incremental re-parse
would need later.

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

#### 5. Where it lives

In the shared matcher layer, not in a new pass over the AST and not twice.

Both backends are already the same machine: an explicit-stack loop whose frames
hold an `AstSequence` under construction, finished with `mrSuccess(tag, seq, pos)`
from [`../matcher/`](../matcher/). The change is to replace that
`AstSequence` with the invocation's transformer state and those constructor
calls with `create`/`update`/`end`. So:

- `RuleTransformer`, `TransformerMap` and the default transformer go in
  `fjs/bnf/matcher` (types in `types.ts`, the default in `module.f.mjs`);
- `descentParserRuleSet` and `parserRuleSet` take an optional map and thread
  states through their frames;
- no third walk exists to desync from the other two.

That is the answer to what the previous design called "parser-neutral
evaluation" (its `Semantics<R>` algebra). The algebra is right; it belongs in
the layer the backends already share, and it should be a fold over children
rather than a `reduce` over a materialized child array — see §11.2.

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

Failure is `end`-only, on purpose. Anything a child could reject can be recorded
in the state and reported when the rule finishes, so `update` stays a plain
`S => tag => child => S` and there is one place to look for a rejection. The
cost is that an error's *position* is the enclosing rule's, not the offending
child's, unless the transformer kept the child's metadata (§7) — which the
transformers that care already do.

A transformer error aborts the parse; it does not make the branch fail and let
the parser try another. A semantic rejection is not a syntactic one, and making
it one would make `ll1` and `descent` disagree about which inputs parse.

#### 7. Metadata

There is no separate metadata channel, and none is needed. Under
`fjs/bnf/descent` a leaf *is* `readonly[CodePoint, T]`, so metadata arrives at
the terminal rule's `update` already attached, and each transformer keeps
whatever it needs — a span, a lexeme, nothing. A parent sees a child's metadata
only if the child's `end` includes it, the same forwarding rule as everything
else in a fold.

This replaces the previous design's mandatory `(leaf, merge, empty)` monoid
merged into every node. That monoid existed to guarantee error positions and to
carry lexemes across parser layers; the first is now the engine's job (§1,
§6) and the second is one transformer returning a pair. An automatic span
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
type Transformers = { readonly[K in keyof Values]?: RuleTransformer<unknown, Values[K]> }
```

`end`'s result type is checked per rule; the state parameter carries the §1
existential wrinkle here too, and whichever spelling §1 settles on applies to
this mapped type unchanged.

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
  `reduce`-over-children shape of the previous design, recovered as sugar.
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

### Tasks

- [ ] Add `RuleTransformer` / `TransformerMap` to `fjs/bnf/matcher/types.ts`,
      and the default AST transformer to `fjs/bnf/matcher/module.f.mjs`.
- [ ] Thread transformer states through `fjs/bnf/descent` frames in place of
      `AstSequence`, keeping the untransformed path byte-identical.
- [ ] Same for `fjs/bnf/ll1`, adding a variant frame only when a variant has a
      transformer.
- [ ] Resolve every map key against the `RuleSet` when the parser is built;
      fail at construction.
- [ ] Short-circuit the parse on an `end` error, reporting rule name and
      position.
- [ ] Add the §9 helpers with the O(1)-`update` accumulation inside them.
- [ ] Prove the default map reproduces today's AST — reuse
      `descentEquivalence` in `../ll1/proof.f.mjs` — plus per-rule-kind event
      order, the abandoned-branch case (`create` without `end`), an empty match,
      and a deep-nesting case that would overflow a recursive fold.
- [ ] Port `fjs/djs/parser` onto transformers and delete `foldValue`,
      `descendantsTagged`, `slot`, `keyOf`, `_FoldFrame`; settle the inherited
      `refs` attribute (§10) there.
- [ ] Give `fjs/media/json` a transformer set over its own grammar, and the
      all-`unit` map to
      [streaming-recognizer](../../media/json/todo/streaming-recognizer.md).
- [ ] Register any new module in `deno.json` per AGENTS.md; `npx tsc`, `fjs t`.

### Open questions

- **How `TransformerMap` hides `S` (§1).** A continuation-encoded existential
  (no cast, heavier to write) or one documented cast inside the engine. This is
  the only place the design needs an answer before code is written.
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
