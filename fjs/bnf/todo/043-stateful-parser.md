## 43. Stateful parser

**Priority:** P3
**Status:** open

### Problem

A parser takes its whole input as one array — [`Match<M>`](../ll1/types.ts) is
`(name, s: readonly Meta<M, CodePoint>[]) => MatchResult<M>` — so a caller
materializes every symbol before parsing starts. That rules out parsing a
stream, checkpointing a partial parse, and composing a parser with the decoders
and tokenizers that produce its input ([layered-parser](./layered-parser.md),
where every layer is a streaming fold).

The machine is not what blocks it.
[207 §4](./207-bnf-semantic-actions.md) already establishes that the parser
state is a value — the frame stack, each frame's `(rule name, state)`, and the
cursor — and that the engine's half holds no closures. The LL(1) matcher is an
explicit-stack loop over exactly that triple
([`../ll1/module.f.mjs`](../ll1/module.f.mjs)), reading the input by cursor
rather than recursing. The array is the only thing standing between it and a
fold.

### Proposal

Expose the parser as a machine over one input symbol at a time — a
[`StateFold`](../../types/function/operator/types.ts), the shape the repository
already folds with:

```ts
StateFold<Meta<MI, Symbol>, S, Meta<MO, T>>
// init: S
// update: (state: S, symbol: Meta<MI, Symbol>) => S
// end: (state: S) => Meta<MO, T>
```

`Symbol` here is the input alphabet, not `CodePoint`: end-of-input is one of its
members and sits outside the documented `0x0000 to 0x10_FFFF`
([eof-as-ordinary-symbol](./eof-as-ordinary-symbol.md)), and a layered parse
feeds token symbols through the same machinery anyway.

This issue's original sketch took a whole string in `append`. One symbol is the
smaller contract, and a string-at-a-time convenience is derivable from it, not
the other way round. The record itself is what `fjs/crypto/sha2` already exposes
as `init`/`append`/`end`, and what `RepeatTransformer` already is.

**`StateFold`, not [`todo/flow.md`](../../../todo/flow.md)'s `Transducer`.** The
`Transducer` is design-stage — it appears in no module under `fjs/`, while
`StateFold` and `StateScan` have a dozen users. Its extra power is a `done`
step, letting a stage refuse further input inside the operator rather than
through a state the driver interrogates. That is worth having eventually, and it
is not worth inventing a second fold shape ahead of the graph engine that would
consume it. If `Transducer` ships, this parser becomes one; until then it is the
same shape as everything else.

**This is the value-producing top layer, and only that.** A `StateFold` emits
nothing until `end`, which is right for a stage answering with one AST and wrong
for one whose output is a stream. [layered-parser](./layered-parser.md)'s lower
stages emit as they go; nothing here is a decoder or tokenizer.

That leaves layered-parser two things to settle, neither this issue's: it says
every layer reuses the same BNF engine, and a grammar used as an emitting layer
has no shape here — and `StateScan`, which it names, is
`(input, prior) => [output, state]` with no lifecycle, so a stage cannot flush
what it buffered at end of input. `decoder` in
[`../../text/code_point/module.f.mjs`](../../text/code_point/module.f.mjs)
already works around that with a second `eofOp`. An emitting layer wants
emission *and* an emitting `end`, which is `Transducer`'s and not `StateScan`'s.

**Metadata is the outermost wrapper.** `Meta<…>` outside rather than a result
type outside, because metadata is orthogonal to whether the parse succeeded — it
is where the position of a failure lives, and a shape that drops it on the
failure path forces the failure to re-carry a position that the metadata already
is. It also mirrors the input.

**Input and output metadata are different types.** A layer *transforms*
metadata, so `MI` and `MO` are two parameters, which `StateFold`'s independent
`I` and `O` already give. The motivating case is a tokenizer: it reads a number
and emits the token symbol `n` for the next layer, carrying the numeric value in
its output metadata. With one `M` that value either rides along uselessly
through every later rule, or has to be recovered in a postprocessing pass — both
of which describe the pipeline worse than two types do.

**EOF is an ordinary symbol in an extended input range**, sent by the caller as
the last one, and the parser does not treat it specially. That is a change to
[the contract](../README.md#logical-eof-in-parser-input), which has the backend
synthesize EOF after the physical input — knowable for an array, not for a
stream, where the caller telling the parser input ended *is* the last symbol.

It removes rather than adds: EOF's metadata arrives with the symbol like any
other, so nothing has to supply it; `Cursor`'s extended position and its
`(idx, eofConsumed)` pair exist only to give a synthesized symbol a position it
does not have, and a real symbol advances `idx` normally; `physicalIdx` converts
that back and goes with it; and the trap `Cursor` documents — a backend treating
EOF as no progress "would loop forever on a repetition over a rule that can match
EOF" — cannot be fallen into. A grammar that never mentions `eof` leaves it
unconsumed, which `end` treats as success, matching what the synthesized symbol
does today.

The contract and both backends are [eof-as-ordinary-symbol](./eof-as-ordinary-symbol.md)'s.

**The metadata algebra is two operations, given at construction.** One monoid
needs one type, so with two it becomes:

```ts
readonly translate: (mi: MI) => MO      // an unmapped terminal's metadata
readonly reduce: Reduce<MO>             // two siblings, combined
```

The **terminal is the boundary**: a terminal transformer takes
`Meta<MI, Symbol>` and returns `Out<MO, T>`, and `translate` supplies the
metadata only where a terminal has no transformer — parallel to
[207 §3](./207-bnf-semantic-actions.md)'s default builders supplying the value
for an unmapped rule. Translating on entry instead would put it in front of the
transformer, which would then see `MO` alone and could not read the token
payload the split exists to keep out of `MO`. Everything above a terminal is
`MO`, so `reduce` never sees `MI`.

**`reduce` need not be associative**, so the fold is strictly left to right and
the **grouping is part of the contract**: `reduce(reduce(a, b), c)`. That rules
out `fold` and `foldAbsorbing` in
[`fjs/common/monoid`](../../common/monoid/module.f.mjs), which combine as a
*balanced* tree — "associativity is what licenses the re-grouping" — and would
regroup silently, producing plausible metadata rather than an error.

**`T`, not `Ts<O>`.** The parser's output type is not RTTI-described; a
validatable root output belongs to `checkMap` and the `fjs/bnf/map` layer alone,
which [207 §10](./207-bnf-semantic-actions.md) keeps separate from the parser's
own transformer map. The parser stays RTTI-free.

**The machine has no error concept, and that is deliberate.** It is the same
decision as [`todo/flow.md`](../../../todo/flow.md)'s — *"the core is total;
every stage always completes"*, with an `['error', E]` variant considered and
dropped — and as [207 §6](./207-bnf-semantic-actions.md)'s, where a recoverable
semantic failure is an ordinary `T = Result<V, E>` the engine never inspects.

The reason is worth stating once, because it is not "parsers cannot fail". A
`Result` is the right return for an [effect](../../effects/types.ts): an
operation is dispatched to a runner that may decline it, so a signature
admitting no error would be a hole in that mechanism. A pure fold dispatches to
nobody. There is no second party to refuse, so a built-in error channel would
describe nothing, and every stage composed downstream would pay for it — which
is the concrete cost: a fold carrying a `Result` does not chain with another
fold without unwrapping and re-wrapping at every stage.

What replaces it:

- `T` means whatever the grammar's author declares. A grammar that must report
  "not in this language" says so in `T`, and a built-in `Result<_, string>`
  would have imposed one spelling of that on every grammar. (`T` is not
  RTTI-described here — that is `checkMap`'s layer, above.)
- `S` may hold an error state and keep accepting symbols without leaving it, so
  `update` stays total.
- A driver feeding symbols may inspect the state and stop early. Inspection is
  an **optimization, not an obligation**: `end` is total either way, so a driver
  that never looks still gets the right answer, and early exit matters only for
  unbounded or expensive input.

**Refusal belongs to the driver, not the machine.**
[DESIGN.md §10](../../../DESIGN.md) names a malformed document as a *reject*
case — a `try*` returning `Nullable<T>`. §10 governs operations at a boundary,
and a fold is not one; the boundary is the function a caller invokes ("parse
this document"). Both hold at once because they are different layers.

The obligation §10 does place here: `T` must be able to say the input was not in
the language, and the state must be observable enough at `end` to say it.
Otherwise `end` maps a failed parse to a well-typed, structurally fine value —
§10's one unacceptable outcome, *"plausible and wrong … it passes every test
that only checks for the absence of a failure"*. That is a requirement on
whoever declares `T`, not a channel the parser supplies — and **who hands the
engine that value is not yet decided**; see the open questions.

### Tasks

- [ ] Answer the open questions below. Everything else here is mechanical;
      those are not.
- [ ] Replace the cursor-into-array reads in
      [`../ll1/module.f.mjs`](../ll1/module.f.mjs) with a state that suspends
      when it needs the next symbol. `symbolAtCp`, `leafAt` and the
      `pos <= cp.length` comparisons are the sites.
- [ ] Replace the "ran out of input" test. The machine tells that from
      "rejected" by comparing against a known `cp.length`, which a streaming
      parser does not have. It no longer needs one: the caller's EOF symbol says
      the input ended ([eof-as-ordinary-symbol](./eof-as-ordinary-symbol.md)),
      so `end` finalizes rather than synthesizing anything, and a parse still
      waiting for symbols when `end` arrives is the case to define.
- [ ] Decide what happens to `Remainder<M>`. A fold that reports only at `end`
      cannot return the unconsumed tail, so prefix parsing — which `Match` has
      today — either goes away deliberately or needs a different reporting
      point.
- [ ] Migrate the shipped single-`M` API rather than leaving two: `transformers`
      in [`../ll1/module.f.mjs`](../ll1/module.f.mjs) takes a `Monoid<M>` today,
      and [207](./207-bnf-semantic-actions.md)'s §1, §5 and §8 signatures
      describe it. They are correct until this lands and wrong the moment it
      does, so they change with the code — this is a breaking change to stage
      1's public types.
- [ ] Prove: one-symbol-at-a-time equals the array path on the same input; a
      parse suspended and resumed equals an uninterrupted one; an error state
      absorbs; `end` on a zero-symbol input.
- [ ] Prove the fold's **grouping**, with a deliberately non-associative
      `reduce` — string concatenation would pass under either grouping and
      proves nothing. This is the proof that catches a `fjs/common/monoid`
      `fold` creeping back in.

### Open questions

Undecided, deliberately. Each is visible in the public type, so none is an
implementer's to settle quietly ([REVIEW.md](../../../REVIEW.md#designs)); each
is small enough to answer in a pull request that implements nothing.

- **Nothing constructs the value for a rejected parse.** `T` is unconstrained
  and [207 §6](./207-bnf-semantic-actions.md) says no transformer on a rejected
  spine runs — including the root's — so an error state in `S` records *that*
  the parse failed and still leaves `end` with nothing to return. Candidates:
  the root entry supplies a rejection value, the root transformer is required to
  be a fold whose `end` is total by construction, or `end` returns
  `Nullable<T>`.
- **`reduce` has no identity**, and [207 §2](./207-bnf-semantic-actions.md)
  spends one on an empty `Sequence` and a zero-round `Repeat`. (It spent a third
  on an EOF terminal until
  [eof-as-ordinary-symbol](./eof-as-ordinary-symbol.md) gave that symbol the
  caller's metadata — the one case of the three that only looked childless.)
  Candidates: a third field `empty: MO`, or `MO | undefined` with `reduce`
  skipping absence. Not `Monoid<MO>` — its identity comes with an associativity
  law this `reduce` does not promise. One constant also cannot say *where* an
  empty match matched, which the second candidate can.
- **How far `MI ≠ MO` reaches.** Re-splitting at the parser does not by itself
  un-ship PR #1828's single-`M` map and RTTI types: a callback may stay `M → M`
  inside one layer while the layer is `MI → MO`. One answer is a code change to
  merged types, so say which.

### Related

- [207. BNF rule transformers](./207-bnf-semantic-actions.md) — the transformer
  protocol this parser applies; §4 defers input-level streaming to this issue.
- [generic parser metadata](./generic-parser-metadata.md) — where the metadata
  monoid applies per rule kind, and the single-`M` decision.
- [layered parser](./layered-parser.md) — the pipeline that needs every layer to
  be a streaming fold.
- [`todo/flow.md`](../../../todo/flow.md) — the total-core decision, and the
  `Transducer` this operator is or is not.
- [`fjs/effects/types.ts`](../../effects/types.ts) — why an effect's `Result` is
  a rule there and not here: a runner may decline a command.
- [DESIGN.md §10](../../../DESIGN.md) — refuse what you cannot handle; the
  driver is where that lands.
