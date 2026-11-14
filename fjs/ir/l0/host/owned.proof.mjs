/**
 * Host proofs that run hand-written owned IR on the counting host: concat
 * and from_unit leave nothing over, and a misplaced drop is visible as a
 * throw or a leftover cell.
 *
 * Prefer `node --test` for this file
 * ([fjs/AGENTS.md §1.6](../../../../AGENTS.md#16-use-host-proofs-only-for-documented-host-contracts)).
 */

import { assert, assertEq, assertOk } from '../../../asserts/module.f.js'
import { write } from '../../../media/wasm/binary/write/module.f.js'
import { check } from '../../check/module.f.js'
import {
    call, fn, get, let_, only, u, unit,
} from '../../module.f.js'
import { emit } from '../../wasm/module.f.js'
import { any, l0 } from '../module.f.js'
import { host } from './module.f.js'

const string = only(any, 'string')

/** @type {(params: import('../../types.ts').Param[], result: import('../../types.ts').Type, body: import('../../types.ts').Term) => import('../../types.ts').Module} */
const moduleOf = (params, result, body) => ({
    imports: l0,
    functions: [['f', fn(params, result, body)]],
    exports: ['f'],
})

/**
 * Check, emit and instantiate `m` with a counting host seeded by `values`.
 * @type {(m: import('../../types.ts').Module, values: readonly unknown[]) => {
 *   readonly f: (...args: readonly unknown[]) => unknown,
 *   readonly h: ReturnType<typeof host>,
 * }}
 */
const load = (m, values) => {
    const checked = assertOk(check(m))
    const bytes = new Uint8Array(write(emit(checked)))
    assert(WebAssembly.validate(bytes))
    const h = host(values)
    const { exports } = new WebAssembly.Instance(new WebAssembly.Module(bytes), { 'fjs:l0': h })
    const f = exports.f
    assert(typeof f === 'function')
    return { f: /** @type {(...args: readonly unknown[]) => unknown} */ (f), h }
}

export const proof = {
    // concat(s, s) answers an owned string; dropping it leaves nothing.
    concat: () => {
        const { f, h } = load(
            moduleOf([['s', string]], string, call('String', 'concat', [get('s'), get('s')])),
            ['ab'],
        )
        const r = /** @type {bigint} */ (f(0n))
        assertEq(h.read(r), 'abab')
        h.drop(r)
        h.drop(0n)
        assertEq(h.live(), 0)
    },
    // from_unit then drop: the module frees what it made; the caller frees the unit arg's cell? c is u16, not any.
    fromUnit: () => {
        const { f, h } = load(
            moduleOf(
                [['c', u(16)]],
                unit,
                let_('s', call('String', 'from_unit', [get('c')]), s => call('Any', 'drop', [s])),
            ),
            [],
        )
        f(0x61)
        assertEq(h.live(), 0)
    },
}
