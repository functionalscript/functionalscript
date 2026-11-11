/**
 * Mock effect runtimes for testing effectful programs.
 *
 * See `./types.ts` for the `MemOperationMap`/`RunInstance` type-level API.
 *
 * @module
 *
 * @import { Commands, Effect, MatchResult, Operation } from '../types.ts'
 * @import { MemOperationMap, PartialMemOperationMap, RunInstance } from './types.ts'
 * @import { All } from '../common/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 */

import { match, partialMatch } from "../module.f.mjs"
import { notImplemented } from "../module.f.mjs"
import { error, ok } from "../../types/result/module.f.js"

/** @type {<O extends Operation, S>(o: MemOperationMap<O, S>) => RunInstance<O, S>} */
export const run = o => _loop(match(o))

/**
 * `all` answered over the runner `run` returns: each effect in turn, the state
 * threaded from one to the next, and every effect's whole `Result` in order —
 * `all`'s own envelope says only that the runner dispatched them. The
 * sequential reading is a valid one, since `all` says the effects may run at
 * once, not that they must. The counterpart of `fjs/effects/module.mjs`'s
 * `allOver`, so no mock writes the fold or the self-reference it needs.
 *
 * @type {<S>(run: () => RunInstance<never, S>) => (...effects: readonly Effect<never, unknown, unknown>[]) => (state: S) => readonly [S, Result<readonly Result<unknown, unknown>[], never>]}
 */
const allOver = run => (...effects) => state => {
    const [s, rs] = effects.reduce(
        ([s1, rs1], e) => {
            const [ns, r] = run()(s1)(e)
            return [ns, [...rs1, r]]
        },
        /** @type {readonly [typeof state, readonly Result<unknown, unknown>[]]} */ ([state, []]))
    return [s, ok(rs)]
}

/**
 * {@link run} for a runner that declares {@link All}: `o` holds every other
 * handler, and `all` runs its effects through this very runner.
 *
 * @type {<O extends Operation, S>(o: MemOperationMap<Exclude<O, All>, S>) => RunInstance<O, S>}
 */
export const runAll = o => {
    /** @type {RunInstance<any, any>} */
    const runner = run(/** @type {any} */ ({ ...o, all: allOver(() => runner) }))
    return runner
}

/**
 * {@link run} for a runner that implements only part of `O`.
 *
 * A command in `commands` with no handler answers `error(notImplemented)`
 * through the ordinary continuation, so a program that asks for something this
 * runner lacks gets its control back and decides what to do. A command outside
 * `commands` still panics — see `partialMatch`. Where `commands` includes
 * `all`, the runner answers it over itself, as {@link runAll} does.
 *
 * **The injector lives here rather than at the call site.** `partialMatch`
 * cannot build one because the shape of an answer is the runner's, not the
 * operation's; this loop's is `(state) => [state, …]`, and writing it once here
 * is the whole reason each runner supplies its own.
 *
 * @type {<O extends Operation, S>(commands: Commands<O>) => (o: PartialMemOperationMap<O, S>) => RunInstance<O, S>}
 */
export const partialRun = commands => o => {
    /** @type {(command: string) => (state: any) => readonly[any, any]} */
    const onMissing = command => state => [state, error(notImplemented(command))]
    /** @type {RunInstance<any, any>} */
    const runner = _loop(partialMatch(commands, onMissing)(
        commands.includes('all') ? { ...o, all: allOver(() => runner) } : o))
    return runner
}

/**
 * The interpreter loop both runners share: step the effect, thread the state
 * through the handler's transition, resume with the command's output.
 *
 * @type {<O extends Operation, S>(
 *     next: <O1 extends O, T, E>(e: Effect<O1, T, E>) => MatchResult<O1, T, E, (state: S) => readonly[S, any]>
 * ) => RunInstance<O, S>}
 */
const _loop = next => state => effect => {
    let s = state
    let e = effect
    while (true) {
        const r = next(e)
        if (r[0] === 'done') {
            return [s, r[1]]
        }
        const [ns, m] = r[1](s)
        s = ns
        e = r[2](m)
    }
}
