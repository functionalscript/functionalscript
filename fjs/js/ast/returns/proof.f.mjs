/**
 * Return lifting preserves eager operand order and direct value continuations.
 * @import { BindingId, Block, Exit, Loop, Statement, Value } from '../types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { binaryTags, unaryTags } from '../../../compiler/ast/module.f.js'
import { liftReturns, liftValueReturns } from './module.f.mjs'

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

/** All statement regions, without recursively walking the host stack. @type {(root: Block) => readonly Block[]} */
const regions = root => {
    /** @type {readonly Block[]} */
    let pending = [root]
    /** @type {readonly Block[]} */
    let result = []
    while (pending.length !== 0) {
        const [block, ...rest] = pending
        result = [...result, block]
        pending = [...block.statements.flatMap(statement => statement[0] === 'block' ? [statement[2]]
            : statement[0] === 'if' ? [statement[3], statement[4]] : statement[0] === 'loop' ? [statement[1].body] : []), ...rest]
    }
    return result
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
            ['instanceof', ref(value), 'Array'],
            ['object', []], ['object', [[':', 'x', ref(value)]]],
            ['object', [['...', ['object', []]], [':', 'x', ['block', returned(3)]]]],
            ['object', [[':', ['block', returned(3)], 1], ['...', ['object', []]]]],
            ['array', [['...', ['array', []]], ['block', returned(3)]]],
            ['array', [['...', ['block', returned(3)]]]],
            ['.', ref(value), 'x'], ['?.', ref(value), 'x'], ['?.()', ref(value), [1]],
            ['.', ref(value), ['Number', 0], ['|()', [1]]],
            ['?.', ref(value), 'x', ['|.', 'y', ['|!()', [1]]]],
            ['?.()', ref(value), [1], ['|()', [2]]],
            ['?.()', ref(value), [], ['|!()', [1]]],
            ['?.()', ref(value), [['...', ['block', returned(3)]]]],
            ['.', ref(value), 'x', ['|()', [['...', ['block', returned(3)]]]]],
            ['()', ref(value), [['...', ['block', returned(3)]]]],
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
        const normalized = liftReturns(source, owner)
        const region = blockOf(normalized.statements[0])
        const result = region.statements[0]
        assert(result[0] === 'block')
        assertEq(result[1], statement[1])
        assertEq(result[2].statements.length, 1)
        assertStructurallySame(blockOf(result[2].statements[0]).exit, ['return', owner, 3])
        assertStructurallySame(result[2].exit, ['yield', []])
        assertStructurallySame(normalized.exit, ['yield', []])
        assertEq(multi.exit[0], 'yield')
        const ordinary = yielded([guard, 7])
        assertEq(liftReturns(ordinary, owner), ordinary)
    },
    statementYieldLists: () => {
        const value = id(), condition = id(), before = id(), after = id()
        const selected = /** @type {Value} */ (['block', yielded([ref(value)], [['if', [], ref(condition), returned(7), yielded([])]])])
        const prefix = /** @type {Statement} */ (['define', before, 4, 'required'])
        const suffix = /** @type {Statement} */ (['define', after, 9, 'required'])
        for (const length of /** @type {const} */ ([1, 3])) {
            const bindings = Array.from({ length }, id)
            const values = length === 1 ? [selected] : [ref(value), selected, ref(value)]
            const normal = yielded(values, [prefix])
            for (const kind of /** @type {const} */ (['block', 'if'])) {
                const statement = /** @type {Statement} */ (kind === 'block' ? ['block', bindings, normal]
                    : ['if', bindings, ref(condition), normal, yielded(Array.from({ length }, () => 3))])
                const source = body(['return', owner, ['array', bindings.map(ref)]], [statement, suffix])
                const result = liftReturns(source, owner)
                const region = result.statements[0]
                assert(region[0] === 'block' || region[0] === 'if')
                assertEq(region[1], bindings)
                const regionBody = region[0] === 'block' ? region[2] : region[3]
                assertEq(regionBody.statements[0], prefix)
                assertEq(regionBody.statements.length, length + 1)
                assert(regionBody.exit[0] === 'yield')
                assertEq(regionBody.exit[1].length, length)
                for (let index = 0; index < length; ++index) {
                    const established = regionBody.statements[index + 1]
                    assert(established[0] === 'define' || established[0] === 'block')
                    const read = regionBody.exit[1][index]
                    assert(read instanceof Array && read[0] === 'ref')
                    assertEq(read[1], established[0] === 'define' ? established[1] : established[1][0])
                }
                assertEq(result.statements[1], suffix)
                assertEq(result.exit, source.exit)
                assertEq(liftReturns(result, owner), result)
            }
        }
        const zero = body(['return', owner, 9], [['block', [], yielded([], [['define', before, selected, 'required']])]])
        const normalized = liftReturns(zero, owner)
        assertStructurallySame(blockOf(normalized.statements[0]).exit, ['yield', []])
        assertEq(liftReturns(normalized, owner), normalized)
        const unchanged = body(['return', owner, 9], [
            ['block', [value, before], yielded([1, 2])], ['if', [], true, yielded([]), yielded([])],
        ])
        assertEq(liftReturns(unchanged, owner), unchanged)
    },
    statementYieldTerminalAndArity: () => {
        const value = id(), condition = id(), before = id()
        const bindings = /** @type {readonly BindingId[]} */ ([id(), id(), id()])
        const prefix = /** @type {Statement} */ (['define', before, 4, 'required'])
        const foreign = /** @type {Value} */ (['block', body(['return', other, 8])])
        const terminal = yielded([ref(value), ['block', returned(7)], foreign], [prefix])
        for (const kind of /** @type {const} */ (['block', 'if'])) {
            const statement = /** @type {Statement} */ (kind === 'block' ? ['block', bindings, terminal]
                : ['if', bindings, ref(condition), terminal, body(['throw', 9])])
            const source = body(['return', owner, foreign], [statement, ['define', value, foreign, 'required']])
            const result = liftReturns(source, owner)
            assertEq(result.statements.length, 1)
            const mapped = result.statements[0]
            assert(mapped[0] === 'block' || mapped[0] === 'if')
            assertEq(mapped[1], bindings)
            const regionBody = mapped[0] === 'block' ? mapped[2] : mapped[3]
            assertEq(regionBody.statements.length, 3)
            assertEq(regionBody.statements[0], prefix)
            const snapshot = regionBody.statements[1]
            assert(snapshot[0] === 'define')
            assertEq(snapshot[3], 'required')
            assertStructurallySame(snapshot[2], ref(value))
            assertStructurallySame(blockOf(regionBody.statements[2]).exit, ['return', owner, 7])
            assertStructurallySame(regionBody.exit, ['yield', []])
            assertStructurallySame(result.exit, ['yield', []])
        }
        const selected = /** @type {Value} */ (['if', ref(condition), returned(7), yielded([3])])
        const source = body(['return', owner, 9], [['block', bindings, yielded([selected])]])
        const result = liftReturns(source, owner)
        const region = result.statements[0]
        assert(region[0] === 'block' && region[2].exit[0] === 'yield')
        assertEq(region[1], bindings)
        // The construction owner must still reject the original 3-vs-1 mismatch.
        assertEq(region[2].exit[1].length, 1)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loopYield = body(['return', owner, 9], [['loop', {
            target: loopTarget, parameters: [], initial: [], results: [], body: yielded([['block', returned(7)]]),
        }]])
        assertEq(liftReturns(loopYield, owner), loopYield)
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
    instanceofOperands: () => {
        const value = id(), condition = id(), output = id(), after = id(), before = id()
        const prefix = /** @type {Statement} */ (['define', before, 4, 'required'])
        const operands = /** @type {readonly Value[]} */ ([
            ['block', yielded([ref(value)], [prefix, ['if', [], ref(condition), returned(7), yielded([])]])],
            ['if', ref(condition), returned(7), yielded([ref(value)])],
        ])
        for (const operand of operands) {
            const expression = /** @type {Value} */ (['instanceof', operand, 'Array'])
            const source = returned(expression)
            const result = liftReturns(source, owner)
            const region = blockOf(result.statements[0])
            assertEq(region.statements.length, 1)
            const input = region.statements[0]
            assert(input[0] === 'block' || input[0] === 'if')
            assertStructurallySame(region.exit, ['yield', [['instanceof', ref(input[1][0]), 'Array']]])
            assert(region.exit[0] === 'yield')
            const check = region.exit[1][0]
            assert(check instanceof Array && check[0] === 'instanceof')
            const read = check[1]
            assert(read instanceof Array && read[0] === 'ref')
            assertEq(read[1], input[1][0])
            assertEq(liftReturns(result, owner), result)
            const suffix = /** @type {Statement} */ (['define', after, ref(output), 'required'])
            const required = body(['return', owner, ref(after)], [['define', output, expression, 'required'], suffix])
            const normalized = liftReturns(required, owner)
            const initialized = normalized.statements[0]
            assert(initialized[0] === 'block')
            assertEq(initialized[1][0], output)
            assertEq(normalized.statements[1], suffix)
            assertEq(liftReturns(normalized, owner), normalized)
        }
        for (const operand of /** @type {readonly Value[]} */ ([null, 0, ['array', []], ['object', []], ['block', yielded([ref(value)])]])) {
            const source = returned(['instanceof', operand, 'Array'])
            assertEq(liftReturns(source, owner), source)
        }
        const payload = /** @type {Value} */ (['array', [4]])
        const terminal = liftReturns(returned(['instanceof', ['block', returned(payload)], 'Array']), owner)
        const check = blockOf(terminal.statements[0])
        assertEq(check.statements.length, 1)
        assertStructurallySame(blockOf(check.statements[0]).exit, ['return', owner, payload])
        assertStructurallySame(check.exit, ['yield', []])
        assertStructurallySame(terminal.exit, ['yield', []])
    },
    instanceofCallee: () => {
        const value = id(), condition = id()
        const operand = /** @type {Value} */ (['if', ref(condition), returned(7), yielded([ref(value)])])
        const source = returned(['()', ['instanceof', operand, 'Array'], [['block', returned(8)]]])
        const result = liftReturns(source, owner)
        const call = blockOf(result.statements[0])
        assertEq(call.statements.length, 2)
        const check = blockOf(call.statements[0])
        const input = check.statements[0]
        assert(input[0] === 'if')
        assertStructurallySame(check.exit, ['yield', [['instanceof', ref(input[1][0]), 'Array']]])
        assertStructurallySame(call.exit, ['yield', []])
        assertStructurallySame(result.exit, ['yield', []])
        assertEq(liftReturns(result, owner), result)
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
            ['?.', ref(receiver), 'at'], ['Object.is'], ['slice'], [',', []],
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
        for (const callee of /** @type {readonly Value[]} */ ([member, ['.', ref(receiver), 'at', ['|()', []]], ['?.()', ref(fn), []]])) {
            const source = returned(['()', callee, [['block', returned(7)]]])
            const mapped = liftReturns(source, owner)
            assert(mapped !== source)
            assertEq(liftReturns(mapped, owner), mapped)
        }
        const completed = /** @type {Value} */ (['()', member, []])
        const nested = returned(['()', completed, [['block', returned(7)]]])
        assert(liftReturns(nested, owner) !== nested)
        const unchanged = returned(completed)
        assertEq(liftReturns(unchanged, owner), unchanged)
    },
    memberOperands: () => {
        const receiver = id(), condition = id(), destination = id()
        const terminal = /** @type {Value} */ (['block', returned(7)])
        const selected = /** @type {Value} */ (['if', ref(condition), returned(7), yielded([0])])
        const cases = /** @type {readonly Value[]} */ ([
            ['.', terminal, 'x'], ['?.', terminal, 'x'], ['?.()', terminal, []],
            ['.', ref(receiver), ['Number', terminal]], ['?.', ref(receiver), ['Number', terminal]],
            ['.', ref(receiver), 'x', ['|()', [1, terminal]]],
            ['.', ref(receiver), ['Number', selected], ['|()', [selected]]],
            ['.', ref(receiver), 'x', ['|?.()', [terminal]]],
            ['?.', ref(receiver), 'x', ['|()', [selected], ['|.', ['Number', selected]]]],
            ['?.', ref(receiver), 'x', ['|.', ['Number', selected], ['|?.()', [selected], ['|()', [selected]]]]],
            ['?.()', ref(receiver), [selected], ['|.', 'x', ['|()', [selected]]]],
            ['?.()', ref(receiver), [selected], ['|?.()', [selected]]],
            ['?.', ref(receiver), 'x', ['|!()', [terminal]]],
            ['?.', ref(receiver), ['Number', selected], ['|!()', [selected]]],
            ['?.', ref(receiver), 'x', ['|()', [selected], ['|.', 'y', ['|!()', [selected]]]]],
            ['?.()', ref(receiver), [selected], ['|!()', [selected]]],
            ['?.()', ref(receiver), [], ['|!()', [selected]]],
            ['?.', terminal, 'x', ['|!()', [terminal]]],
            ['.', terminal, 'x', ['|!()', [terminal]]],
        ])
        for (const value of cases) {
            const source = returned(value)
            const mapped = liftReturns(source, owner)
            assert(mapped !== source)
            assertEq(liftReturns(mapped, owner), mapped)
            const one = liftValueReturns(value, destination, owner)
            assert(one.statement !== null)
            assertStructurallySame(one.value, ref(destination))
        }
        assertEq(liftValueReturns(1, destination, owner).statement, null)
        const query = returned(['.', ref(receiver), 'x', ['|()', [terminal]]])
        const mapped = liftReturns(query, owner)
        const definitions = regions(mapped).flatMap(block => block.statements.filter(statement => statement[0] === 'define'))
        assert(definitions.some(statement => statement[2] instanceof Array && statement[2][0] === 'memberPresent' && statement[3] === 'required'))
        const optional = liftReturns(returned(['?.', ref(receiver), 'x', ['|?.()', [selected]]]), owner)
        assert(regions(optional).some(block => block.statements.some(statement => statement[0] === 'if')))
    },
    forcedSuffixSharing: () => {
        const receiver = id(), condition = id(), unique = id()
        const selected = /** @type {Value} */ (['if', ref(condition), returned(7), yielded([0])])
        const argument = /** @type {Value} */ (['block', yielded([selected], [['define', unique, 4, 'required']])])
        const source = returned(['?.', ref(receiver), 'x', ['|?.()', [], ['|.', 'y', ['|?.()', [], ['|.', ['Number', 0], ['|!()', [argument]]]]]]])
        const mapped = liftReturns(source, owner)
        const declarations = regions(mapped).flatMap(block => block.statements.filter(statement => statement[0] === 'define' && statement[1] === unique))
        assertEq(declarations.length, 1)
        assertEq(liftReturns(mapped, owner), mapped)
        const plain = returned(['?.()', ref(receiver), [selected], ['|!()', [3]]])
        assert(liftReturns(plain, owner) !== plain)
        const unchanged = returned(['?.', ref(receiver), 'x', ['|?.()', [], ['|.', 'y', ['|!()', [3]]]]])
        assertEq(liftReturns(unchanged, owner), unchanged)
    },
    deepMemberChain: () => {
        const receiver = id()
        /** @type {import('../types.ts').Step<Value>} */
        let step = ['|.', ['Number', ['block', returned(7)]]]
        for (let depth = 0; depth < 20_000; ++depth) { step = ['|.', 'x', step] }
        const source = returned(['?.', ref(receiver), 'x', step])
        const mapped = liftReturns(source, owner)
        assert(mapped !== source)
        assertEq(liftReturns(mapped, owner), mapped)
    },
    permittedPhysicalLoops: () => {
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const receiver = id(), condition = id(), destination = id()
        for (const kind of /** @type {const} */ (['break', 'continue'])) {
            const transfer = /** @type {Value} */ (['block', body([kind, target, []])])
            for (const functionOwner of [owner, null]) {
                const expression = /** @type {Value} */ (['.', ref(receiver), 'x', ['|()', [transfer]]])
                const lifted = liftValueReturns(expression, destination, functionOwner, [target])
                assert(lifted.statement !== null)
                assertEq(lifted.normal, false)
                const all = regions(blockOf(lifted.statement))
                assert(all.some(block => block.exit[0] === kind && block.exit[1] === target))
                assert(all.some(block => block.statements.some(statement => statement[0] === 'define'
                    && statement[2] instanceof Array && statement[2][0] === 'memberPresent')))
            }
        }
        const mixed = /** @type {Value} */ (['()', ['.', ['if', ref(condition), body(['continue', target, []]), yielded([ref(receiver)])], 'x'], [
            ['if', ref(condition), returned(7), yielded([0])],
        ]])
        const lifted = liftValueReturns(mixed, destination, owner, [target])
        assert(lifted.statement !== null)
        assertEq(lifted.normal, true)
        const local = /** @type {Value} */ (['block', yielded([ref(receiver)], [['loop', {
            target, parameters: [], initial: [], results: [], body: body(['break', target, []]),
        }]])])
        assertEq(liftValueReturns(local, destination, owner).statement, null)
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
        for (let depth = 0; depth < 20_000; ++depth) { value = depth % 2 === 0 ? ['!', value] : ['instanceof', value, 'Array'] }
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
        permittedLoopRequiresExactTarget: () => {
            const active = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const foreign = /** @type {const} */ ({ kind: 'loop', index: 0 })
            return liftValueReturns(['block', body(['continue', foreign, []])], id(), null, [active])
        },
        permittedLoopCannotInventFunctionOwner: () => {
            const active = /** @type {const} */ ({ kind: 'loop', index: 0 })
            return liftValueReturns(['block', returned(7)], id(), null, [active])
        },
        statementResultForeignReturn: () => liftReturns(body(['return', owner, 9], [
            ['block', [id()], yielded([['block', body(['return', other, 7])]])],
        ]), owner),
        statementResultEnclosingLoopEscape: () => {
            const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
            return liftReturns(body(['return', owner, 9], [['loop', {
                target, parameters: [], initial: [], results: [], body: body(['break', target, []], [
                    ['block', [id()], yielded([['block', body(['continue', target, []])]])],
                ]),
            }]]), owner)
        },
        instanceofForeignReturn: () => liftReturns(returned(['instanceof', ['block', body(['return', other, 7])], 'Array']), owner),
        instanceofEnclosingLoopEscape: () => {
            const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const value = id()
            return liftReturns(body(['return', owner, 7], [
                ['loop', { target, parameters: [], initial: [], results: [], body: body(['break', target, []], [
                    ['define', value, ['instanceof', ['block', body(['continue', target, []])], 'Array'], 'required'],
                ]) }],
            ]), owner)
        },
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
