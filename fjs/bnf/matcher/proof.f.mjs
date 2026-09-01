/**
 * @import { Meta } from './types.ts'
 * @import { Monoid } from '../../common/monoid/types.ts'
 */

import { assertEq } from '../../asserts/module.f.mjs'
import { identity } from '../../types/function/module.f.mjs'
import { eofSymbol } from '../module.f.mjs'
import {
    astRepeat,
    astSequence,
    astTerminal,
    astVariant,
    leafAt,
    mrFail,
    mrSuccess,
    physicalIdx,
    symbolAt,
    transformerTools,
} from './module.f.mjs'

/** @type {readonly Meta<string, number>[]} */
const withMeta = [[0x41, 'a'], [0x42, 'b']]

/** @type {(leaf: Meta<string, number>) => number} */
const metaSymbolOf = ([symbol]) => symbol

/** @type {Monoid<string>} */
const stringMonoid = {
    identity: '',
    operation: a => b => a + b,
}

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
    astTransformers: {
        terminal: () => {
            assertEq(
                JSON.stringify(astTerminal('x')([65, 'a'])),
                '[{"tag":"x","sequence":[[65,"a"]]},"a"]')
            assertEq(
                JSON.stringify(astTerminal(undefined)([eofSymbol, ''])),
                '[{"sequence":[]},""]')
        },
        sequence: () => {
            assertEq(
                JSON.stringify(astSequence(true)([['a', 'b'], 'ab'])),
                '[{"tag":true,"sequence":["a","b"]},"ab"]')
        },
        variant: () => {
            const node = /** @type {const} */ ({ tag: 'a', sequence: [] })
            assertEq(
                JSON.stringify(astVariant([['a', node], 'm'])),
                '[{"tag":"a","sequence":[]},"m"]')
        },
        repeat: () => {
            const fold = astRepeat(stringMonoid)(undefined)
            assertEq(JSON.stringify(fold.end(fold.init)), '[{"sequence":[]},""]')
            const s0 = fold.update(fold.init, ['a', 'A'])
            const s1 = fold.update(s0, ['b', 'B'])
            assertEq(JSON.stringify(fold.end(s1)), '[{"sequence":["a","b"]},"AB"]')
        },
    },
    transformerTools: () => {
        const tools = transformerTools(stringMonoid)
        const terminal = tools.terminalOf(([cp, metadata]) => [cp, metadata])
        const sequence = tools.sequenceOf(1, ([items, metadata]) => [items[0], metadata])
        const variant = tools.variantOf(['a'], ([branch, metadata]) => [branch[1], metadata])
        const repeat = tools.repeatOf('a', {
            init: '',
            update: (state, [, metadata]) => state + metadata,
            end: state => [state, state],
        })
        const entries = [
            tools.entry(1, terminal),
            tools.entry(/** @type {const} */ ([1]), sequence),
            tools.entry(/** @type {const} */ ({ a: 1 }), variant),
            tools.entry('a', repeat),
        ]
        assertEq(tools.map(...entries).entries.size, 4)
        assertEq(JSON.stringify(tools.unit), '["unit"]')
    },
    throw: {
        duplicate: () => {
            const tools = transformerTools(stringMonoid)
            const entry = tools.entry(1, tools.unit)
            return tools.map(entry, entry)
        },
        factory: () => {
            const a = transformerTools(stringMonoid)
            const b = transformerTools(stringMonoid)
            return a.map(b.entry(1, b.unit))
        },
    },
}
