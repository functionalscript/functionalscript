/**
 * Common higher-order operator type aliases.
 *
 * @module
 *
 * @import { Addition, CascadeSteps, Fold, Reduce, Scan, StateScan, Unary } from './types.ts'
 */

/** @type {(separator: string) => Reduce<string>} */
export const join = separator => value => prior =>
    `${prior}${separator}${value}`

/** @type {Reduce<string>} */
export const concat = i => acc => `${acc}${i}`

/** @type {Unary<boolean, boolean>} */
export const logicalNot = v => !v

/**
 * See also `Object.is` which should be used for deep comparison instead of the `structEqual`.
 * TODO: add `binaryEqual = a => b => Object.is(a, b)`.
 *
 * @type {<T>(a: T) => (b: T) => boolean}
 */
export const strictEqual = a => b => a === b

/** @type {<I, S, O>(op: StateScan<I, S, O>) => (prior: S) => Scan<I, O>} */
export const stateScanToScan = op => prior => i => {
    const [o, s] = op(i, prior)
    return [o, stateScanToScan(op)(s)]
}

export const cascade =
    /**
     * Chains `steps` into one {@link StateScan}: each step's output is the next
     * step's input, and the chain stops at the first step that outputs
     * `undefined`. Each step keeps its own state, at its position in the state
     * tuple; a step the chain did not reach keeps its state unchanged. The last
     * step's output is the cascade's.
     *
     * `undefined` is the stop signal, so `I` excludes it: a step whose input
     * could be `undefined` would have no way to pass that value on.
     *
     * @template {{} | null} I
     * @template {readonly [unknown, ...unknown[]]} const S
     * @param {CascadeSteps<I, S>} steps
     * @returns {StateScan<I, S, I | undefined>}
     */
    steps => (input, prior) => {
        /** @type {(i: number, value: I) => readonly [I | undefined, readonly unknown[]]} */
        const step = (i, value) => {
            if (i === steps.length) { return [value, []] }
            const [output, state] = steps[i](value, prior[i])
            const [result, rest] = output === undefined
                ? [undefined, prior.slice(i + 1)]
                : step(i + 1, output)
            return [result, [state, ...rest]]
        }
        const [output, state] = step(0, input)
        return [output, /** @type {S} */ (state)]
    }

/** @type {<I, O>(fold: Fold<I, O>) => (prior: O) => Scan<I, O>} */
export const foldToScan = fold => prior => i => {
    const result = fold(i)(prior)
    return [result, foldToScan(fold)(result)]
}

/** @type {<T>(op: Reduce<T>) => Scan<T, T>} */
export const reduceToScan = op => init =>
    [init, foldToScan(op)(init)]

/** @type {Addition} */
export const addition = a => b => /** @type {any} */ (a) + b

/** @type {Unary<number, number>} */
export const increment = addition(1)

export const counter = () => increment
