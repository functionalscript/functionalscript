/**
 * Host proof of linked String length/unit vs L0 on the counting host
 * ([short-strings.md](../../../../doc/sasha-gil/ir/short-strings.md) S3):
 * short boxes take the IR short path; long dyn-refs still import.
 *
 * Prefer `node --test` for this file
 * ([fjs/AGENTS.md §1.6](../../../../AGENTS.md#16-a-host-proof-is-for-an-effect-and-for-nothing-else)).
 *
 * @import { Module } from '../../types.ts'
 */

import { assert, assertEq, assertOk } from '../../../asserts/module.f.js'
import { write } from '../../../media/wasm/binary/write/module.f.js'
import { check } from '../../check/module.f.js'
import { linkAny, linkString } from '../../from_fast/link/module.f.js'
import { l0, string } from '../../l0/module.f.js'
import { counting } from '../../l0/host/count/module.mjs'
import { lifetime } from '../../lifetime/module.f.js'
import { call, fn, u } from '../../module.f.js'
import { emit } from '../../wasm/module.f.js'
import { module as anyModule } from '../any/module.f.js'
import { EMPTY } from '../box/module.f.js'
import { pack } from './short.f.js'
import { module as stringModule } from './ir.f.js'

/** @type {(b: bigint) => bigint} */
const i64 = b => BigInt.asIntN(64, b)

/**
 * Linked length/unit on a counting host.
 *
 * @type {() => { readonly len: Function, readonly at: Function, readonly h: ReturnType<typeof counting> }}
 */
const load = () => {
    /** @type {Module} */
    const program = {
        imports: l0,
        functions: [
            ['len', fn([['s', string]], u(31), s => call('String', 'length', [s]))],
            ['at', fn([['s', string], ['i', u(31)]], u(16), (s, i) => call('String', 'unit', [s, i]))],
        ],
        exports: ['len', 'at'],
    }
    const linked = assertOk(linkString(stringModule)(assertOk(linkAny(anyModule)(program))))
    const checked = assertOk(check(assertOk(lifetime(linked))))
    const bytes = new Uint8Array(write(emit(checked)))
    assert(WebAssembly.validate(bytes))
    const h = counting([])
    const { exports } = new WebAssembly.Instance(new WebAssembly.Module(bytes), { 'fjs:l0': h.imports })
    const len = exports.len
    const at = exports.at
    assert(typeof len === 'function' && typeof at === 'function')
    return { len, at, h }
}

export const proof = {
    // Short boxes: IR length/unit match pack helpers / L0 view; no cells.
    shortParity: () => {
        const { len, at, h } = load()
        /** @type {readonly (readonly [string, bigint])[]} */
        const cases = [
            ['', EMPTY],
            ['A', assertOk(pack([0x41]))],
            ['\u0000', assertOk(pack([0]))],
            ['ab', assertOk(pack([0x61, 0x62]))],
            ['xyz', assertOk(pack([0x78, 0x79, 0x7a]))],
            ['abcd', assertOk(pack([0x61, 0x62, 0x63, 0x64]))],
            ['hello', assertOk(pack([0x68, 0x65, 0x6c, 0x6c, 0x6f]))],
            ['$0A_az12', assertOk(pack([0x24, 0x30, 0x41, 0x5f, 0x61, 0x7a, 0x31, 0x32]))],
        ]
        for (const [text, bits] of cases) {
            const box = i64(bits)
            assertEq(len(box), text.length)
            assertEq(h.imports.length(box), text.length)
            if (text.length > 0) {
                assertEq(at(box, 0), text.charCodeAt(0))
                assertEq(at(box, text.length - 1), text.charCodeAt(text.length - 1))
                assertEq(h.imports.unit(box, 0), text.charCodeAt(0))
            }
        }
        assertEq(h.live().join(), '')
    },
    // Long dyn-ref: still the import path; OOB traps like L0.
    longMiss: () => {
        const { len, at, h } = load()
        const long = h.own('hello!')
        assertEq(len(long), 6)
        assertEq(at(long, 1), 0x65)
        assertEq(h.imports.length(long), 6)
        try {
            at(i64(EMPTY), 0)
            throw 'expected trap'
        } catch (e) {
            assert(e !== 'expected trap')
        }
        try {
            at(i64(assertOk(pack([0x61]))), 1)
            throw 'expected trap'
        } catch (e) {
            assert(e !== 'expected trap')
        }
        h.imports.drop(long)
        assertEq(h.live().join(), '')
    },
}
