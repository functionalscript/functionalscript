/**
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { BitGroups } from '../../website/demo/bits/types.ts'
 */

import { empty, maxLength, maxLengthBytes, vec } from '../../types/bit_vec/module.f.mjs'
import { cBase32ToVec, cBase32ToVec5x, vec5xToCBase32, vecToCBase32 } from './module.f.mjs'
import { assert, assertEq } from '../../asserts/module.f.mjs'
import { demo, groupsOf } from './demo.f.mjs'
import { htmlToString } from '../../media/html/module.f.mjs'
import { unwrap } from '../../types/result/module.f.mjs'

//

/**
 * @param {string} s
 * @param {Vec} v
 */
const check5x = (s, v) => {
    const sr = vec5xToCBase32(v)
    assertEq(sr, s, [sr, s])
    const vr = cBase32ToVec5x(s)
    assertEq(vr, v, [vr, v])
    //
    check(`${s}g`, v)
}

/**
 * @param {string} s
 * @param {Vec} v
 */
const check = (s, v) => {
    const sr = vecToCBase32(v)
    assertEq(sr, s, [sr, s])
    const vr = cBase32ToVec(s)
    assertEq(vr, v, [vr, v])
}

export const proof = {
    roundtrip5x: () => {
        check5x("", empty)
        check5x("0", vec(5n)(0b00000n))
        check5x("1", vec(5n)(0b00001n))
        check5x("7", vec(5n)(0b00111n))
        check5x("a", vec(5n)(0b01010n))
        check5x("b", vec(5n)(0b01011n))
        check5x("f", vec(5n)(0b01111n))
        check5x("gh", vec(10n)(0b10000_10001n))
        check5x("jk", vec(10n)(0b10010_10011n))
        check5x("mnpq", vec(20n)(0b010100_10101_10110_10111n))
        check5x("rstvwxyz", vec(40n)(0b11000_11001_11010_11011_11100_11101_11110_11111n))
    },
    roundtrip: () => {
        check("g", empty)
        check("8", vec(1n)(0n))
        check("r", vec(1n)(1n))
        check("4", vec(2n)(0n))
        check("c", vec(2n)(1n))
        check("2", vec(3n)(0n))
        check("1", vec(4n)(0n))
        check("2g", vec(5n)(2n))
        check("01", vec(9n)(0n))
    },
    unalignedBits: () => {
        const v = vec(1n)(1n)
        const cr = vec5xToCBase32(v)
        assertEq(cr, "g", ['g', cr])
    },
    caseInsensitive: () => {
        assertEq(cBase32ToVec5x("A"), cBase32ToVec5x("a"), 'case-insensitive expected')
        assertEq(cBase32ToVec5x("I"), cBase32ToVec5x("1"), 'i maps to 1')
        assertEq(cBase32ToVec5x("l"), cBase32ToVec5x("1"), 'l maps to 1')
        assertEq(cBase32ToVec5x("o"), cBase32ToVec5x("0"), 'o maps to 0')
        assertEq(cBase32ToVec5x("u"), null, 'should error on invalid character')
    },
    unterminated: () => {
        // No sentinel `1` bit → invalid; must return null, not loop forever.
        assertEq(cBase32ToVec(""), null, 'empty must be null')
        assertEq(cBase32ToVec("0"), null, 'single zero symbol must be null')
        assertEq(cBase32ToVec("00"), null, 'all-zero symbols must be null')
        assertEq(cBase32ToVec("o"), null, 'o (maps to 0) must be null')
        assertEq(cBase32ToVec('u'), null, 'invalid trailing symbol must be null')
        assertEq(cBase32ToVec('u8'), null, 'invalid symbol before sentinel must be null')
        assertEq(cBase32ToVec('8u'), null, 'invalid symbol after sentinel must be null')
    },
    trailingZeroSymbols: () => {
        assertEq(cBase32ToVec('g0'), empty)
        assertEq(cBase32ToVec('80'), vec(1n)(0n))
    },
    decodeAtMaxLengthSucceeds: () => {
        const value = vec(maxLength)(0n)
        // Construct the boundary encoding directly. Encoding a `maxLength`
        // vector exceeds Bun's own BigInt size limit while adding the stop
        // bit, independently of this decoder regression.
        const encoded = '0'.repeat(209_715) + '8'
        assertEq(cBase32ToVec(encoded), value)
    },
    decodeOverflow: () => {
        // Reject both an independently oversized head and a valid head whose
        // retained tail would push the combined result over `maxLength`.
        assertEq(cBase32ToVec('0'.repeat(209_717) + 'g'), null)
        assertEq(cBase32ToVec('0'.repeat(209_715) + '4'), null)
        assertEq(cBase32ToVec('0'.repeat(209_715) + '1'), null)
    },
    /**
     * **What the demo shows is pinned**: the groups it draws, stop bit
     * included, and what `vecToCBase32` wrote for them.
     */
    demo: {
        groups: () => {
            /** @type {(text: string) => BitGroups} */
            const encoded = text => unwrap(groupsOf(text))
            // Empty text is the stop bit alone.
            assertEq(JSON.stringify(encoded('')), JSON.stringify({ chars: [], groups: [{ data: '', stop: '1', fill: '0000' }], encoded: 'g' }))
            assertEq(JSON.stringify(encoded('h')), JSON.stringify({
                chars: [{ label: 'h', standIn: false, bytes: ['01101000'] }],
                groups: [
                    { data: '01101', stop: '', fill: '' },
                    { data: '000', stop: '1', fill: '0' },
                ],
                encoded: 'd2',
            }))
            assertEq(JSON.stringify(encoded('hé').groups.map(g => g.data)), JSON.stringify(['01101', '00011', '00001', '11010', '1001']))
            assertEq(encoded('hé').encoded, 'd31tk')
        },
        /**
         * **The demo stops one byte short of the largest bit vector**, since
         * `vecToCBase32` appends the stop bit before encoding and a vector
         * past the largest throws on JavaScriptCore
         * ([encode-at-max-length](./todo/encode-at-max-length.md)). One byte
         * less encodes, on every engine.
         */
        maxLength: () => {
            assertEq(groupsOf('a'.repeat(Number(maxLengthBytes)))[0], 'error')
            assertEq(groupsOf('a'.repeat(Number(maxLengthBytes) - 1))[0], 'ok')
        },
        view: () => {
            const html = htmlToString(demo.view(demo.init))
            // No blocks: the boxes wrap anywhere.
            assert(html.includes('<div data-bit-box=""><span>1001<span data-bit="stop">1</span></span><span data-bit-char="">k</span></div>'), html)
            assert(!html.includes('data-bit-block'), html)
            assert(html.includes('Result: <strong>d31tk</strong>'), html)
        },
    },
}
