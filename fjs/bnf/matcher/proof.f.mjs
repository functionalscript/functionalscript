/**
 * @import { CodePointMeta } from '../descent/types.ts'
 */

import { assertEq } from '../../asserts/module.f.mjs'
import { identity } from '../../types/function/module.f.mjs'
import { eofSymbol } from '../module.f.mjs'
import { leafAt, mrFail, mrSuccess, physicalIdx, symbolAt } from './module.f.mjs'

/** @type {readonly CodePointMeta<string>[]} */
const withMeta = [[0x41, 'a'], [0x42, 'b']]

/** @type {(leaf: CodePointMeta<string>) => number} */
const metaSymbolOf = ([symbol]) => symbol

export const proof = {
    leafAt: [
        () => {
            // Inside the physical input a leaf is contributed whole, whatever a
            // backend chose a leaf to be.
            assertEq(JSON.stringify(leafAt([65, 66], 0)), '[65]')
            assertEq(JSON.stringify(leafAt([65, 66], 1)), '[66]')
            assertEq(JSON.stringify(leafAt(withMeta, 0)), '[[65,"a"]]')
        },
        () => {
            // At and past the physical end there is nothing to contribute: the
            // synthesized end-of-input symbol has no source element, so it never
            // reaches an AST.
            assertEq(JSON.stringify(leafAt([65, 66], 2)), '[]')
            assertEq(JSON.stringify(leafAt([65, 66], 3)), '[]')
            assertEq(JSON.stringify(leafAt([], 0)), '[]')
        },
    ],
    symbolAt: [
        () => {
            // `identity` is the leaf reader of a backend whose leaf *is* the
            // symbol; a pair's reader takes its first half. Same positions, same
            // symbols.
            /** @type {(leaf: number) => number} */
            const symbolOf = identity
            assertEq(symbolAt(symbolOf)([65, 66], 0), 65)
            assertEq(symbolAt(metaSymbolOf)(withMeta, 0), 65)
            assertEq(symbolAt(metaSymbolOf)(withMeta, 1), 66)
        },
        () => {
            // The one synthesized end-of-input symbol sits at the physical end,
            // for either leaf shape.
            /** @type {(leaf: number) => number} */
            const symbolOf = identity
            assertEq(symbolAt(symbolOf)([65, 66], 2), eofSymbol)
            assertEq(symbolAt(metaSymbolOf)(withMeta, 2), eofSymbol)
            assertEq(symbolAt(symbolOf)([], 0), eofSymbol)
        },
    ],
    physicalIdx: () => {
        const physical = physicalIdx(2)
        assertEq(physical(0), 0)
        assertEq(physical(2), 2)
        // Consuming the end-of-input symbol moves the cursor past the physical
        // end, and both cursors report the same public index — which is what
        // keeps a public position physical.
        assertEq(physical(3), 2)
    },
    mrSuccess: () => {
        assertEq(
            JSON.stringify(mrSuccess('some', [65], 1)),
            '{"ast":{"tag":"some","sequence":[65]},"success":true,"pos":1}')
        // The position type is the backend's own: `null` is how a predictive
        // backend says it ran out of input.
        assertEq(
            JSON.stringify(mrSuccess(undefined, [], null)),
            '{"ast":{"sequence":[]},"success":true,"pos":null}')
    },
    mrFail: () => {
        assertEq(
            JSON.stringify(mrFail(true, [], 0)),
            '{"ast":{"tag":true,"sequence":[]},"success":false,"pos":0}')
    },
}
