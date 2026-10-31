/**
 * Return lifting preserves eager operand order and direct value continuations.
 * @import { BindingId, Block, Exit, Function as FastFunction, Loop, Operator, Statement, Value } from '../types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { binaryTags, unaryTags } from '../../../compiler/ast/module.f.js'
import { intrinsicIds, staticIds } from '../../../edag/module.f.mjs'
import { _expandObjectSpread, _expandSpread, _exposeOperands, _forwardReturns, liftReturns, liftValueReturns } from './module.f.mjs'

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
    forwardingConsumesOnlyTheOwningTailResult: () => {
        const value = id(), different = id()
        const prefix = /** @type {Statement} */ (['define', different, ['array', []], 'required'])
        const before = /** @type {Statement} */ (['define', id(), ['array', []], 'required'])
        const conditional = /** @type {Statement} */ (['if', [value], true, yielded([7], [prefix]), returned(8)])
        const source = returned(ref(value))
        /** @type {Block} */
        const block = { ...source, statements: [before, conditional] }
        const forwarded = _forwardReturns(block, owner)
        assertEq(forwarded.statements[0], before)
        assertStructurallySame(forwarded.exit, ['yield', []])
        const last = forwarded.statements[1]
        assert(last[0] === 'if')
        assertStructurallySame(last[1], [])
        assertEq(last[2], conditional[2])
        assertEq(last[3].statements[0], prefix)
        assertStructurallySame(last[3].exit, ['return', owner, 7])
        assertEq(last[4], conditional[4])
        /** @type {readonly Block[]} */
        const unchanged = [
            yielded([ref(value)]), body(['throw', ref(value)]), body(['return', other, ref(value)]),
            returned(7), returned(['array', []]), returned(ref(value)),
            { ...source, statements: [prefix] },
            { ...source, statements: [['if', [], true, yielded([]), yielded([])]] },
            { ...source, statements: [['if', [value, different], true, yielded([1, 2]), yielded([3, 4])]] },
            { ...source, statements: [['if', [different], true, yielded([1]), yielded([2])]] },
        ]
        for (const block of unchanged) { assertEq(_forwardReturns(block, owner), block) }
    },
    forwardingKeepsBlocksPrefixesAndAbruptLeaves: () => {
        const output = id(), inside = id()
        const prefix = /** @type {Statement} */ (['define', inside, ['array', [1]], 'required'])
        const value = /** @type {Value} */ (['function', { target: other, parameters: [], rest: null, self: null,
            captures: [], body: body(['return', other, 9]) }])
        const inner = yielded([value], [prefix])
        const source = body(['return', owner, ref(output)], [['block', [output], inner]])
        const forwarded = _forwardReturns(source, owner)
        const statement = forwarded.statements[0]
        assert(statement[0] === 'block')
        assertStructurallySame(statement[1], [])
        assertEq(statement[2].statements[0], prefix)
        assertStructurallySame(statement[2].exit, ['return', owner, value])
        const abrupt = yielded([], [['if', [], true, returned(1), returned(2)]])
        const conditional = body(['return', owner, ref(output)], [['if', [output], false, abrupt, yielded([ref(inside)])]])
        const mapped = _forwardReturns(conditional, owner).statements[0]
        assert(mapped[0] === 'if')
        assertEq(mapped[3], abrupt)
        assertStructurallySame(mapped[4].exit, ['return', owner, ref(inside)])
    },
    forwardingTailDepthUsesTheTaskWorklist: () => {
        /** @type {Block} */
        let block = yielded([7])
        for (let depth = 0; depth < 20_000; depth += 1) {
            const output = id()
            block = yielded([ref(output)], [['block', [output], block]])
        }
        const output = id()
        let current = _forwardReturns(body(['return', owner, ref(output)], [['block', [output], block]]), owner)
        for (let depth = 0; depth < 20_001; depth += 1) {
            assertStructurallySame(current.exit, ['yield', []])
            const statement = current.statements[0]
            assert(statement[0] === 'block')
            assertStructurallySame(statement[1], [])
            current = statement[2]
        }
        assertStructurallySame(current.exit, ['return', owner, 7])
    },
    expansion: () => {
        const value = id()
        assertStructurallySame(_expandSpread(ref(value)), ['array', [['...', ref(value)]]])
        assertStructurallySame(_expandObjectSpread(ref(value)), ['object', [['...', ref(value)]]])
    },
    deferredDemandOperandRegions: () => {
        const receiver = id(), destination = id()
        /** @type {readonly Operator<Value>[]} */
        const values = [
            ['array', [['...', ref(receiver)]]], ['object', [['...', ref(receiver)]]],
            ['()', ref(receiver), [['...', ref(receiver)]]], ['.', ref(receiver), 'at'],
            ['?.', ref(receiver), 'at'], ['?.()', ref(receiver), [1]],
            ['()', ['.', ref(receiver), 'at'], [1]],
        ]
        for (const value of values) {
            const ordinary = liftValueReturns(value, destination, owner)
            assertEq(ordinary.statement, null)
            const result = _exposeOperands(value, destination, owner)
            assert(result.statement !== null)
            assertEq(result.normal, true)
            assertStructurallySame(result.value, ref(destination))
        }
        const boundary = _exposeOperands(['()', [',', []], [1]], destination, owner)
        assertEq(boundary.statement, null)
        assertEq(boundary.callee, false)
    },
    unchanged: () => {
        const value = id()
        const ordinary = /** @type {readonly Value[]} */ ([
            1, ref(value), ['array', []], ['array', [1, ref(value)]], [',', []], [',', [1, ref(value)]],
            ['block', yielded([])], ['block', yielded([3])], ['block', yielded([3, 4])],
            ['block', body(['throw', 7])],
            ['if', true, yielded([3]), body(['throw', 7])], ['?:', true, 1, 2],
            ['+', 1], ['+', 1, 2], ['()', ref(value), []],
            ['instanceof', ref(value), 'Array'], ['in', 'x', ref(value)],
            ['object', []], ['object', [[':', 'x', ref(value)]]],
            ['object', [['...', ['object', []]], [':', 'x', ref(value)]]],
            ['object', [[':', 'x', 1], ['...', null], ['...', 'a😀b']]],
            ['array', [['...', ['array', [1]]], 2]],
            ['array', [['...', 'a😀b']]],
            ['.', ref(value), 'x'], ['?.', ref(value), 'x'], ['?.()', ref(value), [1]],
            ['.', ref(value), ['Number', 0], ['|()', [1]]],
            ['?.', ref(value), 'x', ['|.', 'y', ['|!()', [1]]]],
            ['?.()', ref(value), [1], ['|()', [2]]],
            ['?.()', ref(value), [], ['|!()', [1]]],
            ['?.()', ref(value), [['...', ['array', [1]]]]],
            ['.', ref(value), 'x', ['|()', [['...', ['array', [1]]]]]],
            ['()', ref(value), [['...', ['array', [1]]]]],
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
    captureSnapshotsAndBodyOwnership: () => {
        const destination = id(), parameter = id(), rest = id(), self = id(), first = id(), second = id(), third = id()
        const before = id(), after = id(), condition = id()
        const fn = /** @type {FastFunction} */ ({
            target: other, parameters: [parameter], rest, self,
            captures: [
                { binding: first, value: ref(before) },
                { binding: second, value: ['if', ref(condition), returned(7), yielded([3])] },
                { binding: third, value: ref(after) },
            ],
            body: body(['return', other, ['block', body(['return', other, 9])]]),
        })
        const source = /** @type {const} */ (['function', fn])
        const result = liftValueReturns(source, destination, owner)
        assert(result.statement !== null)
        const region = blockOf(result.statement)
        assertEq(result.normal, true)
        assertEq(result.callee, true)
        assertStructurallySame(result.value, ref(destination))
        assertEq(region.statements.length, 3)
        const [a, b, c] = region.statements
        assert(a[0] === 'define' && b[0] === 'if' && c[0] === 'define')
        assertStructurallySame(a[2], ref(before))
        assertStructurallySame(c[2], ref(after))
        assert(region.exit[0] === 'yield')
        const constructed = region.exit[1][0]
        assert(constructed instanceof Array && constructed[0] === 'function')
        const mapped = constructed[1]
        assertEq(mapped.target, fn.target)
        assertEq(mapped.parameters, fn.parameters)
        assertEq(mapped.rest, fn.rest)
        assertEq(mapped.self, fn.self)
        assertEq(mapped.body, fn.body)
        assertStructurallySame(mapped.captures, [
            { binding: first, value: ref(a[1]) },
            { binding: second, value: ref(b[1][0]) },
            { binding: third, value: ref(c[1]) },
        ])
        assertEq(fn.captures[1].value instanceof Array && fn.captures[1].value[0], 'if')
        const ordinary = /** @type {Value} */ (['function', { ...fn, captures: [
            { binding: first, value: ['block', yielded([1, 2])] }, { binding: second, value: ref(before) },
        ] }])
        const unchanged = liftValueReturns(ordinary, destination, owner)
        assertEq(unchanged.statement, null)
        assertEq(unchanged.value, ordinary)
        assertEq(unchanged.callee, true)
    },
    terminalCaptureSkipsRemainingConstruction: () => {
        const destination = id(), first = id(), second = id(), third = id(), before = id()
        const source = /** @type {readonly ['function', FastFunction]} */ (['function', {
            target: other, parameters: [], rest: null, self: null, captures: [
                { binding: first, value: ref(before) },
                { binding: second, value: ['block', returned(7)] },
                { binding: third, value: ['block', body(['return', other, 8])] },
            ], body: body(['return', other, 9]),
        }])
        const result = liftValueReturns(source, destination, owner)
        assert(result.statement !== null)
        assertEq(result.normal, false)
        assertEq(result.callee, true)
        const region = blockOf(result.statement)
        assertEq(region.statements.length, 2)
        assertStructurallySame(region.exit, ['yield', []])
        assertStructurallySame(blockOf(region.statements[1]).exit, ['return', owner, 7])
        const active = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const physical = liftValueReturns(['function', {
            ...source[1], captures: [{ binding: first, value: ['block', body(['continue', active, []])] }],
        }], destination, null, [active])
        assertEq(physical.normal, false)
        assert(physical.statement !== null)
        assertStructurallySame(blockOf(blockOf(physical.statement).statements[0]).exit, ['continue', active, []])
    },
    transferPayloadSnapshots: () => {
        const condition = id(), before = id(), after = id()
        for (const kind of /** @type {const} */ (['break', 'continue'])) {
            const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const slots = /** @type {const} */ ([id(), id(), id()])
            const input = /** @type {readonly Value[]} */ ([ref(before), ['if', ref(condition), returned(7), yielded([3])], ref(after)])
            const loop = /** @type {Loop} */ ({ target, parameters: kind === 'continue' ? slots : [], initial: kind === 'continue' ? [0, 0, 0] : [],
                results: kind === 'break' ? slots : [], body: body([kind, target, input]) })
            const source = body(['return', owner, 9], [['loop', loop]])
            const result = liftReturns(source, owner)
            const statement = result.statements[0]
            assert(statement[0] === 'loop')
            assertEq(statement[1].target, target)
            assertEq(statement[1].parameters, loop.parameters)
            assertEq(statement[1].results, loop.results)
            assertEq(statement[1].initial, loop.initial)
            const [first, selected, last] = statement[1].body.statements
            assert(first[0] === 'define' && selected[0] === 'if' && last[0] === 'define')
            assertStructurallySame(first[2], ref(before))
            assertStructurallySame(last[2], ref(after))
            assertStructurallySame(statement[1].body.exit, [kind, target, [ref(first[1]), ref(selected[1][0]), ref(last[1])]])
            assertEq(liftReturns(result, owner), result)
        }
    },
    terminalTransferPayloadSkipsRemainingValues: () => {
        const before = id()
        for (const kind of /** @type {const} */ (['break', 'continue'])) {
            const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const slots = /** @type {const} */ ([id(), id(), id()])
            const input = /** @type {readonly Value[]} */ ([ref(before), ['block', returned(7)], ['block', body(['return', other, 8])]])
            const source = body(['return', owner, 9], [['loop', {
                target, parameters: kind === 'continue' ? slots : [], initial: kind === 'continue' ? [0, 0, 0] : [],
                results: kind === 'break' ? slots : [], body: body([kind, target, input]),
            }]])
            const result = liftReturns(source, owner)
            const statement = result.statements[0]
            assert(statement[0] === 'loop')
            assertEq(statement[1].body.statements.length, 2)
            assertStructurallySame(statement[1].body.exit, ['yield', []])
            assertStructurallySame(blockOf(statement[1].body.statements[1]).exit, ['return', owner, 7])
        }
    },
    unchangedTransferPayloads: () => {
        for (const kind of /** @type {const} */ (['break', 'continue'])) {
            for (const values of /** @type {readonly (readonly Value[])[]} */ ([[], [1], [2, 3, ['block', yielded([4])]]])) {
                const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
                const slots = values.map(id)
                const source = body(['return', owner, 9], [['loop', {
                    target, parameters: kind === 'continue' ? slots : [], initial: kind === 'continue' ? values.map(() => 0) : [],
                    results: kind === 'break' ? slots : [], body: body([kind, target, values]),
                }]])
                assertEq(liftReturns(source, owner), source)
            }
        }
        const active = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const result = liftValueReturns(['block', body(['break', active, [['block', body(['continue', active, []])]]])], id(), null, [active])
        assert(result.statement !== null)
        assertEq(result.normal, false)
        assertStructurallySame(blockOf(blockOf(result.statement).statements[0]).exit, ['continue', active, []])
    },
    loopEntrySnapshotsInEnclosingScope: () => {
        const condition = id(), before = id(), after = id(), parameter = id(), resultBinding = id(), suffix = id()
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const parameters = /** @type {const} */ ([id(), parameter, id()])
        const results = /** @type {const} */ ([resultBinding])
        const loop = /** @type {Loop} */ ({
            target, parameters, results,
            initial: [ref(before), ['if', ref(condition), returned(7), yielded([3])], ref(after)],
            body: body(['break', target, [ref(parameter)]]),
        })
        const following = /** @type {Statement} */ (['define', suffix, ref(resultBinding), 'required'])
        const source = body(['return', owner, ref(suffix)], [['loop', loop], following])
        const mapped = liftReturns(source, owner)
        const [first, selected, last, statement] = mapped.statements
        assert(first[0] === 'define' && selected[0] === 'if' && last[0] === 'define' && statement[0] === 'loop')
        assertStructurallySame(first[2], ref(before))
        assertStructurallySame(last[2], ref(after))
        assertEq(statement[1].target, target)
        assertEq(statement[1].parameters, parameters)
        assertEq(statement[1].results, results)
        assertEq(statement[1].body, loop.body)
        assertStructurallySame(statement[1].initial, [ref(first[1]), ref(selected[1][0]), ref(last[1])])
        assertEq(mapped.statements[4], following)
        assertEq(mapped.exit, source.exit)
        assertEq(liftReturns(mapped, owner), mapped)
        const bodyReturns = liftReturns(body(['return', owner, ref(resultBinding)], [['loop', {
            ...loop, body: body(['break', target, [['block', returned(8)]]]),
        }]]), owner)
        const bodyLoop = bodyReturns.statements[3]
        assert(bodyLoop[0] === 'loop')
        assert(bodyLoop[1].body !== loop.body)
        assertStructurallySame(blockOf(bodyLoop[1].body.statements[0]).exit, ['return', owner, 8])
    },
    terminalLoopEntrySkipsLoopAndSuffix: () => {
        const before = id(), after = id()
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const prefix = /** @type {Statement} */ (['define', before, 1, 'required'])
        const source = body(['return', owner, ref(after)], [prefix, ['loop', {
            target, parameters: [id(), id(), id()], results: [],
            initial: [ref(before), ['block', returned(7)], ['block', body(['return', other, 8])]],
            body: body(['return', other, 9]),
        }], ['define', after, ['block', body(['return', other, 10])], 'required']])
        const result = liftReturns(source, owner)
        assertEq(result.statements.length, 3)
        assertEq(result.statements[0], prefix)
        const [snapshot, returning] = result.statements.slice(1)
        assert(snapshot[0] === 'define')
        assertStructurallySame(snapshot[2], ref(before))
        assertStructurallySame(blockOf(returning).exit, ['return', owner, 7])
        assertStructurallySame(result.exit, ['yield', []])
        assertEq(liftReturns(result, owner), result)
    },
    unchangedLoopEntryAndPhysicalCompletion: () => {
        for (const initial of /** @type {readonly (readonly Value[])[]} */ ([[], [1], [2, 3, ['block', yielded([4])]]])) {
            const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const source = body(['return', owner, 9], [['loop', {
                target, parameters: initial.map(id), initial, results: [], body: body(['break', target, []]),
            }]])
            assertEq(liftReturns(source, owner), source)
        }
        const active = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const source = /** @type {Value} */ (['block', yielded([9], [['loop', {
            target, parameters: [id()], initial: [['block', body(['continue', active, []])]],
            results: [], body: body(['break', target, []]),
        }]])])
        const physical = liftValueReturns(source, id(), null, [active])
        assert(physical.statement !== null)
        assertEq(physical.normal, false)
        assertStructurallySame(blockOf(blockOf(physical.statement).statements[0]).exit, ['continue', active, []])
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
                for (let index = 0; index < length; index += 1) {
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
    objectSpreadSnapshots: () => {
        const source = id(), key = id(), value = id(), condition = id(), destination = id()
        const selected = /** @type {Value} */ (['if', ref(condition), returned(7), yielded([3])])
        const input = returned(['object', [
            ['...', ref(source)], [':', ref(key), selected], ['...', 'a😀b'],
            [':', '__proto__', ref(value)], ['...', ['object', []]],
        ]])
        const mapped = liftReturns(input, owner)
        const region = blockOf(mapped.statements[0])
        assertEq(region.statements.length, 10)
        const a = region.statements[0], b = region.statements[1], c = region.statements[2]
        const d = region.statements[3], e = region.statements[4], f = region.statements[5]
        const g = region.statements[6], h = region.statements[7], i = region.statements[8], j = region.statements[9]
        assert(a[0] === 'define' && b[0] === 'define' && c[0] === 'define' && d[0] === 'if')
        assert(e[0] === 'define' && f[0] === 'define' && g[0] === 'define')
        assert(h[0] === 'define' && i[0] === 'define' && j[0] === 'define')
        assertStructurallySame(a[2], ref(source))
        assertStructurallySame(b[2], _expandObjectSpread(ref(a[1])))
        assertStructurallySame(c[2], ['String', ref(key)])
        assertEq(e[2], 'a😀b')
        assertStructurallySame(f[2], _expandObjectSpread(ref(e[1])))
        assertStructurallySame(g[2], ['String', '__proto__'])
        assertStructurallySame(j[2], _expandObjectSpread(ref(i[1])))
        assertStructurallySame(region.exit, ['yield', [['object', [
            ['...', ref(b[1])], [':', ref(c[1]), ref(d[1][0])], ['...', ref(f[1])],
            [':', ref(g[1]), ref(h[1])], ['...', ref(j[1])],
        ]]]])
        assertEq(liftReturns(mapped, owner), mapped)
        const terminal = liftValueReturns(['object', [
            ['...', ['block', returned(7)]], [':', ['block', body(['return', other, 9])], 2],
        ]], destination, owner)
        assert(terminal.statement !== null)
        assertEq(terminal.normal, false)
        const definitions = regions(blockOf(terminal.statement)).flatMap(block => block.statements.filter(statement => statement[0] === 'define'))
        assertEq(definitions.some(statement => statement[2] instanceof Array && statement[2][0] === 'object'), false)
        const keyReturn = liftReturns(returned(['object', [
            ['...', ref(source)], [':', ['block', returned(7)], ['block', body(['return', other, 9])]],
        ]]), owner)
        assertEq(blockOf(keyReturn.statements[0]).statements.length, 3)
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
        for (const last of /** @type {readonly Value[]} */ ([
            ref(fn), ['array', []], ['object', []], ['instanceof', 1, 'Array'], ['Object.is'], ['slice'],
            ['.', ref(receiver), 'at'], ['?.', ref(receiver), 'at'],
        ])) {
            for (const prefix of /** @type {readonly Value[]} */ ([1, selected])) {
                const callee = /** @type {Value} */ ([',', [prefix, last]])
                const source = returned(['()', callee, [['block', returned(7)]]])
                const result = liftReturns(source, owner)
                assert(result !== source)
                assertEq(liftReturns(result, owner), result)
            }
        }
        for (const last of /** @type {readonly Value[]} */ ([[',', []]])) {
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
    nativeCalleeSnapshotsAndWrappers: () => {
        const condition = id(), argument = id(), fn = id(), destination = id()
        const helpers = /** @type {const} */ (['entry', 'hasEntry'])
        /** @type {readonly Value[]} */
        const natives = [...staticIds, ...intrinsicIds, ...helpers].map(tag => [tag])
        /** @type {Value} */
        const selected = ['if', ref(condition), returned(7), yielded([3])]
        for (const native of natives) {
            const leaf = liftValueReturns(native, destination, owner)
            assertEq(leaf.statement, null)
            assertEq(leaf.value, native)
            assertEq(leaf.callee, true)
            for (const callee of /** @type {readonly Value[]} */ ([
                native, [',', [1, native]], ['block', yielded([native])],
                ['if', ref(condition), yielded([native]), yielded([ref(fn)])],
                ['if', ref(condition), yielded([ref(fn)]), yielded([native])],
                ['?:', ref(condition), native, ref(fn)],
            ])) {
                const ordinary = returned(['()', callee, [ref(argument)]])
                assertEq(liftReturns(ordinary, owner), ordinary)
                const source = returned(['()', callee, [ref(argument), selected]])
                const result = liftReturns(source, owner)
                const region = blockOf(result.statements[0])
                const [established, first, returning] = region.statements
                assert(established[0] === 'define' && first[0] === 'define' && returning[0] === 'if')
                assertEq(established[2], callee)
                assertStructurallySame(first[2], ref(argument))
                assertStructurallySame(region.exit, ['yield', [['()', ref(established[1]), [ref(first[1]), ref(returning[1][0])]]]])
                assertEq(liftReturns(result, owner), result)
            }
        }
    },
    nativeCalleeTerminalArgumentSkipsLaterWork: () => {
        /** @type {Value} */
        const foreign = ['block', body(['return', other, 9])]
        for (const native of /** @type {readonly Value[]} */ ([['Object.is'], ['slice'], ['entry'], ['hasEntry']])) {
            for (const kind of /** @type {const} */ (['()', '?.()'])) {
                const source = returned([kind, native, [['block', returned(7)], ['...', foreign]]])
                const result = liftReturns(source, owner)
                const region = blockOf(result.statements[0])
                const first = region.statements[0]
                assert(first[0] === 'define')
                assertEq(first[2], native)
                assertEq(result.exit[0], kind === '()' ? 'yield' : 'return')
                assertStructurallySame(regions(region).filter(block => block.exit[0] === 'return').map(block => block.exit), [['return', owner, 7]])
                assertEq(liftReturns(result, owner), result)
            }
        }
    },
    memberCalleeValuesAndDirectCalls: () => {
        const receiver = id(), fn = id()
        const member = /** @type {Value} */ (['.', ref(receiver), 'at'])
        const callees = /** @type {readonly Value[]} */ ([
            ['?.', ref(receiver), 'at'],
            ['block', yielded([member])], ['if', true, yielded([member]), yielded([ref(fn)])],
            ['if', true, yielded([ref(fn)]), yielded([member])], ['?:', true, ['block', yielded([member])], ref(fn)],
            ['if', true, yielded([['Object.is']]), yielded([member])], ['?:', true, member, ['slice']],
        ])
        for (const callee of callees) {
            const ordinary = returned(['()', callee, [1]])
            assertEq(liftReturns(ordinary, owner), ordinary)
            const source = returned(['()', callee, [['block', returned(7)]]])
            const result = liftReturns(source, owner)
            const region = blockOf(result.statements[0])
            const established = region.statements[0]
            assert(established[0] === 'define')
            assertEq(established[2], callee)
            assertStructurallySame(result.exit, ['yield', []])
            assertEq(liftReturns(result, owner), result)
        }
        const empty = /** @type {Value} */ ([',', []])
        for (const callee of /** @type {readonly Value[]} */ ([
            empty, ['block', yielded([empty])], ['if', true, yielded([empty]), yielded([ref(fn)])],
            ['if', true, yielded([ref(fn)]), yielded([empty])], ['?:', true, empty, ref(fn)],
        ])) {
            const source = returned(['()', callee, [['block', returned(7)]]])
            assertEq(liftReturns(source, owner), source)
        }
        const terminal = /** @type {Value} */ (['block', yielded([member], [['block', [], returned(7)]])])
        const result = liftReturns(returned(['()', terminal, [['block', body(['return', other, 3])]]]), owner)
        assertStructurallySame(result.exit, ['yield', []])
        const spread = returned(['()', ref(fn), [['...', ['block', returned(7)]]]])
        assert(liftReturns(spread, owner) !== spread)
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
    wrappedMemberCalleeKeepsBareCall: () => {
        const receiver = id(), condition = id(), destination = id()
        /** @type {Value} */
        const member = ['.', ref(receiver), ['Number', 0]]
        const selected = /** @type {Value} */ (['if', ref(condition), returned(7), yielded([3])])
        for (const callee of /** @type {readonly Value[]} */ ([
            ['block', yielded([member])], [',', [1, member]], ['?:', ref(condition), member, ['Object.is']],
            ['if', ref(condition), yielded([['slice']]), yielded([member])],
            ['block', yielded([['.', ['.', ref(receiver), 'nested'], 'at']])],
            ['?.', ref(receiver), 'nested', ['|.', 'at']],
        ])) {
            const fact = liftValueReturns(callee, destination, owner)
            assertEq(fact.statement, null)
            assertEq(fact.value, callee)
            assertEq(fact.callee, true)
            const source = returned(['()', callee, [selected]])
            const result = liftReturns(source, owner)
            const region = blockOf(result.statements[0])
            assertEq(region.statements.length, 2)
            const [established, argument] = region.statements
            assert(established[0] === 'define' && argument[0] === 'if')
            assertEq(established[2], callee)
            assertStructurallySame(region.exit, ['yield', [['()', ref(established[1]), [ref(argument[1][0])]]]])
            assertEq(liftReturns(result, owner), result)
        }
        for (const callee of /** @type {readonly Value[]} */ ([
            ['.', ref(receiver), 'at', ['|()', [['block', returned(7)]]]],
            ['?.', ref(receiver), 'at', ['|?.()', [['block', returned(7)]]]],
        ])) {
            const result = liftReturns(returned(callee), owner)
            const definitions = regions(result).flatMap(block => block.statements.filter(statement => statement[0] === 'define'))
            assert(definitions.some(statement => statement[2] instanceof Array && statement[2][0] === 'memberPresent'))
            assertEq(result.exit[0], callee instanceof Array && callee[0] === '?.' ? 'return' : 'yield')
        }
        const terminalKey = returned(['()', ['block', yielded([
            ['.', ref(receiver), ['Number', ['block', returned(7)]]],
        ])], [['block', body(['return', other, 9])]]])
        const result = liftReturns(terminalKey, owner)
        assertStructurallySame(result.exit, ['yield', []])
        assertStructurallySame(regions(result).filter(block => block.exit[0] === 'return').map(block => block.exit), [['return', owner, 7]])
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
    spreadSnapshots: () => {
        const source = id(), condition = id(), destination = id()
        const selected = /** @type {Value} */ (['if', ref(condition), returned(7), yielded([0])])
        const cases = /** @type {readonly Value[]} */ ([
            ['array', [['...', ref(source)], selected, ['...', 'a😀b']]],
            ['()', ref(source), [['...', ['array', [1]]], selected, 2]],
            ['.', ref(source), 'slice', ['|()', [['...', ['array', [1]]], selected]]],
            ['.', ref(source), 'slice', ['|?.()', [['...', selected], 2]]],
            ['?.()', ref(source), [['...', selected], 2]],
            ['?.', ref(source), 'x', ['|!()', [['...', ['array', [1]]], selected]]],
            ['?.()', ref(source), [], ['|!()', [['...', ['array', [1]]], selected]]],
            ['?.', ref(source), 'x', ['|()', [['...', selected]], ['|.', 'y', ['|!()', [['...', selected]]]]]],
        ])
        for (const value of cases) {
            const original = returned(value)
            const mapped = liftReturns(original, owner)
            assert(mapped !== original)
            assertEq(liftReturns(mapped, owner), mapped)
            const definitions = regions(mapped).flatMap(block => block.statements.filter(statement => statement[0] === 'define'))
            assert(definitions.some(statement => statement[2] instanceof Array && statement[2][0] === 'array'
                && statement[2][1].some(item => item instanceof Array && item[0] === '...') && statement[3] === 'required'))
        }
        const terminal = liftValueReturns(['array', [['...', ['block', returned(7)]]]], destination, owner)
        assert(terminal.statement !== null)
        assertEq(terminal.normal, false)
        const definitions = regions(blockOf(terminal.statement)).flatMap(block => block.statements.filter(statement => statement[0] === 'define'))
        assertEq(definitions.some(statement => statement[2] instanceof Array && statement[2][0] === 'array'), false)
        const scalar = liftReturns(returned(['array', [['...', ref(source)], selected]]), owner)
        const region = blockOf(scalar.statements[0])
        assertEq(region.statements.length, 3)
        const operand = region.statements[0], expanded = region.statements[1]
        assert(operand[0] === 'define' && expanded[0] === 'define')
        assertStructurallySame(expanded[2], ['array', [['...', ref(operand[1])]]])
        assert(region.exit[0] === 'yield')
        const value = region.exit[1][0]
        assert(value instanceof Array && value[0] === 'array')
        assertStructurallySame(value[1][0], ['...', ref(expanded[1])])
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
        for (let depth = 0; depth < 20_000; depth += 1) { step = ['|.', 'x', step] }
        const source = returned(['?.', ref(receiver), 'x', step])
        const mapped = liftReturns(source, owner)
        assert(mapped !== source)
        assertEq(liftReturns(mapped, owner), mapped)
    },
    deepWrappedMemberCallee: () => {
        const receiver = id()
        /** @type {Value} */
        let callee = ['.', ref(receiver), 'at']
        for (let depth = 0; depth < 20_000; depth += 1) { callee = ['block', yielded([callee])] }
        const ordinary = returned(['()', callee, [1]])
        assertEq(liftReturns(ordinary, owner), ordinary)
        const result = liftReturns(returned(['()', callee, [['block', returned(7)]]]), owner)
        const established = blockOf(result.statements[0]).statements[0]
        assert(established[0] === 'define')
        assertEq(established[2], callee)
        assertStructurallySame(result.exit, ['yield', []])
        assertEq(liftReturns(result, owner), result)
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
        for (let depth = 0; depth < 20_000; depth += 1) { value = ['block', yielded([value])] }
        const result = liftReturns(returned(value), owner)
        let current = result
        for (let depth = 0; depth < 20_001; depth += 1) {
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
        for (let depth = 0; depth < 20_000; depth += 1) { value = depth % 2 === 0 ? ['!', value] : ['instanceof', value, 'Array'] }
        const result = liftReturns(returned(value), owner)
        let current = result
        for (let depth = 0; depth < 20_001; depth += 1) {
            assertEq(current.statements.length, 1)
            current = blockOf(current.statements[0])
        }
        assertStructurallySame(current.exit, ['return', owner, 7])
    },
    deepSequenceChain: () => {
        /** @type {Value} */
        let value = ['block', returned(7)]
        for (let depth = 0; depth < 20_000; depth += 1) { value = depth % 2 === 0 ? ['array', [1, value]] : [',', [1, value]] }
        const result = liftReturns(returned(value), owner)
        let current = result
        for (let depth = 0; depth < 20_000; depth += 1) {
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
        for (let depth = 0; depth < 20_000; depth += 1) { value = ['object', [[':', 'key', value]]] }
        const result = liftReturns(returned(value), owner)
        let current = result
        for (let depth = 0; depth < 20_000; depth += 1) {
            const region = blockOf(current.statements[0])
            assertEq(region.statements.length, 2)
            const key = region.statements[0]
            assert(key[0] === 'define')
            assertStructurallySame(key[2], ['String', 'key'])
            current = { statements: [region.statements[1]], exit: region.exit }
        }
        assertStructurallySame(blockOf(current.statements[0]).exit, ['return', owner, 7])
    },
    deepCaptureChain: () => {
        /** @type {Value} */
        let value = ['block', returned(7)]
        for (let depth = 0; depth < 20_000; depth += 1) {
            const captured = id()
            const target = /** @type {const} */ ({ kind: 'function', index: 0 })
            value = ['function', { target, parameters: [], rest: null, self: null,
                captures: [{ binding: captured, value }], body: body(['return', target, ref(captured)]) }]
        }
        let current = liftReturns(returned(value), owner)
        for (let depth = 0; depth < 20_001; depth += 1) { current = blockOf(current.statements[0]) }
        assertStructurallySame(current.exit, ['return', owner, 7])
    },
    deepTransferPayload: () => {
        /** @type {Value} */
        let value = ['block', returned(7)]
        for (let depth = 0; depth < 20_000; depth += 1) { value = ['block', yielded([value])] }
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const source = body(['return', owner, 9], [['loop', {
            target, parameters: [], initial: [], results: [id()], body: body(['break', target, [value]]),
        }]])
        const result = liftReturns(source, owner)
        const statement = result.statements[0]
        assert(statement[0] === 'loop')
        let current = statement[1].body
        for (let depth = 0; depth < 20_001; depth += 1) { current = blockOf(current.statements[0]) }
        assertStructurallySame(current.exit, ['return', owner, 7])
    },
    deepLoopEntries: () => {
        /** @type {Value} */
        let value = ['block', returned(7)]
        for (let depth = 0; depth < 20_000; depth += 1) {
            const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const parameter = id(), result = id()
            value = ['block', yielded([ref(result)], [['loop', {
                target, parameters: [parameter], initial: [value], results: [result],
                body: body(['break', target, [ref(parameter)]]),
            }]])]
        }
        let current = liftReturns(returned(value), owner)
        for (let depth = 0; depth < 20_001; depth += 1) { current = blockOf(current.statements[0]) }
        assertStructurallySame(current.exit, ['return', owner, 7])
    },
    throw: {
        loopEntryForeignReturn: () => {
            const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
            return liftReturns(body(['return', owner, 9], [['loop', {
                target, parameters: [id()], initial: [['block', body(['return', other, 7])]],
                results: [], body: body(['break', target, []]),
            }]]), owner)
        },
        loopEntryOwnTargetNotActive: () => {
            const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
            return liftReturns(body(['return', owner, 9], [['loop', {
                target, parameters: [id()], initial: [['block', body(['continue', target, [3]])]],
                results: [], body: body(['break', target, []]),
            }]]), owner)
        },
        loopEntryCannotEscapeContainingLoop: () => {
            const outer = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const inner = /** @type {const} */ ({ kind: 'loop', index: 0 })
            return liftReturns(body(['return', owner, 9], [['loop', {
                target: outer, parameters: [], initial: [], results: [], body: body(['break', outer, []], [['loop', {
                    target: inner, parameters: [id()], initial: [['block', body(['continue', outer, []])]],
                    results: [], body: body(['break', inner, []]),
                }]]),
            }]]), owner)
        },
        loopEntryWithoutFunctionOwner: () => {
            const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
            return liftValueReturns(['block', yielded([9], [['loop', {
                target, parameters: [id()], initial: [['block', returned(7)]],
                results: [], body: body(['break', target, []]),
            }]])], id(), null)
        },
        transferPayloadForeignReturn: () => {
            const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
            return liftReturns(body(['return', owner, 9], [['loop', {
                target, parameters: [], initial: [], results: [id()], body: body(['break', target, [['block', body(['return', other, 7])]]]),
            }]]), owner)
        },
        transferPayloadCannotEscapeToContainingLoop: () => {
            const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
            return liftReturns(body(['return', owner, 9], [['loop', {
                target, parameters: [id()], initial: [0], results: [], body: body(['continue', target, [['block', body(['continue', target, [3]])]]]),
            }]]), owner)
        },
        captureForeignReturn: () => liftValueReturns(['function', {
            target: other, parameters: [], rest: null, self: null,
            captures: [{ binding: id(), value: ['block', body(['return', other, 3])] }], body: body(['return', other, 9]),
        }], id(), owner),
        captureWithoutOwner: () => liftValueReturns(['function', {
            target: other, parameters: [], rest: null, self: null,
            captures: [{ binding: id(), value: ['block', returned(3)] }], body: body(['return', other, 9]),
        }], id(), null),
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
