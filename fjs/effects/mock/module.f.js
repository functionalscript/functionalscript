/**
 * Mock effect runtimes for testing effectful programs.
 *
 * See `./types.ts` for the `MemOperationMap`/`RunInstance` type-level API.
 *
 * @module
 *
 * @import { Commands, Effect, MatchResult, Operation } from '../types.ts'
 * @import { MemOperationMap, PartialMemOperationMapWithRunner, RunInstance } from './types.ts'
 * @import { All } from '../common/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 */

import { match, partialMatch } from "../module.f.js"
import { notImplemented } from "../module.f.js"
import { error, ok } from "../../types/result/module.f.js"

/**
 * The interpreter loop both runners share: step the effect, thread the state
 * through the handler's transition, resume with the command's output.
 *
 * @template {Operation} O
 * @template S
 * @param {<O1 extends O, T, E>(e: Effect<O1, T, E>) => MatchResult<O1, T, E, (state: S, run: RunInstance<O, S>) => readonly[S, any]>} next
 * @returns {RunInstance<O, S>}
 */
const _loop = next => {
    /** @type {RunInstance<O, S>} */
    const runner = state => effect => {
        let s = state
        let e = effect
        while (true) {
            const r = next(e)
            if (r[0] === 'done') {
                return [s, r[1]]
            }
            const [ns, m] = r[1](s, runner)
            s = ns
            e = r[2](m)
        }
    }
    return runner
}

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
 * @type {<S>(...effects: readonly Effect<never, unknown, unknown>[]) => (state: S, run: RunInstance<never, S>) => readonly [S, Result<readonly Result<unknown, unknown>[], never>]}
 */
const allOver = (...effects) => (state, run) => {
    const [s, rs] = effects.reduce(
        ([s1, rs1], e) => {
            const [ns, r] = run(s1)(e)
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
export const runAll = o => run(/** @type {any} */ ({ ...o, all: allOver }))

/** @type {<O extends Operation, S>(command: string) => (state: S, run: RunInstance<O, S>) => readonly[S, any]} */
const onMissing = command => state => [state, error(notImplemented(command))]

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
 * A transition may accept the active runner after its state to run nested
 * effects. The map, matcher and runner are constructed once; a nested call
 * receives that same runner rather than rebuilding the interpreter.
 *
 * @template {Operation} O
 * @template S
 * @param {Commands<O>} commands
 * @returns {(o: PartialMemOperationMapWithRunner<O, S>) => RunInstance<O, S>}
 */
export const partialRun = commands => {
    const matchMap = partialMatch(commands, /** @type {typeof onMissing<O, S>} */ (onMissing))
    const hasAll = commands.includes('all')
    return o => (/** @type {typeof _loop<O, S>} */ (_loop))(matchMap(
        hasAll ? { ...o, all: allOver } : o))
}
