/**
 * Recover canonical invocation wrappers only when their body fits the ordinary
 * immutable join profile. Represented execution checks required work, sharing
 * and transfer owners without a target compilation boundary.
 *
 * @import { BindingId, Block, Function as FastFunction, Loop, LoopTarget, Statement, Value } from '../../types.ts'
 * @import { ValueResult } from '../../../../edag/value/control/types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../../asserts/module.f.js'
import { identityAnalysis } from '../../../../edag/analysis/module.f.mjs'
import { fromFast } from '../../../../edag/from_fast/module.f.mjs'
import { invocationRootOf } from '../../../../edag/from_fast/loop/root/module.f.mjs'
import { memo } from '../../../../edag/memo/module.f.mjs'
import { toData } from '../../../../edag/value/to_unknown/module.f.mjs'
import { _recoverOnePassJoin } from './module.f.mjs'

/** Equal debug indices preserve independent lexical identities. @type {() => BindingId} */
const id = () => ({ index: 0 })
/** @type {(binding: BindingId) => Value} */
const ref = binding => ['ref', binding]
/** @type {(exit: Block['exit'], statements?: readonly Statement[]) => Block} */
const block = (exit, statements = []) => ({ statements, exit })
/** @type {(value: Value) => Block} */
const yielded = value => block(['yield', [value]])

/** One selected join precedes a shared required call and result. */
const fixture = (rest = false) => {
    const target = /** @type {const} */ ({ kind: 'function', index: 0 })
    const selected = id(), stop = id(), operation = id(), tail = id()
    const captured = id(), prefix = id(), joined = id(), result = id()
    /** @type {FastFunction} */
    const fn = { target, parameters: [selected, stop, operation], rest: rest ? tail : null, self: null,
        captures: [{ binding: captured, value: 19 }],
        body: block(['return', target, ['array', [ref(result), ref(result)]]], [
            ['define', prefix, ['array', [rest ? ref(tail) : ['array', []], ref(captured)]], 'required'],
            ['if', [joined], ref(selected), block(['yield', [3]], [
                ['if', [], ref(stop), block(['return', target, 42]), block(['yield', []])],
            ]), yielded(0)],
            ['define', result, ['()', ref(operation), [ref(joined), ref(prefix)]], 'required'],
        ]) }
    return { fn, selected, stop, operation, captured, prefix, joined, result }
}

/** Wrap these fixtures' owning statement returns without entering value owners. @type {(source: Block, target: LoopTarget) => Block} */
const returnsAsBreaks = (source, target) => ({
    statements: source.statements.map(/** @returns {Statement} */ statement => statement[0] === 'if'
        ? ['if', statement[1], statement[2], returnsAsBreaks(statement[3], target), returnsAsBreaks(statement[4], target)] : statement),
    exit: source.exit[0] === 'return' ? ['break', target, [source.exit[2]]] : source.exit,
})

/** Fresh entry IDs remain distinct from the invocation's current inputs. */
const wrapped = (source = fixture().fn, aliases = false) => {
    const entry = source.parameters.map(id), rest = source.rest === null ? null : id()
    /** @type {readonly BindingId[]} */
    const inputs = [...entry, ...(rest === null ? [] : [rest])]
    const first = inputs.map(id), second = inputs.map(id), output = id()
    /** @type {readonly Statement[]} */
    const prefix = aliases ? inputs.flatMap((binding, index) => [
        ['define', first[index], ref(binding), 'lazy'], ['define', second[index], ref(first[index]), 'required'],
    ]) : []
    const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
    /** @type {Loop} */
    const loop = { target, parameters: [...source.parameters, ...(source.rest === null ? [] : [source.rest])],
        initial: (aliases ? second : inputs).map(ref), results: [output], body: returnsAsBreaks(source.body, target) }
    /** @type {FastFunction} */
    const fn = { ...source, parameters: entry, rest,
        body: block(['return', source.target, ref(output)], [...prefix, ['loop', loop]]) }
    return { fn, loop, prefix, inputs }
}

/** @type {(fn: FastFunction, loop: Loop) => FastFunction} */
const withLoop = (fn, loop) => ({ ...fn, body: { ...fn.body,
    statements: [...fn.body.statements.slice(0, -1), ['loop', loop]],
} })

/** @type {(fn: FastFunction, statements: readonly Statement[]) => FastFunction} */
const statements = (fn, statements) => ({ ...fn, body: { ...fn.body, statements } })
/** @type {(fn: FastFunction, value: Value) => FastFunction} */
const returned = (fn, value) => ({ ...fn, body: { ...fn.body, exit: ['return', fn.target, value] } })
/** @type {(fn: FastFunction) => Extract<Statement, readonly ['if', unknown, unknown, unknown, unknown]>} */
const joinOf = fn => {
    const join = fn.body.statements[1]
    assert(join[0] === 'if')
    return join
}
/** @type {(terminal?: boolean) => Loop} */
const nestedLoop = (terminal = false) => {
    const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
    return { target, parameters: [], initial: [], results: [],
        body: block(terminal ? ['continue', target, []] : ['break', target, []]) }
}

/** @type {(fn: FastFunction, args?: readonly Value[]) => ValueResult} */
const called = (fn, args = []) => memo(assertOk(identityAnalysis(fromFast(block([
    'yield', [['()', ['function', fn], args]],
])))))({ args: [] })
/** @type {(fn: FastFunction, args?: readonly Value[]) => unknown} */
const evaluated = (fn, args = []) => assertOk(toData(assertOk(called(fn, args))))
/** @type {(fn: FastFunction) => FastFunction} */
const accepted = fn => {
    const result = _recoverOnePassJoin(fn)
    assert(result !== fn)
    assert(!result.body.statements.some(statement => statement[0] === 'loop'))
    return result
}
/** @type {(fn: FastFunction) => void} */
const rejected = fn => { assertEq(_recoverOnePassJoin(fn), fn) }

/** @type {(throws?: boolean) => Value} */
const operation = (throws = false) => {
    const target = /** @type {const} */ ({ kind: 'function', index: 0 })
    const first = id(), second = id()
    return ['function', { target, parameters: [first, second], rest: null, self: null, captures: [],
        body: block(throws ? ['throw', 'selected suffix'] : ['return', target,
            ['array', [ref(first), ref(first), ref(second), ref(second)]],
        ]) }]
}

export const proof = /** @type {const} */ ({
    onePassWrappersKeepRequiredSharingAndEarlyReturns: () => {
        const { fn, loop } = wrapped()
        assertEq(invocationRootOf(fn), loop)
        const result = accepted(fn)
        assertEq(result.target, fn.target)
        assertEq(result.parameters, fn.parameters)
        assertEq(result.captures, fn.captures)
        assertEq(result.rest, null)
        assertEq(result.self, null)
        for (const selected of /** @type {const} */ ([false, true])) {
            for (const stop of /** @type {const} */ ([false, true])) {
                const args = /** @type {const} */ ([selected, stop, operation()])
                const actual = evaluated(result, args)
                assertStructurallySame(actual, evaluated(fn, args))
                if (selected && stop) { assertEq(actual, 42) }
                else {
                    assert(actual instanceof Array)
                    assertEq(actual[0], actual[1])
                    const allocation = actual[0]
                    assert(allocation instanceof Array)
                    assertEq(allocation[2], allocation[3])
                    assertStructurallySame(allocation, [selected ? 3 : 0, selected ? 3 : 0, [[], 19], [[], 19]])
                }
            }
        }
        assertEq(evaluated(result, [true, true, operation(true)]), 42)
        assertError(called(result, [false, false, operation(true)]))
    },
    entryAliasesAndCurrentInputSnapshotsStayRequiredAndOrdered: () => {
        const source = fixture(true).fn
        const { fn, prefix, loop } = wrapped(source, true)
        assertEq(invocationRootOf(fn), loop)
        const result = accepted(fn)
        const aliases = result.body.statements.slice(0, prefix.length + loop.parameters.length)
        assertEq(aliases.length, prefix.length + loop.parameters.length)
        for (const [index, statement] of aliases.entries()) {
            assert(statement[0] === 'define')
            assertEq(statement[3], 'required')
            const original = index < prefix.length ? prefix[index] : null
            if (original !== null) {
                assert(original[0] === 'define')
                assertEq(statement[1], original[1])
                assertEq(statement[2], original[2])
            } else {
                assertEq(statement[1], loop.parameters[index - prefix.length])
                assertEq(statement[2], loop.initial[index - prefix.length])
            }
        }
        assertEq(result.rest, fn.rest)
        const args = /** @type {const} */ ([false, false, operation(), 7, 8])
        assertStructurallySame(evaluated(result, args), evaluated(fn, args))
        const actual = evaluated(result, args)
        assert(actual instanceof Array && actual[0] instanceof Array)
        assertStructurallySame(actual[0][2], [[7, 8], 19])
    },
    loopInputShadowingKeepsItsExistingLexicalBoundary: () => {
        const { fn, loop } = wrapped()
        const shared = loop.parameters[0]
        /** @type {readonly Value[]} */
        const initial = [ref(shared), ...loop.initial.slice(1)]
        const parameter = withLoop({ ...fn, parameters: [shared, ...fn.parameters.slice(1)] }, { ...loop, initial })
        const aliased = statements(fn, [
            ['define', shared, ref(fn.parameters[0]), 'required'], ['loop', { ...loop, initial }],
        ])
        /** @type {FastFunction} */
        const captured = { ...fn, captures: [...fn.captures, { binding: shared, value: true }] }
        const args = /** @type {const} */ ([false, false, operation()])
        for (const original of [parameter, aliased, captured]) {
            assert(invocationRootOf(original) !== null)
            rejected(original)
            assertStructurallySame(evaluated(original, args), evaluated(fn, args))
        }
        const rest = wrapped(fixture(true).fn)
        const tail = rest.loop.parameters.at(-1)
        assert(tail !== undefined)
        const original = withLoop({ ...rest.fn, rest: tail }, { ...rest.loop,
            initial: [...rest.loop.initial.slice(0, -1), ref(tail)],
        })
        assert(invocationRootOf(original) !== null)
        rejected(original)
        const restArgs = /** @type {const} */ ([false, false, operation(), 7, 8])
        assertStructurallySame(evaluated(original, restArgs), evaluated(rest.fn, restArgs))
    },
    liftedLocalsRetainTheirOriginalScopes: () => {
        const { fn: source, prefix } = fixture()
        const baseline = wrapped(source)
        const bodyPrefix = withLoop({ ...baseline.fn, parameters: [prefix, ...baseline.fn.parameters.slice(1)] }, {
            ...baseline.loop, initial: [ref(prefix), ...baseline.loop.initial.slice(1)],
        })
        const join = joinOf(source)
        const otherwise = block(['yield', [ref(prefix)]], [['define', prefix, 0, 'required']])
        const shadowed = statements(source, [source.body.statements[0],
            ['if', join[1], join[2], join[3], otherwise], ...source.body.statements.slice(2),
        ])
        const falseArm = wrapped(shadowed).fn
        const args = /** @type {const} */ ([false, false, operation()])
        for (const original of [bodyPrefix, falseArm]) {
            assert(invocationRootOf(original) !== null)
            rejected(original)
            assertStructurallySame(evaluated(original, args), evaluated(baseline.fn, args))
        }
    },
    recoveredReturnsKeepFunctionOwnersAndRequiredPrefixFailures: () => {
        const source = fixture().fn
        const { fn } = wrapped(source)
        const result = accepted(fn)
        const definition = result.body.statements[result.parameters.length + 1]
        assert(definition[0] === 'define')
        const value = definition[2]
        assert(value instanceof Array && value[0] === 'function')
        const helper = value[1]
        assert(helper.target !== fn.target)
        assertEq(helper.body.statements.length, 1)
        assertEq(helper.body.statements[0], source.body.statements[2])
        assert(helper.body.exit[0] === 'return')
        assertEq(helper.body.exit[1], helper.target)
        const guard = result.body.statements[result.parameters.length + 2]
        assert(guard[0] === 'if' && guard[3].exit[0] === 'return')
        assertEq(guard[3].exit[1], fn.target)
        const early = guard[3].statements[0]
        assert(early[0] === 'if' && early[3].exit[0] === 'return')
        assertEq(early[3].exit[1], fn.target)
        const failedPrefix = source.body.statements[0]
        assert(failedPrefix[0] === 'define')
        const failed = wrapped(statements(source, [
            ['define', failedPrefix[1], ['.', null, 'required prefix'], 'required'], ...source.body.statements.slice(1),
        ])).fn
        assertError(called(failed, [true, true, operation()]))
        assertError(called(accepted(failed), [true, true, operation()]))
    },
    allocationsStayFreshAcrossCallsToOneRecoveredClosure: () => {
        const fn = accepted(wrapped().fn)
        const callee = id(), first = id(), second = id()
        const args = /** @type {const} */ ([false, false, operation()])
        const graph = fromFast(block(['yield', [['array', [ref(first), ref(second)]]]], [
            ['define', callee, ['function', fn], 'required'],
            ['define', first, ['()', ref(callee), args], 'required'],
            ['define', second, ['()', ref(callee), args], 'required'],
        ]))
        const actual = assertOk(toData(assertOk(memo(assertOk(identityAnalysis(graph)))({ args: [] }))))
        assert(actual instanceof Array)
        const left = actual[0], right = actual[1]
        assert(left instanceof Array && right instanceof Array)
        assertEq(left[0], left[1])
        assertEq(right[0], right[1])
        assert(left[0] !== right[0])
    },
    genuineInvocationBackedgesKeepTheOriginalLoop: () => {
        const { fn, loop } = wrapped()
        const again = block(['continue', loop.target, [false, ref(loop.parameters[1]), ref(loop.parameters[2])]])
        const repeated = withLoop(fn, { ...loop, body: { ...loop.body, statements: [
            ['if', [], ref(loop.parameters[0]), again, block(['yield', []])], ...loop.body.statements,
        ] } })
        assert(invocationRootOf(repeated) !== null)
        rejected(repeated)
        assertStructurallySame(evaluated(repeated, [true, false, operation()]), evaluated(fn, [false, false, operation()]))
        rejected({ ...fn, self: id() })
    },
    ordinaryFunctionsAndNoncanonicalWrappersRetainInputIdentity: () => {
        const source = fixture().fn
        rejected(source)
        const { fn, loop } = wrapped(source)
        const output = loop.results[0], other = id(), local = id()
        rejected(returned(fn, ['array', [ref(output)]]))
        const pair = withLoop(fn, { ...loop, results: [output, other], body: block(['break', loop.target, [1, 2]]) })
        rejected(returned(pair, ['array', [ref(output), ref(other)]]))
        rejected(withLoop(fn, { ...loop, initial: loop.initial.map(() => 0) }))
        rejected(statements(fn, [...fn.body.statements, ['define', local, 0, 'required']]))
        rejected(statements(fn, [['define', local, ['array', []], 'required'], ...fn.body.statements]))
    },
    unsupportedRecoveredBodiesKeepTheirWrapperIdentity: () => {
        const source = fixture().fn
        const join = joinOf(source), local = id(), second = id()
        /** @type {readonly FastFunction[]} */
        const unsupported = [
            statements(returned(source, 7), []),
            statements(source, [['define', local, 0, 'lazy'], ...source.body.statements]),
            statements(source, [...source.body.statements, ['define', local, 0, 'lazy']]),
            statements(source, [source.body.statements[0], ['loop', nestedLoop()], ...source.body.statements.slice(1)]),
            statements(source, [source.body.statements[0], ['block', [], block(['yield', []])], ...source.body.statements.slice(1)]),
            statements(source, [...source.body.statements, ['if', [local], true, yielded(1), yielded(2)]]),
            statements(source, [source.body.statements[0], ['if', [join[1][0], second], join[2],
                block(['yield', [1, 2]]), block(['yield', [3, 4]])], ...source.body.statements.slice(2)]),
            statements(source, [source.body.statements[0], ['if', join[1], join[2],
                block(['loop', nestedLoop(true)]), join[4]], ...source.body.statements.slice(2)]),
            returned(source, ['block', yielded(9)]),
        ]
        for (const candidate of unsupported) {
            const { fn, loop } = wrapped(candidate)
            assertEq(invocationRootOf(fn), loop)
            rejected(fn)
        }
    },
    hiddenLoopTransfersAndCaptureControlsRetainTheirOwner: () => {
        const { fn, loop } = wrapped()
        const local = id(), captured = id()
        const target = /** @type {const} */ ({ kind: 'function', index: 0 })
        /** @type {readonly Value[]} */
        const values = [
            ['block', block(['break', loop.target, [13]])],
            ['block', block(['continue', loop.target, loop.parameters.map(ref)])],
            ['function', { target, parameters: [], rest: null, self: null,
                captures: [{ binding: captured, value: ['block', block(['break', loop.target, [13]])] }],
                body: block(['return', target, ref(captured)]) }],
        ]
        for (const value of values) {
            const original = withLoop(fn, { ...loop, body: { ...loop.body,
                statements: [['define', local, value, 'required'], ...loop.body.statements],
            } })
            assert(invocationRootOf(original) !== null)
            rejected(original)
        }
    },
    ordinaryNestedFunctionBodiesKeepTheirIndependentOwners: () => {
        const source = fixture().fn
        const target = /** @type {const} */ ({ kind: 'function', index: 0 })
        const self = id()
        /** @type {Value} */
        const value = ['function', { target, parameters: [], rest: null, self, captures: [],
            body: block(['return', target, ref(self)], [['loop', nestedLoop()]]) }]
        const candidate = returned(source, value)
        const { fn } = wrapped(candidate)
        const result = accepted(fn)
        const definition = result.body.statements[result.parameters.length + 1]
        assert(definition[0] === 'define')
        const helper = definition[2]
        assert(helper instanceof Array && helper[0] === 'function' && helper[1].body.exit[0] === 'return')
        assertEq(helper[1].body.exit[2], value)
        assert(value instanceof Array && value[0] === 'function')
        assert(value[1].body.exit[0] === 'return')
        assertEq(value[1].body.exit[1], target)
        assertEq(value[1].self, self)
    },
})
