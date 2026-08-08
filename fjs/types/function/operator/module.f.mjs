/**
 * Common higher-order operator type aliases.
 *
 * @module
 */

/**
 * @template A
 * @template B
 * @template R
 * @typedef {(a: A) => (b: B) => R} Binary
 */

/**
 * @template I
 * @template O
 * @typedef {Binary<I, O, O>} Fold
 */

/**
 * @template T
 * @typedef {Fold<T, T>} Reduce
 */

/** @type {(separator: string) => Reduce<string>} */
export const join = separator => value => prior =>
    `${prior}${separator}${value}`

/** @type {Reduce<string>} */
export const concat = i => acc => `${acc}${i}`

/**
 * @template T
 * @template R
 * @typedef {(value: T) => R} Unary
 */

/** @type {Unary<boolean, boolean>} */
export const logicalNot = v => !v

/**
 * @template T
 * @typedef {Binary<T, T, boolean>} Equal
 */

/**
 * See also `Object.is` which should be used for deep comparison instead of the `structEqual`.
 * TODO: add `binaryEqual = a => b => Object.is(a, b)`.
 *
 * @type {<T>(a: T) => (b: T) => boolean}
 */
export const strictEqual = a => b => a === b

/**
 * @template I
 * @template O
 * @typedef {(input: I) => readonly[O, Scan<I,O>]} Scan
 */

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
 *   DFA states in `../../../fsm/module.f.ts`);
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
 * `StateScan` over a `List` is `stateScan` in `../../list/module.f.ts`, and
 * {@link stateScanToScan} hides the state to recover a {@link Scan}.
 *
 * @template I
 * @template S
 * @template O
 * @typedef {(input: I, prior: S) => readonly[O, S]} StateScan
 */

/** @type {<I, S, O>(op: StateScan<I, S, O>) => (prior: S) => Scan<I, O>} */
export const stateScanToScan = op => prior => i => {
    const [o, s] = op(i, prior)
    return [o, stateScanToScan(op)(s)]
}

/** @type {<I, O>(fold: Fold<I, O>) => (prior: O) => Scan<I, O>} */
export const foldToScan = fold => prior => i => {
    const result = fold(i)(prior)
    return [result, foldToScan(fold)(result)]
}

/** @type {<T>(op: Reduce<T>) => Scan<T, T>} */
export const reduceToScan = op => init =>
    [init, foldToScan(op)(init)]

/**
 * TODO: We should have one function for `number` | `bigint` and `string`.
 *       We can use the same approach as we use for comparing items,
 *       see `Cmp1` and `Cmp2` types.
 *
 * @type {Reduce<number>}
 */
export const addition = a => b => a + b

/** @type {Unary<number, number>} */
export const increment = addition(1)

export const counter = () => increment
