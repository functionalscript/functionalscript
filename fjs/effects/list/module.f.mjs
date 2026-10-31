/**
 * Effectful cons-list construction.
 *
 * See `./types.ts` for the type-level API.
 *
 * @module
 *
 * @import { Operation } from "../types.ts"
 * @import { Effect } from "../types.ts"
 * @import { List } from "../../types/list/types.ts"
 * @import { EffectList, Next } from "./types.ts"
 * @import { Step, Transducer } from "../../types/function/operator/types.ts"
 */

import { pure, pureOk, runPure, step } from "../module.f.mjs"
import { next } from "../../types/list/module.f.mjs"
import { ok } from "../../types/result/module.f.js"
import { doneStep, nextStep } from "../../types/function/operator/module.f.js"

/**
 * The empty `EffectList`: a pure end-of-stream marker (`undefined`).
 *
 * The explicit `Effect<O, Next<O, T, E>, E>` return type lets the contextual
 * type drive the check, so the recursive payload type-checks without a cast.
 * Construct streams through these two combinators, and end a stream that
 * *failed* with `pureError` rather than with either of them.
 *
 * Note: the expanded type is written out because TypeScript cannot convert
 *       `pureOk(...)` to `EffectList<O, T, E>`.
 *
 * The defaults describe the pure constructor: it performs no operations and
 * cannot fail. A surrounding stream can still supply its wider contextual type.
 *
 * @type {<O extends Operation = never, T = never, E = never>() => Effect<O, Next<O, T, E>, E>}
 */
export const empty = () =>
    pureOk(undefined)

/**
 * Prepends `first` to an {@link EffectList} `tail`, as a pure cons cell. `tail`
 * is an ordinary argument, so it is built before the cell is — see
 * {@link Next}.
 *
 * @type {<O extends Operation, T, E>(first: T, tail: EffectList<O, T, E>) => Effect<O, Next<O, T, E>, E>}
 */
export const nonEmpty = (first, tail) =>
    pureOk({ first, tail })

/**
 * A strict list as a stream: one pure cell per item, each made as the
 * consumer reaches it, so a list longer than an array would hold is streamed
 * as it is and never built whole. Pure cells issue no command, which is
 * what lets a producer that already has its bytes — a blob read out of a
 * Git object — answer the `EffectList` a consumer of `Cas<O>.read` expects.
 *
 * @template {Operation} [O=never]
 * @template [T=never]
 * @template [E=never]
 * @param {List<T>} list
 * @returns {Effect<O, Next<O, T, E>, E>}
 */
export const fromList = list => () => {
    const n = next(list)
    return ok(n === null ? undefined : { first: n.first, tail: /** @type {EffectList<O, T, E>} */ (fromList(n.tail)) })
}

/**
 * Drives pure spans with a loop; a command suspends through the existing effect
 * composition API. No output is collected. Source and sink failures pass through
 * unchanged, and neither calls the machine's EOF operation.
 *
 * @type {<I, S, O, A, P extends Operation, E, Q extends Operation, F>(machine: Transducer<I, S, O, A>, emit: (output: readonly O[]) => Effect<Q, unknown, F>, input: EffectList<P, I, E>, current: Step<S, O, A>) => Effect<P | Q, A, E | F>}
 */
const drive = (machine, emit, input, current) => {
    let remaining = input
    let pending = current
    while (true) {
        const [tag, output, value] = pending
        if (output.length !== 0) {
            const emitted = emit(output)
            const observed = runPure(emitted)
            if (observed.length === 0) {
                const rest = remaining
                const silent = tag === 'done' ? doneStep(value) : nextStep(value)
                return step(emitted, () => drive(machine, emit, rest, silent))
            }
            if (observed[0][0] === 'error') { return pure(observed[0]) }
        }
        if (tag === 'done') { return pureOk(value) }
        const pulled = runPure(remaining)
        if (pulled.length === 0) {
            return step(remaining, node => node === undefined
                ? drive(machine, emit, empty(), machine.end(value))
                : drive(machine, emit, node.tail, machine.update(value, node.first)))
        }
        if (pulled[0][0] === 'error') { return pure(pulled[0]) }
        const node = pulled[0][1]
        if (node === undefined) {
            pending = machine.end(value)
        } else {
            pending = machine.update(value, node.first)
            remaining = node.tail
        }
    }
}

/**
 * Runs a machine over an effectful source, delivering each nonempty emitted
 * chunk to `emit` before pulling more input. The final flush is delivered before
 * the summary is returned. The sink supplies effects such as writing chunks;
 * output is never accumulated into an intermediate `EffectList`.
 *
 * A `done` initial step does not pull input. Early completion does not call
 * `end` again. A pure span is processed with a loop, so long non-emitting sources
 * do not grow the JavaScript call stack. Real source and sink commands remain
 * suspended for their runner. This also respects `EffectList`'s strict pure-cell
 * representation instead of promising a lazy stream of arbitrary effect shapes.
 *
 * @type {<I, S, O, A>(machine: Transducer<I, S, O, A>) => <Q extends Operation, F>(emit: (output: readonly O[]) => Effect<Q, unknown, F>) => <P extends Operation, E>(input: EffectList<P, I, E>) => Effect<P | Q, A, E | F>}
 */
export const transduce = machine => emit => input => drive(machine, emit, input, machine.init)

/**
 * Runs a machine to its summary, discarding emission. Domain failures remain
 * summary values; source failures remain in the effect's error channel.
 * @type {<I, S, O, A>(machine: Transducer<I, S, O, A>) => <P extends Operation, E>(input: EffectList<P, I, E>) => Effect<P, A, E>}
 */
export const run = machine => input =>
    drive(machine, empty, input, machine.init)
