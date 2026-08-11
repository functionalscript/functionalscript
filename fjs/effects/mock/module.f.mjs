/**
 * Mock effect runtimes for testing effectful programs.
 *
 * See `./types.ts` for the `MemOperationMap`/`RunInstance` type-level API.
 *
 * @module
 */
import { match } from "../module.f.mjs"
/** @import { Operation } from '../types.ts' */
/** @import { MemOperationMap, RunInstance } from './types.ts' */

/** @type {<O extends Operation, S>(o: MemOperationMap<O, S>) => RunInstance<O, S>} */
export const run = o => state => effect => {
    const next = match(o)
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
