/** @import { Block, Function as FastFunction, Value } from '../../types.ts' */

import { assert, assertEq, assertStructurallySame } from '../../../../asserts/module.f.js'
import { _tailRegion } from './module.f.js'

const binding = /** @type {const} */ ({ index: 0 })

export const proof = {
    returnedBlocksKeepTheirExistingRegion: () => {
        /** @type {Block} */
        const block = { statements: [], exit: ['yield', [7]] }
        const region = _tailRegion(['block', block])
        assert(region.kind === 'block')
        assertEq(region.block, block)
    },
    resultConditionalsKeepTheirTestAndArms: () => {
        /** @type {Value} */
        const test = ['ref', binding]
        /** @type {Block} */
        const then = { statements: [], exit: ['yield', [1]] }
        /** @type {Block} */
        const otherwise = { statements: [], exit: ['throw', 7] }
        const region = _tailRegion(['if', test, then, otherwise])
        assert(region.kind === 'if')
        assertEq(region.test, test)
        assertEq(region.then, then)
        assertEq(region.otherwise, otherwise)
    },
    conditionalValuesBecomeIndependentSingleResultRegions: () => {
        /** @type {Value} */
        const test = ['ref', binding]
        /** @type {Value} */
        const shared = ['array', []]
        const region = _tailRegion(['?:', test, shared, shared])
        assert(region.kind === 'if')
        assertEq(region.test, test)
        assert(region.then !== region.otherwise)
        assertEq(region.then.statements.length, 0)
        assertEq(region.otherwise.statements.length, 0)
        assert(region.then.exit[0] === 'yield' && region.otherwise.exit[0] === 'yield')
        assertEq(region.then.exit[1].length, 1)
        assertEq(region.otherwise.exit[1].length, 1)
        assertEq(region.then.exit[1][0], shared)
        assertEq(region.otherwise.exit[1][0], shared)
    },
    commaPrefixesKeepRequiredOrderAndFreshIdentities: () => {
        /** @type {Value} */
        const first = ['array', []]
        /** @type {Value} */
        const second = ['()', ['ref', binding], []]
        /** @type {Value} */
        const last = ['ref', binding]
        /** @type {Value} */
        const source = [',', [first, second, last]]
        const region = _tailRegion(source, 7)
        assert(region.kind === 'block')
        assertEq(region.block.statements.length, 2)
        const [before, after] = region.block.statements
        assert(before[0] === 'define' && after[0] === 'define')
        assertEq(before[3], 'required')
        assertEq(after[3], 'required')
        assertEq(before[2], first)
        assertEq(after[2], second)
        assertEq(before[1].index, 7)
        assertEq(after[1].index, 7)
        assert(before[1] !== after[1])
        assert(region.block.exit[0] === 'yield')
        assertEq(region.block.exit[1].length, 1)
        assertEq(region.block.exit[1][0], last)
        const next = _tailRegion(source)
        assert(next.kind === 'block')
        const definition = next.block.statements[0]
        assert(definition[0] === 'define')
        assertEq(definition[1].index, 0)
        assert(definition[1] !== before[1])
        const singleton = _tailRegion([',', [last]])
        assert(singleton.kind === 'block')
        assertStructurallySame(singleton.block.statements, [])
        assert(singleton.block.exit[0] === 'yield')
        assertEq(singleton.block.exit[1][0], last)
    },
    baseValuesAndOrdinaryFunctionsStayOpaque: () => {
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        /** @type {FastFunction} */
        const fn = { target: owner, parameters: [], rest: null, self: null,
            captures: [], body: { statements: [], exit: ['return', owner, 7] } }
        /** @type {readonly Value[]} */
        const values = [undefined, null, true, 1, 1n, 'value', [',', []], ['+', 1, 2], ['ref', binding], ['function', fn]]
        for (const value of values) {
            const region = _tailRegion(value)
            assert(region.kind === 'value')
            assertEq(region.value, value)
        }
    },
}
