/**
 * Common higher-order operator type aliases.
 *
 * @module
 *
 * @import { Addition, CascadeSteps, Fold, NextStep, Reduce, Scan, StateFold, StateScan, Terminal, Transducer, Unary } from './types.ts'
 */

/** A continuing step, optionally emitting a chunk. @type {<S, O = never>(state: S, output?: readonly O[]) => NextStep<S, O>} */
export const nextStep = (state, output = []) => ['next', output, state]

/** A completed step, optionally flushing a chunk. @type {<A, O = never>(result: A, output?: readonly O[]) => Terminal<O, A>} */
export const doneStep = (result, output = []) => ['done', output, result]

/**
 * Gives a simple value-only fold the common lifecycle. It emits no items and
 * never completes before EOF; its final value is the terminal summary.
 * @type {<I, S, A>(fold: StateFold<I, S, A>) => Omit<Transducer<I, S, never, A>, 'init' | 'update'> & { readonly init: NextStep<S>, readonly update: (state: S, input: I) => NextStep<S> }}
 */
export const fromStateFold = fold => ({
    init: nextStep(fold.init),
    update: (state, input) => nextStep(fold.update(state, input)),
    end: state => doneStep(fold.end(state)),
})

/**
 * Gives a per-input scan an explicit initial state and EOF flush. Scan steps
 * emit arrays; `end` returns the final output chunk. The summary is `null`.
 * @type {<I, S, O>(init: S, op: StateScan<I, S, readonly O[]>, end: (state: S) => readonly O[]) => Transducer<I, S, O, null>}
 */
export const fromStateScan = (init, op, end) => ({
    init: nextStep(init),
    update: (state, input) => {
        const [output, following] = op(input, state)
        return nextStep(following, output)
    },
    end: state => doneStep(null, end(state)),
})

/** @type {(separator: string) => Reduce<string>} */
export const join = separator => value => prior =>
    prior + separator + value

/** @type {Reduce<string>} */
export const concat = join('')

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
    const result = op(i, prior)
    return [result[0], stateScanToScan(op)(result[1])]
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
            const current = steps[Number(i)](value, prior[Number(i)])
            const output = current[0]
            const next = output === undefined
                ? /** @type {const} */ ([undefined, prior.slice(i + 1)])
                : step(i + 1, output)
            return [next[0], [current[1], ...next[1]]]
        }
        const result = step(0, input)
        return [result[0], /** @type {S} */ (result[1])]
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
