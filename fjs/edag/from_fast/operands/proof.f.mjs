/**
 * Return lifting preserves eager operand order and direct value continuations.
 * @import { BindingId, Block, Exit, Loop, Statement, Value } from '../../../js/ast/types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { binaryTags, unaryTags } from '../../../compiler/ast/module.f.js'
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
/** @type {(statement: Statement) => Block} */
const blockOf = statement => {
    assert(statement[0] === 'block')
    return statement[2]
}

export const proof = /** @type {const} */ ({
    unchanged: () => {
        const value = id()
        const ordinary = /** @type {readonly Value[]} */ ([
            1, ref(value), ['array', []], ['array', [1, ref(value)]], [',', []], [',', [1, ref(value)]],
            ['block', yielded([])], ['block', yielded([3])], ['block', yielded([3, 4])],
            ['block', body(['throw', 7])],
            ['if', true, yielded([3]), body(['throw', 7])], ['?:', true, 1, 2],
            ['+', 1], ['+', 1, 2], ['()', ref(value), []],
            ['instanceof', ['block', returned(3)], 'Array'],
            ['object', []], ['object', [[':', 'x', ref(value)]]],
            ['object', [['...', ['object', []]], [':', 'x', ['block', returned(3)]]]],
            ['object', [[':', ['block', returned(3)], 1], ['...', ['object', []]]]],
            ['array', [['...', ['array', []]], ['block', returned(3)]]],
            ['array', [['...', ['block', returned(3)]]]],
            ['.', ['block', returned(3)], 'x'], ['?.', ['block', returned(3)], 'x'],
            ['?.()', ref(value), [['block', returned(3)]]], ['()', ref(value), [['...', ['block', returned(3)]]]],
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
    multipleYieldOperands: () => {
        const value = id(), earlier = id(), condition = id()
        const selected = /** @type {Value} */ (['block', yielded([3], [['if', [], ref(condition), returned(8), yielded([])]])])
        for (const source of /** @type {readonly Value[]} */ ([
            ['block', yielded([ref(earlier), selected, 7])],
            ['if', true, yielded([ref(earlier), selected, 7]), yielded([])],
        ])) {
            const result = liftReturns(body(['return', owner, ref(value)], [['define', value, source, 'required']]), owner)
            const region = result.statements[0]
            const packed = region[0] === 'block' ? region[2] : /** @type {Extract<Statement, readonly ['if', ...unknown[]]>} */ (region)[3]
            assertEq(packed.statements.length, 1)
            const sequence = blockOf(packed.statements[0])
            assertEq(sequence.statements.length, 3)
            const first = sequence.statements[0], second = sequence.statements[1], third = sequence.statements[2]
            assert(first[0] === 'define' && second[0] === 'block' && third[0] === 'define')
            assertStructurallySame(first[2], ref(earlier))
            assertStructurallySame(sequence.exit, ['yield', [['array', [ref(first[1]), ref(second[1][0]), ref(third[1])]]]])
            assertEq(liftReturns(result, owner), result)
        }
        const first = id(), second = id()
        const guard = /** @type {Value} */ (['block', returned(3)])
        const multi = yielded([guard, 7])
        const statement = /** @type {Statement} */ (['block', [first, second], multi])
        const source = returned(['block', yielded([7], [statement, ['if', [], false, returned(8), yielded([])]])])
        const region = blockOf(liftReturns(source, owner).statements[0])
        assertEq(region.statements[0], statement)
        assertEq(multi.exit[0], 'yield')
        const ordinary = yielded([guard, 7])
        assertEq(liftReturns(ordinary, owner), ordinary)
    },
    arraysAndComma: () => {
        const earlier = id(), condition = id()
        const selected = /** @type {Value} */ (['block', yielded([3], [
            ['define', earlier, 4, 'required'], ['if', [], ref(condition), returned(9), yielded([])],
        ])])
        for (const tag of /** @type {const} */ (['array', ','])) {
            const values = /** @type {readonly Value[]} */ ([ref(earlier), selected])
            const source = returned(tag === 'array' ? ['array', values] : [',', values])
            const result = liftReturns(source, owner)
            const region = blockOf(result.statements[0])
            const first = region.statements[0], second = region.statements[1]
            assert(first[0] === 'define' && second[0] === 'block')
            assertEq(first[3], 'required')
            assertStructurallySame(first[2], ref(earlier))
            assert(first[1] !== earlier)
            assertStructurallySame(region.exit, ['yield', [[tag, [ref(first[1]), ref(second[1][0])]]]])
            assertEq(liftReturns(result, owner), result)
        }
        const terminal = /** @type {Value} */ (['block', returned(7)])
        const foreign = /** @type {Value} */ (['block', body(['return', other, 8])])
        for (const source of /** @type {readonly Value[]} */ ([
            ['array', [1, terminal, foreign]], [',', [1, terminal, foreign]],
            ['block', yielded([1, terminal, foreign])],
        ])) {
            const result = liftReturns(returned(source), owner)
            assertStructurallySame(result.exit, ['yield', []])
            const region = blockOf(result.statements[0])
            assertStructurallySame(region.exit, ['yield', []])
        }
    },
    objectEntries: () => {
        const key = id(), value = id(), condition = id()
        const selected = /** @type {Value} */ (['block', yielded([3], [
            ['define', key, 'shadow', 'required'], ['if', [], ref(condition), returned(9), yielded([])],
        ])])
        const source = returned(['object', [[':', ref(key), selected], [':', '__proto__', ref(value)], [':', ref(key), 5]]])
        const result = liftReturns(source, owner)
        const region = blockOf(result.statements[0])
        assertEq(region.statements.length, 6)
        const first = region.statements[0], second = region.statements[1], third = region.statements[2]
        const fourth = region.statements[3], fifth = region.statements[4], sixth = region.statements[5]
        assert(first[0] === 'define' && second[0] === 'block' && third[0] === 'define')
        assert(fourth[0] === 'define' && fifth[0] === 'define' && sixth[0] === 'define')
        assertEq(first[3], 'required')
        assertStructurallySame(first[2], ['String', ref(key)])
        assertStructurallySame(third[2], ['String', '__proto__'])
        assertStructurallySame(fifth[2], ['String', ref(key)])
        assertStructurallySame(region.exit, ['yield', [['object', [
            [':', ref(first[1]), ref(second[1][0])], [':', ref(third[1]), ref(fourth[1])], [':', ref(fifth[1]), ref(sixth[1])],
        ]]]])
        assertEq(liftReturns(result, owner), result)
        assertEq(source.statements.length, 0)
    },
    objectKeyRegions: () => {
        const key = id(), value = id(), condition = id()
        const selected = /** @type {Value} */ (['block', yielded([ref(key)], [['if', [], ref(condition), returned(9), yielded([])]])])
        const source = returned(['object', [[':', selected, ref(value)]]])
        const result = liftReturns(source, owner)
        const region = blockOf(result.statements[0])
        const converted = region.statements[0], property = region.statements[1]
        assert(converted[0] === 'block' && property[0] === 'define')
        const conversion = converted[2]
        assertEq(conversion.statements.length, 1)
        const raw = conversion.statements[0]
        assert(raw[0] === 'block')
        assertStructurallySame(conversion.exit, ['yield', [['String', ref(raw[1][0])]]])
        assertStructurallySame(region.exit, ['yield', [['object', [[':', ref(converted[1][0]), ref(property[1])]]]]])
        assertEq(liftReturns(result, owner), result)
        const foreign = /** @type {Value} */ (['block', body(['return', other, 8])])
        const terminal = liftReturns(returned(['object', [
            [':', ['block', returned(7)], foreign], [':', foreign, foreign],
        ]]), owner)
        const object = blockOf(terminal.statements[0])
        assertEq(object.statements.length, 1)
        const string = blockOf(object.statements[0])
        assertEq(string.statements.length, 1)
        assertStructurallySame(blockOf(string.statements[0]).exit, ['return', owner, 7])
        assertStructurallySame(string.exit, ['yield', []])
        assertStructurallySame(object.exit, ['yield', []])
        assertStructurallySame(terminal.exit, ['yield', []])
    },
    objectIdentityAndCallee: () => {
        const key = id(), condition = id()
        for (const value of /** @type {readonly Value[]} */ ([undefined, null, true, 0, -0, 4n, 'key', ['array', []], ['object', []], ref(key)])) {
            const source = returned(['object', [[':', value, 3], [':', 'key', ref(key)]]])
            assertEq(liftReturns(source, owner), source)
        }
        const selected = /** @type {Value} */ (['block', yielded([3], [['if', [], ref(condition), returned(9), yielded([])]])])
        const callee = /** @type {Value} */ (['object', [[':', ref(key), selected]]])
        const source = returned(['()', callee, [['block', returned(7)]]])
        const result = liftReturns(source, owner)
        assert(result !== source)
        assertStructurallySame(result.exit, ['yield', []])
        assertEq(liftReturns(result, owner), result)
    },
    commaCalleeFacts: () => {
        const fn = id(), receiver = id(), condition = id()
        const selected = /** @type {Value} */ (['block', yielded([3], [['if', [], ref(condition), returned(9), yielded([])]])])
        for (const last of /** @type {readonly Value[]} */ ([ref(fn), ['array', []], ['object', []], ['instanceof', 1, 'Array']])) {
            for (const prefix of /** @type {readonly Value[]} */ ([1, selected])) {
                const callee = /** @type {Value} */ ([',', [prefix, last]])
                const source = returned(['()', callee, [['block', returned(7)]]])
                const result = liftReturns(source, owner)
                assert(result !== source)
                assertEq(liftReturns(result, owner), result)
            }
        }
        for (const last of /** @type {readonly Value[]} */ ([['.', ref(receiver), 'at'], ['?.', ref(receiver), 'at'], ['Object.is'], ['slice']])) {
            for (const prefix of /** @type {readonly Value[]} */ ([1, selected])) {
                const comma = /** @type {Value} */ ([',', [prefix, last]])
                for (const callee of /** @type {readonly Value[]} */ ([comma, ['block', yielded([comma])], ['?:', true, comma, ref(fn)]])) {
                    const source = returned(['()', callee, [['block', returned(7)]]])
                    assertEq(liftReturns(source, owner), source)
                }
            }
        }
        const terminal = /** @type {Value} */ ([',', [['block', returned(7)], ['block', body(['return', other, 8])], ['.', ref(receiver), 'at']]])
        const source = returned(['()', terminal, [['block', body(['return', other, 8])]]])
        assertStructurallySame(liftReturns(source, owner).exit, ['yield', []])
    },
    eagerOperators: () => {
        const earlier = id(), condition = id()
        const selected = /** @type {Value} */ (['block', yielded([3], [
            ['define', earlier, 4, 'required'], ['if', [], ref(condition), returned(9), yielded([])],
        ])])
        for (const tag of [...unaryTags, '+']) {
            const source = returned(/** @type {Value} */ ([tag, selected]))
            const result = liftReturns(source, owner)
            const region = blockOf(result.statements[0])
            assertEq(region.statements.length, 1)
            const operand = region.statements[0]
            assert(operand[0] === 'block')
            assertStructurallySame(region.exit, ['yield', [[tag, ref(operand[1][0])]]])
            assertEq(liftReturns(result, owner), result)
        }
        for (const tag of binaryTags.filter(tag => tag !== '&&' && tag !== '||' && tag !== '??')) {
            const source = returned([tag, ref(earlier), selected])
            const result = liftReturns(source, owner)
            const region = blockOf(result.statements[0])
            assertEq(region.statements.length, 2)
            const snapshot = region.statements[0], operand = region.statements[1]
            assert(snapshot[0] === 'define' && operand[0] === 'block')
            assertStructurallySame(snapshot[2], ref(earlier))
            assertEq(snapshot[3], 'required')
            assert(snapshot[1] !== earlier)
            assertStructurallySame(region.exit, ['yield', [[tag, ref(snapshot[1]), ref(operand[1][0])]]])
        }
    },
    rawLogicalOperators: () => {
        const output = id()
        const cases = /** @type {const} */ ([
            ['&&', false], ['&&', true], ['||', true], ['||', false], ['??', 3], ['??', null], ['??', undefined],
        ])
        for (const [tag, left] of cases) {
            // Immutable source-operator tuples are constructible, but normalized
            // FAST excludes them. They must never enter eager return lifting.
            const value = /** @type {Value} */ (/** @type {unknown} */ ([tag, left, ['block', returned(7)]]))
            const source = returned(value)
            assertEq(liftReturns(source, owner), source)
            const required = body(['return', owner, ref(output)], [['define', output, value, 'required']])
            assertEq(liftReturns(required, owner), required)
            const leftReturn = returned(/** @type {Value} */ (/** @type {unknown} */ ([tag, ['block', returned(7)], left])))
            assertEq(liftReturns(leftReturn, owner), leftReturn)
        }
    },
    conditionalTests: () => {
        const condition = id(), value = id(), before = id(), after = id()
        const test = /** @type {Value} */ (['block', yielded([true], [
            ['if', [], ref(condition), returned(9), yielded([])],
        ])])
        for (const source of /** @type {readonly Value[]} */ ([
            ['if', test, yielded([]), yielded([1, 2])], ['?:', test, 1, 2],
        ])) {
            const result = liftReturns(returned(source), owner)
            const region = blockOf(result.statements[0])
            assertEq(region.statements.length, 2)
            const guard = region.statements[0], conditional = region.statements[1]
            assert(guard[0] === 'block' && conditional[0] === 'if')
            assertStructurallySame(conditional[2], ref(guard[1][0]))
            assertStructurallySame(region.exit, ['yield', [ref(conditional[1][0])]])
            assertEq(liftReturns(result, owner), result)
        }
        const prefix = /** @type {Statement} */ (['define', before, 3, 'required'])
        const suffix = /** @type {Statement} */ (['define', after, ref(value), 'required'])
        const source = body(['return', owner, ref(after)], [prefix,
            ['if', [value], test, yielded([1]), yielded([2])], suffix,
        ])
        const result = liftReturns(source, owner)
        assertEq(result.statements.length, 4)
        assertEq(result.statements[0], prefix)
        const guard = result.statements[1], conditional = result.statements[2]
        assert(guard[0] === 'block' && conditional[0] === 'if')
        assertEq(conditional[1][0], value)
        assertStructurallySame(conditional[2], ref(guard[1][0]))
        assertEq(result.statements[3], suffix)
        const unchanged = returned(7)
        const pure = /** @type {Block} */ ({ ...unchanged, statements: [['if', [], ['!', false], yielded([]), yielded([])]] })
        assertEq(liftReturns(pure, owner), pure)
    },
    terminalOperandsAndTests: () => {
        const value = id()
        const terminal = /** @type {Value} */ (['block', returned(7)])
        const foreign = /** @type {Value} */ (['block', body(['return', other, 8])])
        for (const source of /** @type {readonly Value[]} */ ([
            ['+', terminal, foreign], ['()', terminal, [foreign]],
            ['()', 0, [terminal, foreign]], ['if', terminal, body(['return', other, 3]), yielded([foreign])],
            ['?:', terminal, foreign, foreign],
        ])) {
            const result = liftReturns(returned(source), owner)
            const region = blockOf(result.statements[0])
            assertStructurallySame(region.exit, ['yield', []])
            assertStructurallySame(result.exit, ['yield', []])
            assertEq(liftReturns(result, owner), result)
        }
        const source = returned(9)
        const statement = /** @type {Block} */ ({ ...source, statements: [
            ['if', [], terminal, body(['return', other, 3]), yielded([foreign])],
            ['define', value, foreign, 'required'],
        ] })
        const result = liftReturns(statement, owner)
        assertEq(result.statements.length, 1)
        assertStructurallySame(blockOf(result.statements[0]).exit, ['return', owner, 7])
        assertStructurallySame(result.exit, ['yield', []])
    },
    plainCalls: () => {
        const callee = id(), argument = id(), condition = id()
        const selected = /** @type {Value} */ (['block', yielded([3], [['if', [], ref(condition), returned(9), yielded([])]])])
        const source = returned(['()', ref(callee), [ref(argument), selected]])
        const result = liftReturns(source, owner)
        const region = blockOf(result.statements[0])
        assertEq(region.statements.length, 3)
        const fn = region.statements[0], first = region.statements[1], second = region.statements[2]
        assert(fn[0] === 'define' && first[0] === 'define' && second[0] === 'block')
        assertStructurallySame(fn[2], ref(callee))
        assertStructurallySame(first[2], ref(argument))
        assertStructurallySame(region.exit, ['yield', [['()', ref(fn[1]), [ref(first[1]), ref(second[1][0])]]]])
        const ordinary = /** @type {readonly Value[]} */ ([
            undefined, null, 0, ['array', []], ['object', []], ['instanceof', 1, 'Array'],
            ['function', { target: other, parameters: [], rest: null, self: null, captures: [], body: body(['return', other, 3]) }],
            ['typeof', ref(callee)], ['()', ref(callee), []], ['block', yielded([ref(callee)])],
            ['if', true, returned(9), yielded([ref(callee)])], ['?:', true, ref(callee), ref(argument)],
            ['block', yielded([])], ['block', yielded([1, 2])],
            ['block', body(['throw', 'callee failure'])],
        ])
        for (const value of ordinary) {
            const block = returned(['()', value, [['block', returned(7)]]])
            const mapped = liftReturns(block, owner)
            assert(mapped !== block)
            assertEq(liftReturns(mapped, owner), mapped)
        }
    },
    memberCalleeBoundaries: () => {
        const receiver = id(), fn = id()
        const member = /** @type {Value} */ (['.', ref(receiver), 'at'])
        const callees = /** @type {readonly Value[]} */ ([
            member, ['?.', ref(receiver), 'at'], ['.', ref(receiver), 'at', ['|()', []]],
            ['?.()', ref(fn), []], ['Object.is'], ['slice'], [',', []],
            ['block', yielded([member])], ['if', true, yielded([member]), yielded([ref(fn)])],
            ['if', true, yielded([ref(fn)]), yielded([member])], ['?:', true, ['block', yielded([member])], ref(fn)],
        ])
        for (const callee of callees) {
            const source = returned(['()', callee, [['block', returned(7)]]])
            assertEq(liftReturns(source, owner), source)
        }
        const terminal = /** @type {Value} */ (['block', yielded([member], [['block', [], returned(7)]])])
        const result = liftReturns(returned(['()', terminal, [['block', body(['return', other, 3])]]]), owner)
        assertStructurallySame(result.exit, ['yield', []])
        const opaque = returned(['()', ref(fn), [['...', ['block', returned(7)]]]])
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
    deepEagerChain: () => {
        /** @type {Value} */
        let value = ['block', returned(7)]
        for (let depth = 0; depth < 20_000; ++depth) { value = ['!', value] }
        const result = liftReturns(returned(value), owner)
        let current = result
        for (let depth = 0; depth < 20_001; ++depth) {
            assertEq(current.statements.length, 1)
            current = blockOf(current.statements[0])
        }
        assertStructurallySame(current.exit, ['return', owner, 7])
    },
    deepSequenceChain: () => {
        /** @type {Value} */
        let value = ['block', returned(7)]
        for (let depth = 0; depth < 20_000; ++depth) { value = depth % 2 === 0 ? ['array', [1, value]] : [',', [1, value]] }
        const result = liftReturns(returned(value), owner)
        let current = result
        for (let depth = 0; depth < 20_000; ++depth) {
            const region = blockOf(current.statements[0])
            assertEq(region.statements.length, 2)
            assertEq(region.statements[0][0], 'define')
            current = { statements: [region.statements[1]], exit: region.exit }
        }
        assertStructurallySame(blockOf(current.statements[0]).exit, ['return', owner, 7])
    },
    deepObjectChain: () => {
        /** @type {Value} */
        let value = ['block', returned(7)]
        for (let depth = 0; depth < 20_000; ++depth) { value = ['object', [[':', 'key', value]]] }
        const result = liftReturns(returned(value), owner)
        let current = result
        for (let depth = 0; depth < 20_000; ++depth) {
            const region = blockOf(current.statements[0])
            assertEq(region.statements.length, 2)
            const key = region.statements[0]
            assert(key[0] === 'define')
            assertStructurallySame(key[2], ['String', 'key'])
            current = { statements: [region.statements[1]], exit: region.exit }
        }
        assertStructurallySame(blockOf(current.statements[0]).exit, ['return', owner, 7])
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
