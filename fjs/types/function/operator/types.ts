/**
 * Common higher-order operator type aliases.
 *
 * @module
 */

export type Binary<A, B, R> = (a: A) => (b: B) => R

export type Fold<I, O> = Binary<I, O, O>

export type Reduce<T> = Fold<T, T>

/**
 * A fold with explicit state and lifecycle operations.
 *
 * Generic operator functors that expose their state use the `State` prefix;
 * compare {@link StateScan}. `init` creates the state, `update` consumes one
 * input, and `end` turns the final state into the result.
 */
export type StateFold<I, S, O> = {
    readonly init: S
    readonly update: (state: S, input: I) => S
    readonly end: (state: S) => O
}

export type Unary<T, R> = (value: T) => R

export type Equal<T> = Binary<T, T, boolean>

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
 * `StateScan` over a `List` is `stateScan` in `../../list/module.f.mjs`, and
 * {@link ./module.f.mjs | `stateScanToScan`} hides the state to recover a
 * {@link Scan}.
 */
export type StateScan<I, S, O> = (input: I, prior: S) => readonly [O, S]
