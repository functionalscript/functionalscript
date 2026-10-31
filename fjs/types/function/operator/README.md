# Incremental machines

`Transducer<I, S, O, A>` is the common lifecycle for folds, hashes, builders, and
streaming codecs. It separates input `I`, state `S`, emitted items `O`, and the
final summary `A`:

```ts
type Transducer<I, S, O, A> = {
    readonly init: Step<S, O, A>
    readonly update: (state: S, input: I) => Step<S, O, A>
    readonly end: (state: S) => Terminal<O, A>
}
```

The definitions live in [`types.ts`](./types.ts). `nextStep(state, output)`
continues, and `doneStep(summary, output)` completes; omitted output is `[]`.
A driver emits the initial chunk before pulling input, calls `end` at EOF to
flush any buffered output, and stops pulling immediately on `done`. It does not
call `end` after a machine has already completed. An empty input item or emitted
chunk is ordinary data, distinct from EOF.

Value-only machines use `O = never`; their answer is the terminal summary. An
emitting machine can use `A = null` when it needs no summary. Domain failures
are ordinary summary values, such as `Result<T, E>` or `null`; there is no
separate error variant in the protocol. A source or sink effect can still fail
through its own effect error channel.

## Drivers

[`types/list`](../../list/module.f.mjs) supplies:

- `run(machine)(input)` — returns the final summary without retaining output.
- `transduce(machine)(input)` — lazily yields nonempty `['next', output]`
  chunks followed by exactly one `['done', flush, summary]` event. State stays
  inside the driver. Output alone is
  `flat(map(event => event[1])(transduce(machine)(input)))`; consume the events
  once when both output and summary are needed.

[`effects/list`](../../../effects/list/module.f.mjs) supplies:

- `run(machine)(input)` — returns an effect producing the summary.
- `transduce(machine)(emit)(input)` — sends each nonempty output chunk to the
  effectful `emit` callback, then returns the summary. It delivers the EOF flush
  before returning, propagates source and sink failures, and does not build an
  intermediate output list. Real commands remain suspended for the runner;
  pure spans are processed with a stack-safe loop.

The protocol is independent of dataflow graphs and their engines. It requires
no associativity law: only particular machines, such as monoid accumulation,
permit regrouping. A saved continuing state can be supplied to the same
machine's `update` or `end` to resume processing.

## Simple forms and domain APIs

`fromStateFold` adapts `{ init: S, update: (state, input) => S, end: S => A }`
to a non-emitting machine. `fromStateScan(init, op, end)` adapts an array-emitting
`StateScan` and an EOF flush to a machine with a `null` summary. The list module's
`fromAccumulator` adapts its fallible convenience form, and `tryFold` runs that
adapter through the same driver.

Domain adoption is tracked in the [migration TODO](./todo/shared-state-machine-interface.md).
The remaining stack migrates one machine family at a time, including its callers
and proofs. Constructors bind configuration before exposing the lifecycle;
hash metadata and domain operations such as height observation and bounded
feeding can remain alongside it.

A settled internal state need not mean completion. MIME detection still counts
all input after its verdict is known; zlib inflation still counts trailing bytes
after the compressed stream closes. Their migrated machines must return `next` until EOF.
Bounded drivers must retain the caller's unconsumed chunk suffix when stopping
inside an item; the protocol does not invent a remainder field.
