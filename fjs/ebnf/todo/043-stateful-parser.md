## 43. Stateful parser

**Priority:** P3
**Status:** open

### Problem

A parser takes its whole input as one array — [`Parser<T, I>`](../ll1/types.ts)
is `(symbols: readonly Meta<I>[], start?) => MatchResult<T>` — so a caller
materializes every symbol before parsing starts. That rules out parsing a
stream, checkpointing a partial parse, and composing a parser with the decoders
and tokenizers that produce its input ([layered-parser](./layered-parser.md),
where every layer is a streaming fold). The token layer works around it with
the `start` index: `fjs/djs/tokenizer` holds the whole input and resumes the
one-token parser where the last token ended, which is a loop over an array,
not a fold over a stream.

The machine is not what blocks it. The LL(1) matcher in
[`../ll1/module.f.mjs`](../ll1/module.f.mjs) is an explicit-stack loop over
one state — the frames suspended and what to do next — reading the input by
cursor rather than recursing, and a frame holds only rule names, collected
children and a repetition's rounds. The array is the only thing standing
between it and a fold.

### Proposal

Expose the parser as a machine over one input symbol at a time — a
[`StateFold`](../../types/function/operator/types.ts), the shape the repository
already folds with:

```ts
StateFold<Meta<I>, S, MatchResult<T>>
// init: S
// update: (state: S, symbol: Meta<I>) => S
// end: (state: S) => MatchResult<T>
```

One symbol is the smaller contract, and a string-at-a-time convenience is
derivable from it, not the other way round. The record itself is what
`fjs/crypto/sha2` already exposes as `init`/`append`/`end`.

**`StateFold`, not [`todo/flow.md`](../../../todo/flow.md)'s `Transducer`.** The
`Transducer` is design-stage — it appears in no module under `fjs/`, while
`StateFold` and `StateScan` have a dozen users. Its extra power is a `done`
step, letting a stage refuse further input inside the operator rather than
through a state the driver interrogates. That is worth having eventually, and it
is not worth inventing a second fold shape ahead of the graph engine that would
consume it. If `Transducer` ships, this parser becomes one; until then it is the
same shape as everything else.

**This is the value-producing top layer, and only that.** A `StateFold` emits
nothing until `end`, which is right for a stage answering with one value and
wrong for one whose output is a stream. [layered-parser](./layered-parser.md)'s
lower stages emit as they go; nothing here is a decoder or tokenizer. An
emitting layer wants emission *and* an emitting `end`, which is `Transducer`'s
and not `StateScan`'s; `decoder` in
[`../../text/code_point/module.f.mjs`](../../text/code_point/module.f.mjs)
already works around that with a second `eofOp`.

**Metadata stays where the rewrite set puts it.** A mapping returns a
`Meta<O>`, the value in the metadata ([`../ast`](../ast/README.md)), so a
failure's position and a token's payload are both metadata already; a
streaming machine changes how symbols arrive, not what a mapping receives or
returns. The metadata algebra an earlier draft of this issue designed for
the classical backend — two types `MI`/`MO`, a `translate` and a
non-associative `reduce` supplied at construction — is superseded by the
rewrite set, whose mappings are the only place metadata is combined
([`../ll1`](../ll1/README.md)); a repetition mapped as a fold over its
rounds ([repeat-fold-mapping](../ll1/todo/repeat-fold-mapping.md)) is this
issue's output-side counterpart.

**EOF is an ordinary symbol in an extended input range**, sent by the caller as
the last one, and the parser does not treat it specially. That is a change to
[the contract](../README.md#logical-eof-in-parser-input), which has the backend
synthesize EOF after the physical input — knowable for an array, not for a
stream, where the caller telling the parser input ended *is* the last symbol.
The contract and the backend are
[eof-as-ordinary-symbol](../terminal/todo/eof-as-ordinary-symbol.md)'s.

**The machine has no error concept, and that is deliberate.** It is the same
decision as [`todo/flow.md`](../../../todo/flow.md)'s — *"the core is total;
every stage always completes"*, with an `['error', E]` variant considered and
dropped — and as the rewrite set's, where a mapping reports no errors and
what can fail belongs to the layer above.

The reason is worth stating once, because it is not "parsers cannot fail". A
`Result` is the right return for an [effect](../../effects/types.ts): an
operation is dispatched to a runner that may decline it, so a signature
admitting no error would be a hole in that mechanism. A pure fold dispatches to
nobody. There is no second party to refuse, so a built-in error channel would
describe nothing, and every stage composed downstream would pay for it — which
is the concrete cost: a fold carrying a `Result` does not chain with another
fold without unwrapping and re-wrapping at every stage.

What replaces it:

- `S` may hold the refusal — the index the match failed at, as `MatchResult`
  reports it today — and keep accepting symbols without leaving it, so
  `update` stays total.
- A driver feeding symbols may inspect the state and stop early. Inspection is
  an **optimization, not an obligation**: `end` is total either way, so a driver
  that never looks still gets the right answer, and early exit matters only for
  unbounded or expensive input.

**Refusal belongs to the driver, not the machine.**
[DESIGN.md §10](../../../doc/DESIGN.md) names a malformed document as a *reject*
case — a `try*` returning `Nullable<T>`. §10 governs operations at a boundary,
and a fold is not one; the boundary is the function a caller invokes ("parse
this document"). Both hold at once because they are different layers.

### Tasks

- [ ] Answer the open questions below. Everything else here is mechanical;
      those are not.
- [ ] Replace the cursor-into-array reads in
      [`../ll1/module.f.mjs`](../ll1/module.f.mjs) with a state that suspends
      when it needs the next symbol. `symbolAt`, `accepts`, `leafAt` and the
      `pos <= length` comparisons are the sites.
- [ ] Replace the "ran out of input" test. The machine tells that from
      "rejected" by comparing against a known length, which a streaming
      parser does not have. It no longer needs one: the caller's EOF symbol
      says the input ended ([eof-as-ordinary-symbol](../terminal/todo/eof-as-ordinary-symbol.md)),
      so `end` finalizes rather than synthesizing anything, and a parse still
      waiting for symbols when `end` arrives is the case to define.
- [ ] Decide what happens to the end index `MatchResult` reports. A fold that
      reports only at `end` cannot return the unconsumed tail, so prefix
      parsing — which the token layer rests on today, resuming at the index
      the last match reported — either goes away deliberately or needs a
      different reporting point.
- [ ] Prove: one-symbol-at-a-time equals the array path on the same input; a
      parse suspended and resumed equals an uninterrupted one; a refused state
      absorbs; `end` on a zero-symbol input.

### Open questions

Undecided, deliberately. Each is visible in the public type, so none is an
implementer's to settle quietly ([REVIEW.md](../../../doc/REVIEW.md#designs)); each
is small enough to answer in a pull request that implements nothing.

- **What `end` returns for a rejected parse.** `MatchResult` already has an
  error row, the index the match failed at; whether a streaming parse can
  name an index, and what it names when the input ended first, is the
  question.
- **How the token layer resumes.** Today a match reports where it ended and
  the next match starts there. A fold over one stream has no "there": either
  the tokenizer becomes one machine over the whole input — a repetition of
  the token grammar, which is not LL(1) — or the layer stays an array loop
  and only the parser above it streams.

### Related

- [layered parser](./layered-parser.md) — the pipeline that needs every layer to
  be a streaming fold.
- [eof-as-ordinary-symbol](../terminal/todo/eof-as-ordinary-symbol.md) — the
  contract change this needs, and its own open question.
- [repeat-fold-mapping](../ll1/todo/repeat-fold-mapping.md) — the output side:
  a repetition's mapping as a fold over its rounds.
- [`todo/flow.md`](../../../todo/flow.md) — the total-core decision, and the
  `Transducer` this operator is or is not.
- [`fjs/effects/types.ts`](../../effects/types.ts) — why an effect's `Result` is
  a rule there and not here: a runner may decline a command.
- [DESIGN.md §10](../../../doc/DESIGN.md) — refuse what you cannot handle; the
  driver is where that lands.
