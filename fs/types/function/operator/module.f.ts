/**
 * Common higher-order operator type aliases.
 *
 * @module
 */
export type Binary<A, B, R> = (a: A) => (b: B) => R

export type Fold<I, O> = Binary<I, O, O>

export const join = (separator: string): Reduce<string> => value => prior =>
    `${prior}${separator}${value}`

export const concat: Reduce<string> = i => acc =>
    `${acc}${i}`

export type Unary<T, R> = (value: T) => R

export const logicalNot: Unary<boolean, boolean>
    = v => !v

export type Equal<T> = Binary<T, T, boolean>

export const strictEqual = <T>(a: T) => (b: T): boolean =>
    a === b

export type Scan<I, O> = (input: I) => readonly[O, Scan<I,O>]

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
 * machine: a finite `S`/`I`/`O` recovers the classical finite-state machine
 * (e.g. the DFA states in `../../../fsm/module.f.ts`), but an unbounded `S` —
 * say `bigint` — can count, which no finite automaton can, and `O` may be a
 * list (0+ symbols per input), not the single symbol strict Mealy emits.
 * (Functional/coalgebraic usage still calls this `(input, state) => [output,
 * state]` shape a "Mealy machine", finiteness aside.)
 *
 * A {@link Fold} is the output-less special case (state only); driving a
 * `StateScan` over a `List` is `stateScan` in `../../list/module.f.ts`, and
 * {@link stateScanToScan} hides the state to recover a {@link Scan}.
 */
export type StateScan<I, S, O> = (input: I, prior: S) => readonly[O, S]

export const stateScanToScan = <I, S, O>(op: StateScan<I, S, O>) => (prior: S): Scan<I, O> => i => {
    const [o, s] = op(i, prior)
    return [o, stateScanToScan(op)(s)]
}

export const foldToScan = <I, O>(fold: Fold<I, O>) => (prior: O): Scan<I, O> => i => {
    const result = fold(i)(prior)
    return [result, foldToScan(fold)(result)]
}

export type Reduce<T> = Fold<T, T>

export const reduceToScan = <T>(op: Reduce<T>): Scan<T, T> => init =>
    [init, foldToScan(op)(init)]

export const addition: Reduce<number>
    = a => b => a + b

export const increment: (b: number) => number
    = addition(1)

export const counter = () => increment
