/** Terminal loop exits retain their transfer owner without a result or suffix.
 * @import { BindingId, Block as NormalBlock, Function as NormalFunction, Loop } from '../types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { prepare, prepareFunction } from './module.f.mjs'

/** @type {(index: number) => BindingId} */
const id = index => ({ index })

export const proof = /** @type {const} */ ({
    emptyTerminalLoopsRemainStructuralExits: () => {
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        /** @type {Loop} */
        const loop = { target, parameters: [], initial: [], results: [], body: { statements: [], exit: ['continue', target, []] } }
        /** @type {NormalBlock} */
        const source = { statements: [], exit: ['loop', loop] }
        for (const sourceLoops of [false, true]) {
            const prepared = prepare(source, { sourceLoops })
            assertStructurallySame(prepared.statements, [])
            assert(prepared.exit[0] === 'loop')
            assertEq(prepared.exit[1], target)
            assertStructurallySame(prepared.exit[2].statements, [])
            assertStructurallySame(prepared.exit[2].exit, ['continue', target])
        }
    },
    terminalStateWritesMarkTheirPrefixSlotsMutable: () => {
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const state = id(0)
        /** @type {Loop} */
        const loop = { target, parameters: [state], initial: [0], results: [], body: {
            statements: [], exit: ['continue', target, [['+', ['ref', state], 1]]],
        } }
        for (const sourceLoops of [false, true]) {
            const prepared = prepare({ statements: [], exit: ['loop', loop] }, { sourceLoops })
            const slot = prepared.statements.find(statement => statement[0] === 'slot')
            assert(slot !== undefined && slot[0] === 'slot')
            assertEq(slot[3], true)
            assert(prepared.exit[0] === 'loop')
            assertEq(prepared.exit[1], target)
            assert(prepared.exit[2].statements.some(statement => statement[0] === 'write' && statement[1] === slot[1]))
            assertStructurallySame(prepared.exit[2].exit, ['continue', target])
        }
    },
    terminalLoopReturnKeepsItsOrdinaryFunctionOwner: () => {
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const input = id(0), state = id(1), required = id(2)
        /** @type {NormalFunction} */
        const fn = { target: owner, parameters: [input], rest: null, self: null, captures: [], body: {
            statements: [['define', required, ['.', null, 'prefix'], 'required']],
            exit: ['loop', { target, parameters: [state], initial: [['ref', input]], results: [], body: {
                statements: [['if', [], ['<=', ['ref', state], 0],
                    { statements: [], exit: ['return', owner, ['ref', state]] },
                    { statements: [], exit: ['yield', []] }]],
                exit: ['continue', target, [['-', ['ref', state], 1]]],
            } }],
        } }
        const prepared = prepareFunction(fn)
        assert(prepared.body.statements.some(statement => statement[0] === 'define' && statement[1] === required))
        assert(prepared.body.exit[0] === 'loop')
        const branch = prepared.body.exit[2].statements.find(statement => statement[0] === 'if')
        assert(branch !== undefined && branch[0] === 'if')
        assert(branch[2].exit[0] === 'return')
        assertEq(branch[2].exit[1], owner)
    },
})
