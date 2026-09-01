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
StateFold<Meta<MI, CodePoint>, S, Meta<MO, T>>
// init: S
// update: (state: S, symbol: Meta<MI, CodePoint>) => S
// end: (state: S) => Meta<MO, T>
```

This issue's original sketch took a whole string in `append`. One symbol is the
smaller contract and the one a layered pipeline needs; a string-at-a-time
convenience is derivable from it, not the other way round. The record itself is
what `fjs/crypto/sha2` already exposes as `init`/`append`/`end`, and what
`RepeatTransformer` already is.

**`StateFold`, not [`todo/flow.md`](../../../todo/flow.md)'s `Transducer`.** The
`Transducer` is design-stage — it appears in no module under `fjs/`, while
`StateFold` and `StateScan` have a dozen users. Its extra power is a `done`
step, letting a stage refuse further input inside the operator rather than
through a state the driver interrogates. That is worth having eventually, and it
is not worth inventing a second fold shape ahead of the graph engine that would
consume it. If `Transducer` ships, this parser becomes one; until then it is the
same shape as everything else.

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

- `O` means whatever the grammar's author declares. A grammar that must report
  "not in this language" says so in `O`, where — being RTTI-described — it is
  validated like every other branch. A built-in `Result<_, string>` never was.
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

The obligation §10 does place here: `O` must be able to say the input was not in
the language, and the state must be observable enough at `end` to say it.
Otherwise `end` maps a failed parse to a well-typed, RTTI-valid, structurally
fine value — §10's one unacceptable outcome, *"plausible and wrong … it passes
every test that only checks for the absence of a failure"*. That is a
requirement on whoever declares `O`, not a channel the parser supplies.

### Tasks

- [ ] Settle what a match with no children produces, now that `translate` and
      `reduce` replace the monoid (see the open question). Everything else here
      is mechanical; this is not.
- [ ] Replace the cursor-into-array reads in
      [`../ll1/module.f.mjs`](../ll1/module.f.mjs) with a state that suspends
      when it needs the next symbol. `symbolAtCp`, `leafAt` and the
      `pos <= cp.length` comparisons are the sites.
- [ ] Move end-of-input into `end`. The machine currently tells "ran out of
      input" from "rejected" by comparing against a known `cp.length`; a
      streaming parser learns the length only at `end`, which must feed the
      synthesized EOF symbol and finalize
      ([the contract](../README.md#logical-eof-in-parser-input)).
- [ ] Decide what happens to `Remainder<M>`. A fold that reports only at `end`
      cannot return the unconsumed tail, so prefix parsing — which `Match` has
      today — either goes away deliberately or needs a different reporting
      point.
- [ ] Prove: one-symbol-at-a-time equals the array path on the same input; a
      parse suspended and resumed equals an uninterrupted one; an error state
      absorbs; `end` on a zero-symbol input.
- [ ] Prove the fold's **grouping**, with a deliberately non-associative
      `reduce` — string concatenation would pass under either grouping and
      proves nothing. This is the proof that catches a `fjs/common/monoid`
      `fold` creeping back in.

### Open questions

- **What supplies the metadata of a match with no children?** Two metadata types
  replace the single `Monoid<M>` with two operations, given to the parser at
  construction beside the map:

  ```ts
  readonly translate: (mi: MI) => MO      // a terminal's metadata, lifted
  readonly reduce: Reduce<MO>             // two siblings, combined
  ```

  A terminal's `MI` is translated on entry, everything above it is `MO`, and
  `reduce` never sees `MI`. `Reduce<MO>` is
  [`fjs/types/function/operator`](../../types/function/operator/types.ts)'s
  already. That settles what
  [generic-parser-metadata](./generic-parser-metadata.md)'s rule-by-rule
  derivation folds with.

  What it does not settle: `reduce` is a semigroup, and a `Monoid` also carried
  an **identity**, which [207 §2](./207-bnf-semantic-actions.md) spends in three
  places that have no child metadata to combine — an empty `Sequence`, a
  zero-round `Repeat`, and a terminal matching EOF, where no leaf exists. Two
  operations leave those three with nothing to produce. Either:

  - add the identity back, so the pair is `translate` plus a `Monoid<MO>` — two
    operations and one constant, the smallest change; or
  - represent absence, `MO | undefined`, and let `reduce` skip it. This is the
    honest answer to a complaint the constant identity has anyway: a single
    identity value gives every empty match the same metadata regardless of where
    it matched, so a position-carrying `MO` cannot say *where* the empty match
    was. The cost is that every transformer's metadata admits `undefined`.

  **`reduce` is not required to be associative.** It folds strictly left to
  right in grammar order, so no law is needed and none is claimed —
  `Reduce<MO>` carries none either, the laws in `fjs/common/monoid` belonging to
  `Monoid` rather than to the operation type.

  That makes the **grouping part of the contract** rather than an implementation
  detail: `reduce(reduce(a, b), c)`, never `reduce(a, reduce(b, c))`, and the
  engine has to say so where it folds. It also rules out one specific reuse.
  `fold` and `foldAbsorbing` in
  [`fjs/common/monoid`](../../common/monoid/module.f.mjs) combine a list as a
  *balanced* binary tree — "associativity is what licenses the re-grouping" —
  so calling them here would regroup a fold that must not be regrouped, and
  would do it silently, producing plausible metadata rather than an error. The
  parser needs its own left fold.
- **How far does `MI ≠ MO` reach?** The decision above is about the parser
  boundary. [generic-parser-metadata](./generic-parser-metadata.md) states the
  stronger rule that *both* mapping APIs use one `M`, and PR #1828 shipped it by
  removing `MI`/`MO` from the map and RTTI types. Re-splitting at the parser
  does not by itself un-ship that: a mapping's callback may still be `M → M`
  within one layer while the layer as a whole is `MI → MO`. Say which, since one
  answer is a code change to already-merged types.

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
