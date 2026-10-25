/**
 * Return lifting owns only direct plain value continuations.
 * @import { BindingId, Block, Exit, Loop, Statement, Value } from '../../../js/ast/types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { liftReturns } from './module.f.mjs'

const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
const other = /** @type {const} */ ({ kind: 'function', index: 0 })
/** @type {() => BindingId} */
const id = () => ({ index: 0 })
/** @type {(binding: BindingId) => Value} */
const ref = binding => ['ref', binding]
/** @type {(exit: Exit, statements?: readonly Statement[]) => Block} */
const body = (exit, statements = []) => ({ statements, exit })
/** @type {(value: Value) => Block} */
const returned = value => body(['return', owner, value])
/** @type {(values: readonly Value[], statements?: readonly Statement[]) => Block} */
const yielded = (values, statements = []) => body(['yield', values], statements)

export const proof = /** @type {const} */ ({
    unchanged: () => {
        const value = id()
        const ordinary = /** @type {readonly Value[]} */ ([
            1, ref(value), ['array', [['block', returned(2)]]],
            ['block', yielded([])], ['block', yielded([3])], ['block', yielded([3, 4])],
            ['block', body(['throw', 7])],
            ['if', true, yielded([3]), body(['throw', 7])], ['?:', true, 1, 2],
            ['function', { target: owner, parameters: [], rest: null, self: null, captures: [], body: returned(['block', returned(3)]) }],
        ])
        for (const source of ordinary) {
            const block = returned(ref(value))
            const definition = /** @type {Block} */ ({ ...block, statements: [['define', value, source, 'required']] })
            assertEq(liftReturns(definition, owner), definition)
            const result = returned(source)
            assertEq(liftReturns(result, owner), result)
        }
        const lazy = body(['return', owner, 1], [['define', value, ['block', returned(2)], 'lazy']])
        assertEq(liftReturns(lazy, owner), lazy)
        const statementYield = yielded([['block', returned(3)]])
        assertEq(liftReturns(statementYield, owner), statementYield)
    },
    requiredBlock: () => {
        const value = id(), selected = id(), before = id(), after = id()
        const initializer = yielded([7], [
            ['define', before, 4, 'required'],
            ['if', [], ref(selected), returned(9), yielded([])],
        ])
        const suffix = /** @type {Statement} */ (['define', after, ref(value), 'required'])
        const source = body(['return', owner, ref(after)], [['define', value, ['block', initializer], 'required'], suffix])
        const result = liftReturns(source, owner)
        assert(result !== source)
        assertEq(liftReturns(result, owner), result)
        assertEq(result.statements.length, 2)
        const region = result.statements[0]
        assert(region[0] === 'block')
        assertEq(region[1][0], value)
        assertEq(region[2].statements[0], initializer.statements[0])
        assertStructurallySame(region[2].exit, ['yield', [7]])
        assertEq(result.statements[1], suffix)
        assertEq(result.exit, source.exit)
        assertEq(source.statements[0][0], 'define')
    },
    conditionalResults: () => {
        const value = id(), condition = id()
        for (const values of /** @type {readonly (readonly Value[])[]} */ ([[], [3], [3, 4, 5]])) {
            const source = returned(ref(value))
            const block = /** @type {Block} */ ({ ...source, statements: [
                ['define', value, ['if', ref(condition), returned(9), yielded(values)], 'required'],
            ] })
            const result = liftReturns(block, owner)
            const conditional = result.statements[0]
            assert(conditional[0] === 'if')
            assertEq(conditional[1][0], value)
            assertStructurallySame(conditional[2], ref(condition))
            assertStructurallySame(conditional[3].exit, ['return', owner, 9])
            assertStructurallySame(conditional[4].exit, ['yield', [values.length === 1 ? values[0] : ['array', values]]])
            assertEq(liftReturns(result, owner), result)
        }
        const expression = /** @type {Value} */ (['?:', ref(condition), ['block', returned(8)], 7])
        const ternary = liftReturns(body(['return', owner, ref(value)], [['define', value, expression, 'required']]), owner)
        const conditional = ternary.statements[0]
        assert(conditional[0] === 'if')
        assertStructurallySame(conditional[2], ref(condition))
        assertEq(conditional[3].statements.length, 1)
        assertStructurallySame(conditional[4].exit, ['yield', [7]])
    },
    returnAndYieldChains: () => {
        const condition = id()
        const source = returned(['block', yielded([['?:', ref(condition), ['block', returned(8)], 7]])])
        const result = liftReturns(source, owner)
        const region = result.statements[0]
        assert(region[0] === 'block')
        assert(region[2].statements[0][0] === 'if')
        assert(result.exit[0] === 'return')
        const value = result.exit[2]
        assert(value instanceof Array && value[0] === 'ref')
        assertEq(value[1], region[1][0])
        assertEq(liftReturns(result, owner), result)
        const both = returned(['if', ref(condition), returned(1), returned(2)])
        const terminal = liftReturns(both, owner)
        assertEq(terminal.statements.length, 1)
        assertStructurallySame(terminal.exit, ['yield', []])
    },
    opaqueTestsAndMultipleYields: () => {
        const value = id()
        const guard = /** @type {Value} */ (['block', returned(3)])
        const source = returned(['if', guard, returned(1), yielded([2])])
        const result = liftReturns(source, owner)
        const conditional = result.statements[0]
        assert(conditional[0] === 'if')
        assertEq(conditional[2], guard)
        const multi = yielded([guard, 7], [['if', [], true, returned(8), yielded([])]])
        const packed = liftReturns(body(['return', owner, ref(value)], [['define', value, ['block', multi], 'required']]), owner)
        const region = packed.statements[0]
        assert(region[0] === 'block' && region[2].exit[0] === 'yield')
        const array = region[2].exit[1][0]
        assert(array instanceof Array && array[0] === 'array')
        assertEq(array[1][0], guard)
        const opaque = returned(['block', yielded([guard, 7])])
        assertEq(liftReturns(opaque, owner), opaque)
    },
    terminalPrefix: () => {
        const value = id(), dead = id()
        const source = body(['return', owner, ref(value)], [
            ['define', value, ['block', yielded([ref(dead)], [
                ['block', [], returned(8)], ['define', dead, ['block', body(['return', other, 3])], 'required'],
            ])], 'required'], ['define', dead, 4, 'required'],
        ])
        const result = liftReturns(source, owner)
        assertEq(result.statements.length, 1)
        const region = result.statements[0]
        assert(region[0] === 'block')
        assertEq(region[2].statements.length, 1)
        assertStructurallySame(region[2].exit, ['yield', []])
        assertStructurallySame(result.exit, ['yield', []])
        assertEq(source.statements.length, 2)
        const thrown = returned(['block', yielded([], [
            ['block', [], body(['throw', 'stop'])], ['define', dead, ['block', body(['return', other, 3])], 'required'],
        ])])
        assertEq(liftReturns(thrown, owner), thrown)
    },
    statementRegionsAndLocalLoops: () => {
        const value = id()
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = /** @type {Loop} */ ({
            target: innerTarget, parameters: [], initial: [], results: [], body: body(['continue', outerTarget, []]),
        })
        const outer = /** @type {Loop} */ ({
            target: outerTarget, parameters: [], initial: [], results: [],
            body: body(['break', outerTarget, []], [
                ['if', [], false, returned(9), yielded([], [['loop', inner]])],
            ]),
        })
        const source = body(['return', owner, ref(value)], [['define', value, ['block', yielded([7], [['loop', outer]])], 'required']])
        const result = liftReturns(source, owner)
        const region = result.statements[0]
        assert(region[0] === 'block')
        const loop = region[2].statements[0]
        assert(loop[0] === 'loop')
        assertEq(loop[1].target, outer.target)
        assertEq(loop[1].parameters, outer.parameters)
        assertEq(loop[1].results, outer.results)
        assertEq(loop[1].initial, outer.initial)
        const rhs = /** @type {Statement} */ (['define', value, ['block', returned(1)], 'required'])
        const nested = body(['return', owner, 3], [
            ['block', [], yielded([], [['if', [], false, yielded([], [rhs]), yielded([])]])],
            ['loop', { ...outer, body: body(['break', outerTarget, []], [rhs]) }],
        ])
        const exposed = liftReturns(nested, owner)
        assert(exposed !== nested)
        assertEq(liftReturns(exposed, owner), exposed)
    },
    deepValueChain: () => {
        /** @type {Value} */
        let value = ['block', returned(7)]
        for (let depth = 0; depth < 20_000; ++depth) { value = ['block', yielded([value])] }
        const result = liftReturns(returned(value), owner)
        let current = result
        for (let depth = 0; depth < 20_001; ++depth) {
            assertEq(current.statements.length, 1)
            const region = current.statements[0]
            assert(region[0] === 'block')
            current = region[2]
        }
        assertStructurallySame(current.exit, ['return', owner, 7])
    },
    throw: {
        foreignReturn: () => liftReturns(returned(['block', body(['return', other, 3])]), owner),
        foreignConditionalReturn: () => liftReturns(returned(['if', true, body(['return', other, 3]), yielded([7])]), owner),
        enclosingLoopEscape: () => {
            const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const value = id()
            return liftReturns(body(['return', owner, 7], [
                ['loop', { target, parameters: [], initial: [], results: [], body: body(['break', target, []], [
                    ['define', value, ['block', body(['continue', target, []])], 'required'],
                ]) }],
            ]), owner)
        },
        nestedValueLoopEscape: () => {
            const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const value = id()
            return liftReturns(returned(['block', yielded([7], [
                ['loop', { target, parameters: [], initial: [], results: [], body: body(['break', target, []], [
                    ['define', value, ['block', body(['break', target, []])], 'required'],
                ]) }],
            ])]), owner)
        },
        siblingLoopEscape: () => {
            const first = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const second = /** @type {const} */ ({ kind: 'loop', index: 0 })
            return liftReturns(returned(['block', yielded([7], [
                ['loop', { target: first, parameters: [], initial: [], results: [], body: body(['break', first, []]) }],
                ['loop', { target: second, parameters: [], initial: [], results: [], body: body(['continue', first, []]) }],
            ])]), owner)
        },
    },
})
