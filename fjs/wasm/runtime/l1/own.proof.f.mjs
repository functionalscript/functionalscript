/**
 * `get` against the host's own-property read, on every receiver and key of
 * `./proof.f.js`. The reference is `Object.getOwnPropertyDescriptor`, which
 * FunctionalScript does not admit, so the case is kept apart from that proof.
 */

import { assertEq } from '../../../asserts/module.f.js'
import { get } from './module.f.js'
import { keys, receivers } from './proof.f.js'

/**
 * JavaScript's own property of a receiver under a key, with no prototype:
 * NaNVM's member read.
 *
 * @type {(r: unknown, k: unknown) => unknown}
 */
const own = (r, k) => Object.getOwnPropertyDescriptor(Object(r), String(k))?.value

export const proof = {
    get: () => {
        for (const r of receivers) { for (const k of keys) { assertEq(get(r, k), own(r, k), `${String(r)}[${String(k)}]`) } }
    },
}
