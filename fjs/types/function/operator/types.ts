/**
 * Common higher-order operator type aliases.
 *
 * @module
 */

export type Binary<A, B, R> = (a: A) => (b: B) => R

export type Fold<I, O> = Binary<I, O, O>

export type Reduce<T> = Fold<T, T>

/** A continuing machine step: emitted items and the state for the next input. */
export type NextStep<S, O = never> = readonly ['next', readonly O[], S]

/** A completed machine: its final emitted items and its summary. */
export type Terminal<O, A> = readonly ['done', readonly O[], A]

/** A machine either continues with state or completes with a result. */
export type Step<S, O, A> = NextStep<S, O> | Terminal<O, A>

/**
 * A pure incremental machine, independent of its input source and driver.
 *
 * A driver processes `init` before pulling input. Each continuing step supplies
 * state for `update(state, input)`. At physical EOF the driver calls `end`,
 * which always completes and may flush output. A `done` step stops input pulls
 * immediately; it does not receive another update or a second call to `end`.
 * Empty output chunks are ordinary steps, not EOF. State, output, and summary
 * may each contain `null` without confusing completion with a data value.
 *
 * Value-producing folds use `O = never`; codecs emit as they go and can use
 * `A = null`. A domain failure is a value of `A`, not a separate error channel.
 * This lifecycle imposes no associativity or finite-state restriction.
 */
export type Transducer<I, S, O, A> = {
    readonly init: Step<S, O, NoInfer<A>>
    readonly update: (state: S, input: I) => Step<S, O, NoInfer<A>>
    readonly end: (state: S) => Terminal<O, A>
}

/**
 * A driver's output: nonempty emitted chunks, followed by exactly one terminal
 * step. State is kept by the driver and is not retained in the output stream.
 */
export type Transduced<O, A> = readonly ['next', readonly O[]] | Terminal<O, A>

/**
 * The simple, non-emitting form of a machine, adapted by `fromStateFold`.
 *
 * Generic operator functors that expose their state use the `State` prefix;
 * compare {@link StateScan}. `init` creates the state, `update` consumes one
 * input, and `end` turns the final state into the result. Source drivers consume
 * the canonical {@link Transducer}; this form is a construction convenience.
 */
export type StateFold<I, S, O> = {
    readonly init: S
    readonly update: (state: S, input: I) => S
    readonly end: (state: S) => O
}

export type Unary<T, R> = (value: T) => R

export type Equal<T> = Binary<T, T, boolean>

export type Addition =
    Binary<string, string, string> &
    Binary<bigint, bigint, bigint> &
    Binary<number, number, number>

export type Scan<I, O> = (input: I) => readonly [O, Scan<I, O>]

/**
 * One step of a stream transducer: given an `input` symbol and the `prior`
 * state, produce an `output` and the next state. It both maps an input stream
 * to an output stream and threads state, so it models tokenizers, decoders, and
 * other stream-to-stream stages.
 *
 * This is the *shape* of a [Mealy machine](https://en.wikipedia.org/wiki/Mealy_machine)
 * — a [finite-state transducer](https://en.wikipedia.org/wiki/Finite-state_transducer)
 * — but only its signature. The state `S` (and `I`, `O`) is an arbitrary type,
 * not a finite set, so a `StateScan` is strictly more expressive than a Mealy
 * machine — its power is the power of `S`:
 * - a finite `S`/`I`/`O` recovers the classical finite-state machine (e.g. the
 *   DFA states in `../../../fsm/module.f.mjs`);
 * - an `S` that is a stack makes it a
 *   [pushdown / stack machine](https://en.wikipedia.org/wiki/Pushdown_automaton)
 *   (context-free power — balanced brackets, nested structure, the AST tier);
 * - an unbounded `S` like `bigint` can count, which no finite automaton can.
 *
 * And `O` may be a list (0+ symbols per input), not the single symbol strict
 * Mealy emits. (Functional/coalgebraic usage still calls this `(input, state)
 * => [output, state]` shape a "Mealy machine", finiteness aside.)
 *
 * A {@link Fold} is the output-less special case (state only); driving a
 * `StateScan` over a `List` is `stateScan` in `../../list/module.f.js`, and
 * {@link ./module.f.js | `stateScanToScan`} hides the state to recover a
 * {@link Scan}.
 */
export type StateScan<I, S, O> = (input: I, prior: S) => readonly [O, S]

/**
 * The steps of a `cascade` in `./module.f.js`: one {@link StateScan} per
 * position of the state tuple `S`, each over its own state `S[K]`, each
 * mapping an `I` to the next step's `I` or to `undefined`, which ends the
 * chain. Since `undefined` is that signal, `I` excludes it.
 *
 * The mapped type alone infers `S` from a step tuple but not `I`, which a
 * JavaScript caller then gets as `any`. The array type it is intersected with
 * is the inference site for `I`: it says only that every step takes an `I`.
 * For the same reason there is at least one step: with none, nothing names
 * `I`, and a cascade of no steps is only the identity anyway.
 */
export type CascadeSteps<I extends {} | null, S extends readonly [unknown, ...unknown[]]> =
    { readonly [K in keyof S]: StateScan<I, S[K], I | undefined> } &
    readonly ((input: I, prior: never) => unknown)[]
