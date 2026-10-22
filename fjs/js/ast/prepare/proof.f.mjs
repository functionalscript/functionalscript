/**
 * Preparation fixes physical lifetimes and transfers before either renderer.
 * These fixtures inspect that plan directly, including simultaneous updates
 * and returns which must remain outside expression wrappers.
 *
 * @import { BindingId, Block as NormalBlock, Definition, Function as NormalFunction, Loop, LoopTarget, Value as NormalValue } from '../types.ts'
 * @import { Block, Statement, Value } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { prepare, prepareFunction } from './module.f.mjs'

/** @type {(index: number) => BindingId} */
const id = index => ({ index })

/** @type {(value: NormalValue) => NormalBlock} */
const yielding = value => ({ statements: [], exit: ['yield', [value]] })

/** @type {(target: LoopTarget, parameter: BindingId, result: BindingId, next: NormalValue, statements?: readonly Definition[]) => Loop} */
const scalar = (target, parameter, result, next, statements = []) => ({
    target,
    parameters: [parameter],
    initial: [0],
    results: [result],
    body: {
        statements: [['if', [], ['<', ['ref', parameter], 3],
            { statements, exit: ['continue', target, [next]] },
            { statements: [], exit: ['break', target, [['ref', parameter]]] },
        ]],
        exit: ['continue', target, [['ref', parameter]]],
    },
})

/** The first physical loop statement in a plan. @type {(block: Block) => Extract<Statement, readonly ['loop', unknown, unknown]>} */
const loopStatement = block => /** @type {Extract<Statement, readonly ['loop', unknown, unknown]>} */ (block.statements.find(statement => statement[0] === 'loop'))

export const proof = {
    deepSyntax: () => {
        for (const tag of /** @type {const} */ (['!', '+', '.'])) {
            /** @type {NormalValue} */
            let input = 3
            for (let depth = 0; depth < 20_000; ++depth) {
                input = tag === '!' ? ['!', input] : tag === '+' ? ['+', input, 1] : ['.', input, 'x']
            }
            const block = prepare(yielding(input))
            assert(block.exit[0] === 'yield')
            let value = block.exit[1][0]
            let depth = 0
            while (value instanceof Array && value[0] === tag) { value = value[1]; ++depth }
            assertEq(depth, 20_000)
            assertEq(value, 3)
        }
        /** @type {NormalValue} */
        let input = 3
        for (let depth = 0; depth < 20_000; ++depth) {
            input = ['block', { statements: [['define', id(depth), depth, 'required']], exit: ['yield', [input]] }]
        }
        const block = prepare(yielding(input))
        assert(block.exit[0] === 'yield')
        /** @type {Value} */
        let value = block.exit[1][0]
        let depth = 0
        while (value instanceof Array && value[0] === 'block') {
            assertEq(value[1].statements.length, 1)
            const statement = value[1].statements[0]
            assert(statement[0] === 'define')
            assertEq(statement[2], 19_999 - depth)
            const exit = value[1].exit
            assert(exit[0] === 'yield')
            value = exit[1][0]
            ++depth
        }
        assertEq(depth, 20_000)
        assertEq(value, 3)
    },
    values: () => {
        assertStructurallySame(prepare(yielding(4)), yielding(4))
        const binding = id(0)
        const block = prepare({ statements: [['define', binding, ['+', 2, 3], 'required']], exit: ['yield', [['ref', binding]]] })
        assertStructurallySame(block, { statements: [['define', binding, ['+', 2, 3]]], exit: ['yield', [['ref', binding]]] })
        assertStructurallySame(prepare(yielding(['block', yielding(3)])), yielding(['block', yielding(3)]))
        assertStructurallySame(prepare(yielding(['if', true, yielding(1), yielding(2)])), yielding(['if', true, yielding(1), yielding(2)]))
        assertStructurallySame(prepare(yielding(['?:', false, 1, 2])), yielding(['if', false, yielding(1), yielding(2)]))
        assertStructurallySame(prepare({ statements: [], exit: ['throw', 9] }), { statements: [], exit: ['throw', 9] })
    },
    memoLifetime: () => {
        const a = id(0)
        const b = id(1)
        const capture = id(2)
        const nested = id(3)
        const parameter = id(4)
        const rest = id(5)
        const self = id(6)
        const target = { kind: /** @type {const} */ ('function'), index: 0 }
        /** @type {NormalFunction} */
        const fn = {
            target,
            parameters: [parameter], rest, self,
            captures: [{ binding: capture, value: ['ref', b] }],
            body: { statements: [['define', nested, ['array', [['ref', capture]]], 'lazy']], exit: ['return', target, ['ref', nested]] },
        }
        const result = prepare({
            statements: [['define', a, 1, 'required'], ['define', b, ['+', ['ref', a], 2], 'lazy']],
            exit: ['yield', [['function', fn]]],
        })
        const memo = result.statements[1]
        assert(memo[0] === 'memo')
        assertEq(memo[1].binding, b)
        assertStructurallySame(memo[1].initializer, yielding(['+', ['ref', a], 2]))
        const value = result.exit
        assert(value[0] === 'yield')
        const functionValue = value[1][0]
        assert(functionValue instanceof Array && functionValue[0] === 'function')
        assertStructurallySame(functionValue[1].captures, [{ binding: capture, value: ['demand', b] }])
        assertEq(functionValue[1].body.statements[0][0], 'memo')
        assertStructurallySame(functionValue[1].body.exit, ['return', target, ['demand', nested]])
        assertEq(functionValue[1].parameters[0], parameter)
        assertEq(functionValue[1].rest, rest)
        assertEq(functionValue[1].self, self)
        assertEq(memo[1].valueSlot.index, 7)
        assertEq(memo[1].doneSlot.index, 8)
        const direct = prepareFunction({ target, parameters: [], rest: null, self: null, captures: [], body: yielding(undefined) })
        assertStructurallySame(direct.body, yielding(undefined))
    },
    resultSlots: () => {
        const first = id(0)
        const second = id(1)
        const last = id(2)
        const result = prepare({
            statements: [
                ['block', [first, second], { statements: [], exit: ['yield', [2, 3]] }],
                ['if', [last], true, yielding(['ref', first]), yielding(['ref', second])],
            ],
            exit: ['yield', [['ref', last]]],
        })
        assertStructurallySame(result.statements.map(statement => statement[0]), ['slot', 'slot', 'block', 'define', 'define', 'slot', 'if', 'define'])
        const child = result.statements[2]
        assert(child[0] === 'block')
        assertStructurallySame(child[1].statements.map(statement => statement[0]), ['define', 'define', 'write', 'write'])
        assertStructurallySame(child[1].exit, ['yield', []])
        const conditional = result.statements[6]
        assert(conditional[0] === 'if')
        assertStructurallySame(conditional[2].statements.map(statement => statement[0]), ['define', 'write'])
        assertStructurallySame(conditional[3].statements.map(statement => statement[0]), ['define', 'write'])
    },
    parallelLoop: () => {
        const a = id(0)
        const b = id(1)
        const result = id(2)
        const functionTarget = { kind: /** @type {const} */ ('function'), index: 0 }
        const target = { kind: /** @type {const} */ ('loop'), index: 0 }
        const output = prepare({
            statements: [['loop', {
                target, parameters: [a, b], initial: [1, 2], results: [result],
                body: {
                    statements: [['if', [], ['<', ['ref', a], 3],
                        { statements: [], exit: ['continue', target, [['ref', b], ['+', ['ref', a], ['ref', b]]]] },
                        { statements: [], exit: ['break', target, [['ref', a]]] },
                    ]],
                    exit: ['return', functionTarget, 0],
                },
            }]],
            exit: ['yield', [['ref', result]]],
        })
        const loop = loopStatement(output)
        assertEq(loop[1], target)
        assertStructurallySame(loop[2].statements.slice(0, 2).map(statement => statement[0]), ['define', 'define'])
        const conditional = loop[2].statements[2]
        assert(conditional[0] === 'if')
        const next = conditional[2]
        assertStructurallySame(next.statements.map(statement => statement[0]), ['define', 'define', 'write', 'write'])
        assertStructurallySame(next.exit, ['continue', target])
        assertStructurallySame(conditional[3].exit, ['break', target])
        assertStructurallySame(loop[2].exit, ['return', functionTarget, 0])
        assertEq(loop[2].statements[0][1], a)
        assertEq(loop[2].statements[1][1], b)
    },
    scalarWhile: () => {
        const parameter = id(0)
        const result = id(1)
        const target = { kind: /** @type {const} */ ('loop'), index: 0 }
        const output = prepare({ statements: [['loop', scalar(target, parameter, result, ['+', ['ref', parameter], 1])]], exit: ['yield', [['ref', result]]] })
        const statement = output.statements[0]
        assert(statement[0] === 'while')
        assertEq(statement[1].result, result)
        assertEq(statement[1].mutable, true)
        assertStructurallySame(statement[1].body.statements.map(statement => statement[0]), ['define', 'define', 'write'])
        assertEq(statement[1].body.statements[0][1], parameter)
        const unchanged = prepare({ statements: [['loop', scalar(target, parameter, result, ['ref', parameter])]], exit: ['yield', [['ref', result]]] }).statements[0]
        assert(unchanged[0] === 'while')
        assertEq(unchanged[1].mutable, false)
        assertStructurallySame(unchanged[1].body.statements.map(statement => statement[0]), ['define'])
        const local = id(2)
        const withDefinition = prepare({ statements: [['loop', scalar(target, parameter, result, ['ref', local], [['define', local, ['+', ['ref', parameter], 1], 'required']])]], exit: ['yield', [['ref', result]]] }).statements[0]
        assert(withDefinition[0] === 'while')
        assertStructurallySame(withDefinition[1].body.statements.map(statement => statement[0]), ['define', 'define', 'define', 'write'])
        const input = id(3)
        const prior = id(4)
        const priorTarget = { kind: /** @type {const} */ ('loop'), index: 1 }
        const sequence = prepare({ statements: [
            ['loop', { target: priorTarget, parameters: [input], initial: [1], results: [prior], body: { statements: [], exit: ['break', priorTarget, [['ref', input]]] } }],
            ['loop', scalar(target, parameter, result, ['+', ['ref', parameter], 1])],
        ], exit: ['yield', [['ref', result]]] })
        const slots = sequence.statements.filter(statement => statement[0] === 'slot')
        assertStructurallySame(slots.map(statement => statement[3]), [false, true])
    },
    nonlocalResult: () => {
        const target = { kind: /** @type {const} */ ('function'), index: 0 }
        const binding = id(0)
        /** @type {NormalValue} */
        const abrupt = ['block', { statements: [], exit: ['return', target, 8] }]
        const output = prepare({ statements: [['define', binding, ['+', ['()', ['entry'], []], abrupt], 'required']], exit: ['return', target, ['ref', binding]] })
        assertStructurallySame(output.statements.map(statement => statement[0]), ['define', 'slot', 'block', 'define'])
        const block = output.statements[2]
        assert(block[0] === 'block')
        assertStructurallySame(block[1].exit, ['return', target, 8])
        for (const then of [true, false]) {
            const lazy = prepare(yielding(['if', true, yielding(then ? abrupt : 0), yielding(then ? 0 : abrupt)]))
            assertStructurallySame(lazy.statements.map(statement => statement[0]), ['slot', 'if'])
            const branch = lazy.statements[1]
            assert(branch[0] === 'if')
            const selected = then ? branch[2] : branch[3]
            assertStructurallySame(selected.statements.map(statement => statement[0]), ['slot', 'block', 'define', 'write'])
        }
        const conditional = prepare(yielding(['if', true, { statements: [], exit: ['return', target, 3] }, yielding(4)]))
        assertStructurallySame(conditional.statements.map(statement => statement[0]), ['slot', 'if'])
        const branch = conditional.statements[1]
        assert(branch[0] === 'if')
        assertStructurallySame(branch[2].exit, ['return', target, 3])
        assertStructurallySame(branch[3].statements.map(statement => statement[0]), ['define', 'write'])
    },
    nestedRegions: () => {
        const a = id(0)
        const b = id(1)
        const c = id(2)
        const target = { kind: /** @type {const} */ ('function'), index: 0 }
        const loop = { kind: /** @type {const} */ ('loop'), index: 0 }
        /** @type {NormalFunction} */
        const fn = { target, parameters: [], rest: null, self: null, captures: [{ binding: c, value: 1 }], body: { statements: [], exit: ['return', target, ['ref', c]] } }
        /** @type {NormalBlock} */
        const normal = {
            statements: [
                ['define', c, ['function', fn], 'required'],
                ['block', [], { statements: [], exit: ['yield', []] }],
                ['if', [], false, { statements: [], exit: ['yield', []] }, { statements: [], exit: ['yield', []] }],
                ['loop', { target: loop, parameters: [a], initial: [0], results: [b], body: { statements: [], exit: ['break', loop, [['ref', a]]] } }],
            ],
            exit: ['yield', [['if', true, yielding(1), yielding(2)]]],
        }
        const prepared = prepare(yielding(['block', normal]))
        assertEq(prepared.statements.length, 0)
        assert(prepared.exit[0] === 'yield')
        assertEq(/** @type {readonly ['block', Block]} */ (prepared.exit[1][0])[0], 'block')
        /** @type {NormalBlock} */
        const returning = { statements: [], exit: ['return', target, 3] }
        /** @type {readonly NormalBlock[]} */
        const abrupt = [
            { statements: [['define', a, ['block', returning], 'required']], exit: ['yield', [0]] },
            { statements: [['block', [], returning]], exit: ['yield', [0]] },
            { statements: [['if', [], false, yielding(0), returning]], exit: ['yield', [0]] },
            { statements: [['loop', { target: loop, parameters: [a], initial: [['block', returning]], results: [b], body: { statements: [], exit: ['break', loop, [['ref', a]]] } }]], exit: ['yield', [0]] },
        ]
        for (const block of abrupt) {
            assertEq(prepare(yielding(['block', block])).statements[0][0], 'slot')
        }
        const capture = prepare(yielding(['function', { ...fn, captures: [{ binding: c, value: ['block', returning] }] }]))
        assertStructurallySame(capture.statements.map(statement => statement[0]), ['slot', 'block'])
        const conditional = prepare(yielding(['if', ['block', returning], yielding(1), yielding(2)]))
        assertStructurallySame(conditional.statements.map(statement => statement[0]), ['slot', 'block'])
        const alternative = prepare(yielding(['if', false, yielding(1), returning]))
        assertStructurallySame(alternative.statements.map(statement => statement[0]), ['slot', 'if'])
        const fail = prepare(yielding(['block', { statements: [], exit: ['throw', ['block', yielding(2)]] }]))
        assertEq(fail.statements.length, 0)
    },
    retainedChains: () => {
        /** @type {readonly NormalValue[]} */
        const values = [
            ['if', true, yielding(1), yielding(0)],
            ['if', false, yielding(0), yielding(2)],
            ['if', ['if', ['===', undefined, null], yielding(true), yielding(['===', undefined, undefined])], yielding(3), yielding(undefined)],
            ['?.', null, 'x'], ['?.()', undefined, [1]],
            ['.', ['object', []], 'x'], ['.', ['object', []], 'x', ['|()', []]],
        ]
        for (const value of values) { assertEq(prepare(yielding(value)).statements.length, 0) }
    },
    loopValueTransfers: () => {
        const a = id(0)
        const b = id(1)
        const local = id(2)
        const result = id(3)
        const target = { kind: /** @type {const} */ ('loop'), index: 0 }
        /** @type {NormalBlock} */
        const block = {
            statements: [['loop', {
                target, parameters: [a, b], initial: [0, 1], results: [result],
                body: {
                    statements: [['define', local, ['block', { statements: [], exit: ['continue', target, [['ref', b], ['ref', a]]] }], 'required']],
                    exit: ['break', target, [['ref', a]]],
                },
            }]],
            exit: ['yield', [['ref', result]]],
        }
        const loop = loopStatement(prepare(block))
        assertStructurallySame(loop[2].statements.map(statement => statement[0]), ['define', 'define', 'slot', 'block', 'define', 'define', 'write'])
        const transfer = loop[2].statements[3]
        assert(transfer[0] === 'block')
        assertStructurallySame(transfer[1].exit, ['continue', target])
        const modified = scalar(target, a, result, ['block', { statements: [], exit: ['return', { kind: 'function', index: 0 }, 3] }])
        assertEq(loopStatement(prepare({ statements: [['loop', modified]], exit: ['yield', []] }))[1], target)
        const setup = scalar(target, a, result, ['ref', a], [['define', local, ['block', { statements: [], exit: ['return', { kind: 'function', index: 0 }, 3] }], 'required']])
        assertEq(loopStatement(prepare({ statements: [['loop', setup]], exit: ['yield', []] }))[1], target)
    },
    throw: {
        deferredOptionalKey: () => prepare(yielding(['?.', null, ['Number', ['block', { statements: [], exit: ['return', { kind: 'function', index: 0 }, 3] }]]])),
        deferredOptionalCall: () => prepare(yielding(['?.()', undefined, [['block', { statements: [], exit: ['return', { kind: 'function', index: 0 }, 3] }]]])),
        deferredMemberCall: () => prepare(yielding(['.', ['object', []], 'x', ['|()', [['block', { statements: [], exit: ['return', { kind: 'function', index: 0 }, 3] }]]]])),
        nonlocalLazyDefinition: () => prepare({ statements: [['define', id(0), ['block', { statements: [], exit: ['return', { kind: 'function', index: 0 }, 3] }], 'lazy']], exit: ['yield', [0]] }),
    },
}
