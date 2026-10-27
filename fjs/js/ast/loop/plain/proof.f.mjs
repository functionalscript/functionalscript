/**
 * Plain source-loop planning keeps condition-only work in its reached test and
 * duplicates only identity-free projection dependencies in other regions.
 *
 * @import { BindingId, Block, Definition, Loop, Value } from '../../types.ts'
 */

import { assertEq, assertStructurallySame } from '../../../../asserts/module.f.js'
import { plainLoopOf } from './module.f.mjs'

const state = /** @type {const} */ ({ index: 0 })
const result = /** @type {const} */ ({ index: 1 })
const alias = /** @type {const} */ ({ index: 2 })
const other = /** @type {const} */ ({ index: 3 })
const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
/** @type {Block} */
const done = { statements: [], exit: ['break', target, [['ref', state]]] }
/** @type {Block} */
const step = { statements: [], exit: ['continue', target, [1]] }
/** @type {Loop} */
const scalar = {
    target,
    parameters: [state], initial: [0], results: [result],
    body: { statements: [['if', [], true, step, done]], exit: ['continue', target, [['ref', state]]] },
}
/** @type {(step: Block, otherwise: Block) => Loop} */
const withArms = (step, otherwise) => ({ ...scalar, body: { ...scalar.body, statements: [['if', [], true, step, otherwise]] } })

export const proof = /** @type {const} */ ({
    independentCopiesFollowBodyReadOrder: () => {
        /** @type {import('../../types.ts').BindingId} */
        const combined = { index: 4 }
        /** @type {readonly import('../../types.ts').Definition[]} */
        const prefix = [
            ['define', alias, ['.', ['ref', state], 0], 'required'],
            ['define', other, ['.', ['ref', state], 1], 'required'],
        ]
        /** @type {import('../../types.ts').Definition} */
        const sum = ['define', combined, ['+', ['ref', other], ['ref', alias]], 'required']
        /** @type {Block} */
        const step = { statements: [sum], exit: ['continue', target, [['ref', combined]]] }
        /** @type {Loop} */
        const source = { ...scalar, body: { ...scalar.body, statements: [...prefix, ['if', [], true, step, done]] } }
        const plan = plainLoopOf(source)
        assertStructurallySame(plan?.prefix, prefix)
        assertStructurallySame(plan?.iteration.step.statements, [prefix[1], prefix[0], sum])
    },
    schedulesCopiedDependenciesAtTheirFirstStepUse: () => {
        /** @type {BindingId} */
        const dependent = { index: 4 }
        /** @type {BindingId} */
        const local = { index: 5 }
        /** @type {BindingId} */
        const selected = { index: 6 }
        /** @type {BindingId} */
        const updated = { index: 7 }
        /** @type {readonly Definition[]} */
        const prefix = [
            ['define', alias, ['.', ['ref', state], 0], 'required'],
            ['define', other, ['.', ['ref', state], 1], 'required'],
            ['define', dependent, ['ref', alias], 'required'],
        ]
        /** @type {readonly Definition[]} */
        const statements = [
            ['define', local, 1, 'required'],
            ['define', selected, ['if', true, { statements: [], exit: ['yield', [['ref', dependent]]] }, { statements: [], exit: ['yield', [0]] }], 'required'],
            ['define', updated, ['+', ['ref', other], ['ref', selected]], 'required'],
        ]
        /** @type {Block} */
        const next = { statements, exit: ['continue', target, [['ref', updated]]] }
        /** @type {Loop} */
        const source = { ...scalar, body: { ...scalar.body, statements: [...prefix, ['if', [], true, next, done]] } }
        const plan = plainLoopOf(source)
        assertStructurallySame(plan?.prefix, prefix)
        assertStructurallySame(plan?.iteration.step.statements, [statements[0], prefix[0], prefix[2], statements[1], prefix[1], statements[2]])
        assertStructurallySame(plan?.iteration.step.exit, next.exit)
    },
    keepsConditionOnlyAllocationsAndTransitiveCopyDependencies: () => {
        const projected = /** @type {const} */ ({ index: 4 })
        const prefix = /** @type {Block['statements']} */ ([
            ['define', other, ['array', [['ref', state]]], 'required'],
            ['define', alias, ['ref', other], 'required'],
            ['define', projected, ['.', ['ref', state], 0], 'required'],
        ])
        const next = /** @type {Block} */ ({ statements: [], exit: ['continue', target, [['array', [['ref', projected]]]]] })
        const normal = /** @type {Block} */ ({ statements: [], exit: ['break', target, [['ref', projected]]] })
        const source = /** @type {Loop} */ ({ ...scalar, body: { ...scalar.body, statements: [...prefix, ['if', [], ['===', ['ref', other], ['ref', alias]], next, normal]] } })
        assertStructurallySame(plainLoopOf(source)?.iteration.step.statements, [prefix[2]])
        assertStructurallySame(plainLoopOf(source)?.resultPrefix, [prefix[2]])
        assertEq(plainLoopOf(source)?.prefix[0], prefix[0])
        // An alias is safe to copy only if every prefix input it needs is safe.
        assertEq(plainLoopOf({ ...source, body: { ...source.body, statements: [...prefix, ['if', [], true, { ...next, exit: ['continue', target, [['ref', alias]]] }, normal]] } }), null)
        const pure = /** @type {Block['statements']} */ ([
            ['define', other, ['.', ['ref', state], 0], 'required'],
            ['define', alias, ['ref', other], 'required'],
        ])
        const copied = /** @type {Loop} */ ({ ...scalar, body: { ...scalar.body, statements: [...pure, ['if', [], true, step, { ...done, exit: ['break', target, [['ref', alias]]] }]] } })
        assertStructurallySame(plainLoopOf(copied)?.resultPrefix, pure)
    },
    plainShape: () => {
        const prefix = /** @type {Block['statements']} */ ([
            ['define', alias, ['.', ['ref', state], 0], 'required'],
        ])
        const normal = /** @type {Block} */ ({ statements: [], exit: ['break', target, [['array', [['ref', alias]]]]] })
        const source = /** @type {Loop} */ ({ ...scalar, body: { ...scalar.body, statements: [...prefix, ['if', [], true, step, normal]] } })
        assertStructurallySame(plainLoopOf(source), { prefix, resultPrefix: prefix, iteration: { condition: true, step, next: 1 }, result: ['array', [['ref', alias]]] })
        assertStructurallySame(plainLoopOf(scalar), { prefix: [], resultPrefix: [], iteration: { condition: true, step, next: 1 }, result: ['ref', state] })
        for (const value of /** @type {readonly Value[]} */ ([1, ['ref', state], ['.', ['.', ['ref', state], 0], 1]])) {
            assertEq(plainLoopOf({ ...source, body: { ...source.body, statements: [['define', alias, value, 'required'], ...source.body.statements.slice(1)] } })?.prefix[0][2], value)
        }
        /** @type {Value} */
        let value = ['ref', state]
        for (let depth = 0; depth < 20_000; ++depth) { value = ['.', value, 0] }
        assertEq(plainLoopOf({ ...source, body: { ...source.body, statements: [['define', alias, value, 'required'], ...source.body.statements.slice(1)] } })?.prefix[0][2], value)
    },
    refusesIdentityMintingPrefixes: () => {
        for (const value of /** @type {readonly Value[]} */ ([
            ['array', []], ['()', ['ref', other], []], ['.', ['ref', state], 'slice'],
            ['.', ['ref', state], ['Number', 0]], ['.', ['ref', state], 0, ['|()', []]],
        ])) {
            assertEq(plainLoopOf({ ...scalar, body: { ...scalar.body, statements: [['define', alias, value, 'required'], ['if', [], true, step, { statements: [], exit: ['break', target, [['ref', alias]]] }]] } }), null)
        }
        assertEq(plainLoopOf({ ...scalar, body: { ...scalar.body, statements: [['define', alias, 1, 'lazy'], ...scalar.body.statements] } }), null)
        assertEq(plainLoopOf({ ...scalar, body: { ...scalar.body, statements: [['block', [], { statements: [], exit: ['yield', []] }], ...scalar.body.statements] } }), null)
    },
    refusesOtherPlainShapes: () => {
        for (const source of /** @type {readonly Loop[]} */ ([
            { ...scalar, parameters: [], initial: [] }, { ...scalar, results: [] },
            { ...scalar, body: { statements: [], exit: ['yield', []] } },
            { ...scalar, body: { statements: [['define', alias, 0, 'required']], exit: ['yield', []] } },
            { ...scalar, body: { ...scalar.body, statements: [['if', [alias], true, step, done]] } },
            withArms({ ...step, exit: ['yield', []] }, done),
            withArms({ ...step, exit: ['continue', { kind: 'loop', index: 0 }, [1]] }, done),
            withArms(step, { ...done, exit: ['yield', []] }),
            withArms(step, { ...done, exit: ['break', { kind: 'loop', index: 0 }, [1]] }),
            withArms(step, { ...done, statements: [['define', alias, 0, 'required']] }),
            withArms({ ...step, statements: [['block', [], { statements: [], exit: ['yield', []] }]] }, done),
        ])) { assertEq(plainLoopOf(source), null) }
    },
})
