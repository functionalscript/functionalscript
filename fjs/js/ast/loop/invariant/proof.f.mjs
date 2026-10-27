/**
 * Only established forwarded slots leave the explicit plain-loop signature.
 * Targets and source identities are resolved objects, independently of indices.
 *
 * @import { Block, Loop, Value } from '../../types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../../asserts/module.f.js'
import { invariantState } from './module.f.mjs'

const stable = /** @type {const} */ ({ index: 0 })
const changing = /** @type {const} */ ({ index: 0 })
const first = /** @type {const} */ ({ index: 0 })
const second = /** @type {const} */ ({ index: 0 })
const entry = /** @type {const} */ ({ index: 0 })
const local = /** @type {const} */ ({ index: 0 })
const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
const other = /** @type {const} */ ({ kind: 'loop', index: 0 })
const step = /** @type {Block} */ ({ statements: [], exit: ['continue', target, [['ref', stable], ['+', ['ref', changing], 1]]] })
const done = /** @type {Block} */ ({ statements: [], exit: ['break', target, [['ref', stable], ['ref', changing]]] })

/** @type {(next?: Block, otherwise?: Block, condition?: Value) => Loop} */
const loop = (next = step, otherwise = done, condition = ['<', ['ref', changing], ['ref', stable]]) => ({
    target, parameters: [stable, changing], initial: [['ref', entry], 0], results: [first, second],
    body: { statements: [['if', [], condition, next, otherwise]], exit: ['continue', target, [['ref', stable], ['ref', changing]]] },
})

export const proof = /** @type {const} */ ({
    scalarCompatibility: () => {
        const original = loop()
        const normalized = invariantState(original)
        assertEq(original.parameters.length, 2)
        assertEq(normalized.loop.parameters[0], changing)
        assertEq(normalized.loop.results[0], second)
        assertEq(normalized.aliases[0].parameter, stable)
        assertEq(normalized.aliases[0].result, first)
        assertEq(normalized.aliases[0].value, original.initial[0])
        assertStructurallySame(normalized.loop.body.exit, ['continue', target, [['ref', changing]]])
        const statement = normalized.loop.body.statements[0]
        assert(statement[0] === 'if')
        assertEq(statement[2], original.body.statements[0][2])
        assertStructurallySame(statement[3].exit, ['continue', target, [['+', ['ref', changing], 1]]])
        assertStructurallySame(statement[4].exit, ['break', target, [['ref', changing]]])
        assertEq(invariantState(normalized.loop).loop, normalized.loop)
        const yielding = /** @type {Loop} */ ({ ...original, body: { ...original.body, exit: ['yield', []] } })
        assertEq(invariantState(yielding).loop.body.exit, yielding.body.exit)
        const allStable = loop({ ...step, exit: ['continue', target, [['ref', stable], ['ref', changing]]] })
        assertEq(invariantState(allStable).loop.parameters[0], stable)
        assertEq(invariantState({ ...original, initial: [7, 0] }).aliases[0].value, 7)
        const definition = /** @type {const} */ (['define', local, ['array', [['ref', stable]]], 'required'])
        const withDefinition = invariantState(loop({ ...step, statements: [definition] })).loop.body.statements[0]
        assert(withDefinition[0] === 'if')
        assertEq(withDefinition[3].statements[0], definition)
    },
    preservesIndependentSignaturesAndEntryWork: () => {
        const original = loop()
        for (const source of /** @type {readonly Loop[]} */ ([
            { ...original, results: [first] },
            { ...original, body: { statements: [], exit: original.body.exit } },
            { ...original, initial: [['array', []], 0] },
            { ...original, initial: [['ref', entry], ['.', null, 'x']] },
            { ...original, body: { statements: [['define', local, 1, 'required']], exit: original.body.exit } },
            { ...original, body: { statements: [['if', [local], true, step, done]], exit: original.body.exit } },
            loop({ ...step, exit: ['continue', target, [1, 2]] }),
        ])) { assertEq(invariantState(source).loop, source) }
        assertEq(invariantState(original, [entry]).loop, original)
    },
    refusesOtherTransferShapes: () => {
        for (const source of /** @type {readonly Loop[]} */ ([
            loop({ ...step, exit: ['yield', []] }),
            loop({ ...step, exit: ['continue', other, [1, 2]] }),
            loop(step, { ...done, exit: ['yield', []] }),
            loop(step, { ...done, exit: ['break', other, [1, 2]] }),
            loop(step, { ...done, statements: [['define', local, 1, 'required']] }),
            loop({ ...step, statements: [['block', [], { statements: [], exit: ['yield', []] }]] }),
            loop(step, { ...done, exit: ['break', target, [1, ['ref', changing]]] }),
            loop(step, done, ['block', { statements: [], exit: ['continue', target, [1, 2]] }]),
        ])) { assertEq(invariantState(source).loop, source) }
        const outward = /** @type {Value} */ (['block', { statements: [], exit: ['break', other, [['ref', stable]]] }])
        const source = loop(step, done, outward)
        const statement = invariantState(source).loop.body.statements[0]
        assert(statement[0] === 'if')
        assertEq(statement[2], outward)
    },
})
