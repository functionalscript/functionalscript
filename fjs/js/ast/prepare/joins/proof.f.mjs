/**
 * Immutable join extraction preserves required evaluation, sharing and transfer
 * ownership. These fixtures construct normalized FAST directly and execute its
 * graph representation without a native JavaScript compilation boundary.
 *
 * @import { BindingId, Block, Function as FastFunction, Loop, Statement, Value } from '../../types.ts'
 * @import { ValueResult } from '../../../../edag/value/control/types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../../asserts/module.f.js'
import { identityAnalysis } from '../../../../edag/analysis/module.f.mjs'
import { fromFast } from '../../../../edag/from_fast/module.f.mjs'
import { memo } from '../../../../edag/memo/module.f.mjs'
import { toData } from '../../../../edag/value/to_unknown/module.f.mjs'
import { _freshAtRoot, _immutableJoin } from './module.f.mjs'

/** Equal presentation indices retain independent binding identities. @type {() => BindingId} */
const id = () => ({ index: 0 })

/** @type {(binding: BindingId) => Value} */
const ref = binding => ['ref', binding]

/** @type {(exit: Block['exit'], statements?: readonly Statement[]) => Block} */
const block = (exit, statements = []) => ({ statements, exit })

/** @type {(value: Value) => Block} */
const yielded = value => block(['yield', [value]])

/** The ordinary loop completes once; the terminal loop has no normal exit. @type {(terminal: boolean) => Loop} */
const loopFixture = terminal => {
    const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
    return { target, parameters: [], initial: [], results: [],
        body: block(terminal ? ['continue', target, []] : ['break', target, []]) }
}

/** @type {(value: Value, captures?: FastFunction['captures']) => Value} */
const constant = (value, captures = []) => {
    const target = /** @type {const} */ ({ kind: 'function', index: 0 })
    return ['function', { target, parameters: [], rest: null, self: null, captures,
        body: block(['return', target, value]) }]
}

/** Required prefix and suffix allocations expose accidental duplication. */
const fixture = () => {
    const target = /** @type {const} */ ({ kind: 'function', index: 0 })
    const selected = id(), stop = id(), operation = id(), rest = id()
    const prefix = id(), local = id(), joined = id(), result = id(), captured = id()
    /** @type {FastFunction} */
    const fn = { target, parameters: [selected, stop, operation], rest, self: null,
        captures: [{ binding: captured, value: 19 }], body: block(['return', target, ['array', [ref(result), ref(result)]]], [
            ['define', prefix, ['array', [ref(rest), ref(captured)]], 'required'],
            ['if', [joined], ref(selected), block(['yield', [ref(local)]], [
                ['define', local, ['array', [7]], 'required'],
                ['if', [], ref(stop), block(['return', target, 42]), block(['yield', []])],
            ]), yielded(ref(prefix))],
            ['define', result, ['()', ref(operation), [ref(joined), ref(prefix)]], 'required'],
        ]) }
    return { fn, selected, stop, operation, rest, prefix, local, joined, result, captured }
}

/** @type {(fn: FastFunction, args?: readonly Value[]) => ValueResult} */
const called = (fn, args = []) => memo(assertOk(identityAnalysis(fromFast(block([
    'yield', [['()', ['function', fn], args]],
])))))({ args: [] })

/** @type {(fn: FastFunction, args?: readonly Value[]) => unknown} */
const evaluated = (fn, args = []) => assertOk(toData(assertOk(called(fn, args))))

/** @type {(fn: FastFunction, value: Value) => FastFunction} */
const returned = (fn, value) => ({ ...fn, body: { ...fn.body, exit: ['return', fn.target, value] } })

/** @type {(fn: FastFunction, statements: readonly Statement[]) => FastFunction} */
const statements = (fn, statements) => ({ ...fn, body: { ...fn.body, statements } })

/** @type {(fn: FastFunction) => Extract<Statement, readonly ['if', unknown, unknown, unknown, unknown]>} */
const joinOf = fn => {
    const statement = fn.body.statements[1]
    assert(statement[0] === 'if')
    return statement
}

/** @type {(fn: FastFunction, value: Value) => FastFunction} */
const joinCondition = (fn, value) => {
    const join = joinOf(fn)
    return statements(fn, [fn.body.statements[0], ['if', join[1], value, join[3], join[4]], ...fn.body.statements.slice(2)])
}

/** @type {(fn: FastFunction, then: Block, otherwise: Block) => FastFunction} */
const joinArms = (fn, then, otherwise) => {
    const join = joinOf(fn)
    return statements(fn, [fn.body.statements[0], ['if', join[1], join[2], then, otherwise], ...fn.body.statements.slice(2)])
}

/** One callback invocation creates one represented allocation. */
const duplicate = () => {
    const target = /** @type {const} */ ({ kind: 'function', index: 0 })
    const first = id(), second = id()
    /** @type {Value} */
    const value = ['function', { target, parameters: [first, second], rest: null, self: null, captures: [],
        body: block(['return', target, ['array', [ref(first), ref(first), ref(second), ref(second)]]]) }]
    return value
}

/** @type {(fn: FastFunction) => FastFunction} */
const accepted = fn => {
    const result = _immutableJoin(fn)
    assert(result !== fn)
    return result
}

/** @type {(fn: FastFunction) => void} */
const rejected = fn => { assertEq(_immutableJoin(fn), fn) }

/** @type {(fn: FastFunction) => FastFunction} */
const helperOf = fn => {
    const decision = fn.body.statements.findIndex(statement => statement[0] === 'if')
    const statement = fn.body.statements[decision - 1]
    assert(statement !== undefined && statement[0] === 'define')
    assertEq(statement[3], 'required')
    const value = statement[2]
    assert(value instanceof Array && value[0] === 'function')
    return value[1]
}

/** @type {(fn: FastFunction) => Extract<Statement, readonly ['if', unknown, unknown, unknown, unknown]>} */
const decisionOf = fn => {
    const statement = fn.body.statements.find(statement => statement[0] === 'if')
    assert(statement !== undefined && statement[0] === 'if')
    assertEq(statement[1].length, 0)
    return statement
}

export const proof = /** @type {const} */ ({
    requiredPrefixAndSuffixPreserveAllocationIdentity: () => {
        const { fn } = fixture()
        const transformed = _immutableJoin(fn)
        assert(transformed !== fn)
        assertEq(transformed.target, fn.target)
        assertEq(transformed.parameters, fn.parameters)
        assertEq(transformed.rest, fn.rest)
        assertEq(transformed.captures, fn.captures)
        assertEq(transformed.body.statements[0], fn.body.statements[0])
        const operation = duplicate()
        for (const selected of /** @type {const} */ ([false, true])) {
            const args = /** @type {const} */ ([selected, false, operation, 5, 6])
            const original = evaluated(fn, args)
            const actual = evaluated(transformed, args)
            assertStructurallySame(actual, original)
            assert(actual instanceof Array)
            assertEq(actual[0], actual[1])
            const callbackResult = actual[0]
            assert(callbackResult instanceof Array)
            assertEq(callbackResult[0], callbackResult[1])
            assertEq(callbackResult[2], callbackResult[3])
            assertStructurallySame(callbackResult[2], [[5, 6], 19])
            if (selected) { assertStructurallySame(callbackResult[0], [7]) }
            else { assertEq(callbackResult[0], callbackResult[2]) }
        }
    },
    owningReturnsAndThrowsSkipTheContinuation: () => {
        const { fn } = fixture()
        const failure = constant(0)
        assert(failure instanceof Array && failure[0] === 'function')
        /** @type {Value} */
        const throwing = ['function', { ...failure[1], body: block(['throw', 'suffix reached']) }]
        for (const source of [fn, _immutableJoin(fn)]) {
            assertEq(evaluated(source, [true, true, throwing]), 42)
            assertError(called(source, [false, true, throwing]))
        }
        const terminal = block(['throw', 'arm reached'])
        const throws = joinArms(fn, terminal, yielded(3))
        const transformed = _immutableJoin(throws)
        assert(transformed !== throws)
        assertError(called(transformed, [true, false, duplicate()]))
        assertStructurallySame(evaluated(transformed, [false, false, duplicate()]), evaluated(throws, [false, false, duplicate()]))
    },
    requiredPrefixFailuresPrecedeOwningEarlyReturns: () => {
        const { fn, prefix } = fixture()
        const source = statements(fn, [
            ['define', prefix, ['.', null, 'required prefix'], 'required'], ...fn.body.statements.slice(1),
        ])
        const transformed = accepted(source)
        assertEq(transformed.body.statements[0], source.body.statements[0])
        assertError(called(source, [true, true, duplicate()]))
        assertError(called(transformed, [true, true, duplicate()]))
    },
    helperOwnsOnlyTheSuffixReturnAndCapturesEstablishedValues: () => {
        const { fn, joined, operation, prefix } = fixture()
        const transformed = accepted(fn)
        const helper = helperOf(transformed)
        assert(helper.target !== fn.target)
        assertStructurallySame(helper.parameters, [joined])
        assertEq(helper.rest, null)
        assertEq(helper.self, null)
        assertEq(helper.body.statements.length, fn.body.statements.length - 2)
        assertEq(helper.body.statements[0], fn.body.statements[2])
        assert(helper.body.exit[0] === 'return' && fn.body.exit[0] === 'return')
        assertEq(helper.body.exit[1], helper.target)
        assertEq(helper.body.exit[2], fn.body.exit[2])
        assertStructurallySame(helper.captures.map(capture => capture.binding), [operation, prefix])
        for (const capture of helper.captures) { assertStructurallySame(capture.value, ref(capture.binding)) }
        const decision = decisionOf(transformed), original = joinOf(fn)
        assertEq(decision[2], original[2])
        assertEq(decision[3].statements[0], original[3].statements[0])
        assertStructurallySame(decision[3].statements[1], original[3].statements[1])
        for (const exit of [decision[3].exit, transformed.body.exit]) {
            assert(exit[0] === 'return')
            assertEq(exit[1], fn.target)
            const call = exit[2]
            assert(call instanceof Array && call[0] === '()')
            assertEq(call[2].length, 1)
        }
        assertStructurallySame(decision[4], block(['yield', []]))
    },
    onlyLexicallyFreeSuffixReadsBecomeHelperCaptures: () => {
        const { fn, joined, selected, rest, captured, prefix } = fixture()
        const free = id(), local = id(), innerBinding = id()
        const nested = constant(ref(innerBinding), [{ binding: innerBinding, value: ref(captured) }])
        /** @type {Value} */
        const result = ['array', [ref(joined), ref(selected), ref(rest), ref(captured), ref(prefix), ref(free), ref(selected), ref(local), nested]]
        const source = statements(returned({ ...fn, parameters: [...fn.parameters, free] }, result), [
            ...fn.body.statements.slice(0, 2), ['define', local, ref(joined), 'required'],
        ])
        const helper = helperOf(accepted(source))
        assertStructurallySame(helper.captures.map(capture => capture.binding), [selected, rest, captured, prefix, free])
        for (const capture of helper.captures) { assertStructurallySame(capture.value, ref(capture.binding)) }
    },
    emptyPrefixAndSuffixNeedNoSyntheticCaptures: () => {
        const { fn, joined } = fixture()
        const source = statements(returned(fn, ref(joined)), [
            ['if', [joined], true, yielded(1), yielded(2)],
        ])
        const transformed = accepted(source), helper = helperOf(transformed)
        assertEq(transformed.body.statements.length, 2)
        assertEq(helper.body.statements.length, 0)
        assertEq(helper.captures.length, 0)
        assertEq(evaluated(transformed), 1)
    },
    nestedZeroResultBranchesKeepNormalAndAbruptOwnership: () => {
        const { fn, stop } = fixture()
        const returnedEarly = block(['return', fn.target, 13])
        const thrown = block(['throw', 'nested throw'])
        for (const then of [returnedEarly, thrown]) {
            for (const earlyFirst of /** @type {const} */ ([false, true])) {
                const empty = block(['yield', []])
                const nested = block(['yield', [3]], [
                    ['if', [], ref(stop), earlyFirst ? then : empty, earlyFirst ? empty : then],
                ])
                const source = joinArms(fn, nested, yielded(5))
                const transformed = accepted(source)
                const decision = decisionOf(transformed)
                assertStructurallySame(decision[3].statements[0], nested.statements[0])
                for (const stopped of /** @type {const} */ ([false, true])) {
                    const args = /** @type {const} */ ([true, stopped, duplicate()])
                    if (stopped === earlyFirst && then === thrown) { assertError(called(transformed, args)) }
                    else { assertStructurallySame(evaluated(transformed, args), evaluated(source, args)) }
                }
            }
        }
        const terminal = joinArms(fn, returnedEarly, thrown)
        const transformed = accepted(terminal)
        assertEq(decisionOf(transformed)[3].exit, returnedEarly.exit)
        assertEq(transformed.body.exit, thrown.exit)
    },
    falseArmDefinitionsFollowTheReturningGuard: () => {
        const { fn } = fixture()
        const local = id()
        const otherwise = block(['yield', [ref(local)]], [['define', local, ['array', [31]], 'required']])
        const source = joinArms(fn, yielded(3), otherwise)
        const transformed = accepted(source)
        assertEq(transformed.body.statements[3], otherwise.statements[0])
        assertStructurallySame(decisionOf(transformed)[4], block(['yield', []]))
        for (const selected of /** @type {const} */ ([false, true])) {
            const args = /** @type {const} */ ([selected, false, duplicate()])
            assertStructurallySame(evaluated(transformed, args), evaluated(source, args))
        }
        const failure = block(['yield', [0]], [['define', local, ['.', null, 'failure'], 'required']])
        const failing = joinArms(fn, yielded(7), failure)
        const guarded = accepted(failing)
        assertError(called(guarded, [false, false, duplicate()]))
        assertStructurallySame(evaluated(guarded, [true, false, duplicate()]), evaluated(failing, [true, false, duplicate()]))
    },
    falseArmShadowsKeepTheirExistingLexicalScope: () => {
        const { fn, selected, prefix } = fixture()
        const join = joinOf(fn)
        for (const binding of [selected, prefix]) {
            const local = id()
            const shadowed = joinArms(fn, join[3], block(['yield', [ref(binding)]], [
                ['define', binding, 0, 'required'],
            ]))
            const fresh = joinArms(fn, join[3], block(['yield', [ref(local)]], [
                ['define', local, 0, 'required'],
            ]))
            rejected(shadowed)
            accepted(fresh)
            for (const condition of /** @type {const} */ ([false, true])) {
                const args = /** @type {const} */ ([condition, false, duplicate()])
                assertStructurallySame(evaluated(shadowed, args), evaluated(fresh, args))
            }
        }
        const nested = joinArms(fn, join[3], block(['yield', [0]], [
            ['if', [], true, block(['yield', []], [['define', selected, 7, 'required']]), block(['yield', []])],
        ]))
        const transformed = accepted(nested)
        const args = /** @type {const} */ ([false, false, duplicate()])
        assertStructurallySame(evaluated(transformed, args), evaluated(nested, args))
    },
    rootFreshnessUsesBindingIdentityAndPriorScopes: () => {
        const { fn, selected, captured, rest, prefix } = fixture()
        for (const binding of [selected, captured, rest]) {
            assertEq(_freshAtRoot(fn, [], [binding]), false)
        }
        assertEq(_freshAtRoot(fn, [prefix], [prefix]), false)
        const empty = statements(returned({ ...fn, rest: null }, 0), [])
        assertEq(_freshAtRoot(empty, [], []), true)
        const local = id(), distinct = id()
        const loop = loopFixture(false)
        // The same ID denotes locals in two original lexical regions. Moving
        // both to one root would create two declarations of that identity.
        const nested = statements(returned(fn, 0), [['loop', { ...loop, body: { ...loop.body, statements: [
            ['define', local, 1, 'required'],
            ['if', [], true, block(['yield', []]), block(['yield', []], [['define', local, 2, 'required']])],
        ] } }]])
        assertEq(_freshAtRoot(nested, [], [local, local]), false)
        assertEq(_freshAtRoot(nested, [], [local, distinct]), true)
    },
    unsupportedFunctionProfilesRetainInputIdentity: () => {
        const { fn, joined } = fixture()
        const local = id()
        rejected({ ...fn, self: id() })
        rejected({ ...fn, body: block(['throw', 'terminal function'], fn.body.statements) })
        rejected(statements(returned(fn, 0), []))
        rejected(statements(returned(fn, 0), [fn.body.statements[0]]))
        /** @type {readonly (readonly BindingId[])[]} */
        const widths = [[], [joined, id()]]
        for (const results of widths) {
            const arm = block(['yield', results.map(() => 1)])
            rejected(statements(returned(fn, 0), [['if', results, true, arm, arm]]))
        }
        /** @type {readonly Statement[]} */
        const unsupported = [
            ['define', local, 0, 'lazy'],
            ['block', [], block(['yield', []])],
            ['if', [], true, block(['yield', []]), block(['yield', []])],
            ['loop', loopFixture(false)],
        ]
        for (const statement of unsupported) {
            rejected(statements(fn, [fn.body.statements[0], statement, ...fn.body.statements.slice(1)]))
            rejected(statements(fn, [...fn.body.statements.slice(0, 2), statement, ...fn.body.statements.slice(2)]))
        }
        rejected(statements(fn, [...fn.body.statements, ['if', [local], true, yielded(1), yielded(2)]]))
    },
    unsupportedBranchStatementsAndTransfersRetainInputIdentity: () => {
        const { fn } = fixture()
        const local = id(), nested = id()
        const lazy = block(['yield', []], [['define', local, 0, 'lazy']])
        /** @type {readonly Block[]} */
        const unsupported = [
            block(['loop', loopFixture(true)]),
            block(['yield', [1]], [['define', local, 0, 'lazy']]),
            block(['yield', [1]], [['block', [], block(['yield', []])]]),
            block(['yield', [1]], [['loop', loopFixture(false)]]),
            block(['yield', [1]], [['if', [nested], true, yielded(1), yielded(2)]]),
            block(['yield', [1]], [['if', [], true, lazy, block(['yield', []])]]),
            block(['yield', [1]], [['if', [], true, block(['yield', []]), lazy]]),
        ]
        for (const arm of unsupported) {
            rejected(joinArms(fn, arm, yielded(2)))
            rejected(joinArms(fn, yielded(2), arm))
        }
    },
    valueRegionsAreRejectedWhereverEvaluationWouldMove: () => {
        const { fn, prefix } = fixture()
        const local = id()
        /** @type {readonly Value[]} */
        const forbidden = [['block', yielded(1)], ['if', true, yielded(1), yielded(2)]]
        for (const value of forbidden) {
            rejected(returned(fn, value))
            rejected(joinCondition(fn, value))
            rejected(statements(fn, [['define', prefix, value, 'required'], ...fn.body.statements.slice(1)]))
            rejected(statements(fn, [...fn.body.statements.slice(0, 2), ['define', local, value, 'required'], ...fn.body.statements.slice(2)]))
            rejected(joinArms(fn, yielded(value), yielded(2)))
            rejected(joinArms(fn, block(['return', fn.target, value]), yielded(2)))
            rejected(joinArms(fn, block(['throw', value]), yielded(2)))
            rejected(joinArms(fn, block(['yield', [1]], [['define', local, value, 'required']]), yielded(2)))
            rejected(joinArms(fn, block(['yield', [1]], [['if', [], value, block(['yield', []]), block(['yield', []])]]), yielded(2)))
            const binding = id()
            rejected(returned(fn, constant(0, [{ binding, value }])))
            rejected(returned(fn, constant(0, [{ binding, value: constant(0, [{ binding: id(), value }]) }])))
        }
    },
    ordinaryOperatorsRemainInTheirOriginalSuffix: () => {
        const { fn, selected } = fixture()
        const read = ref(selected)
        /** @type {readonly Value[]} */
        const values = [
            undefined, null, false, 1, 1n, 'value', read,
            ['entry'], ['hasEntry'], ['Number.isFinite'],
            ['!', read], ['+', read], ['+', read, 1], ['instanceof', read, 'Array'], ['in', 'key', read],
            ['memberPresent', read, 'key'], ['memberPresent', read, ['Number', read]],
            ['array', [read, ['...', read]]], ['object', [[':', read, read], ['...', read]]],
            ['.', read, 'key'], ['?.', read, 0], ['.', read, ['Number', read]],
            ['()', read, [read, ['...', read]]], ['?.()', read, []],
            ['?:', read, 1, 2], [',', [read, 3]],
            ['?.', read, 'key', ['|.', 'next']],
            ['?.', read, 'key', ['|.', ['Number', read], ['|()', [read]]]],
            ['?.', read, 0, ['|()', [['...', read]], ['|.', 'next', ['|?.()', [read], ['|.', 'last', ['|!()', []]]]]]],
            ['?.()', read, [], ['|.', 0, ['|!()', [read]]]],
        ]
        for (const value of values) {
            const source = returned(fn, value)
            const helper = helperOf(accepted(source))
            assert(helper.body.exit[0] === 'return')
            assertEq(helper.body.exit[2], value)
        }
        /** @type {Value} */
        const forbidden = ['block', yielded(9)]
        /** @type {readonly Value[]} */
        const wrapped = [
            ['!', forbidden], ['+', 0, forbidden], ['array', [['...', forbidden]]],
            ['object', [[':', 0, forbidden]]], ['object', [['...', forbidden]]],
            ['.', 0, ['Number', forbidden]], ['memberPresent', 0, ['Number', forbidden]],
            ['()', 0, [forbidden]], ['?.()', 0, [], ['|.', ['Number', forbidden]]],
            ['.', 0, 0, ['|?.()', [], ['|.', 0, ['|!()', [forbidden]]]]],
        ]
        for (const value of wrapped) { rejected(returned(fn, value)) }
    },
    readonlyFunctionCapturesAreScannedAndBodiesStayOpaque: () => {
        const { fn, captured } = fixture()
        const first = id(), second = id()
        /** @type {Value} */
        const body = ['block', yielded(['if', true, yielded(1), yielded(2)])]
        const nested = constant(body, [{ binding: first, value: constant(0, [{ binding: second, value: ref(captured) }]) }])
        const source = statements(returned(fn, nested), fn.body.statements.slice(0, 2))
        const helper = helperOf(accepted(source))
        assertStructurallySame(helper.captures.map(capture => capture.binding), [captured])
        assert(helper.body.exit[0] === 'return')
        assertEq(helper.body.exit[2], nested)
        const opaque = statements(returned(fn, constant(body)), fn.body.statements.slice(0, 2))
        assertEq(helperOf(accepted(opaque)).captures.length, 0)
    },
    deepOperatorInputsUseAnExplicitWorkStack: () => {
        const { fn, selected } = fixture()
        /** @type {Value} */
        let value = ref(selected)
        for (let depth = 0; depth < 20_000; depth += 1) { value = ['!', value] }
        const source = statements(returned(fn, value), fn.body.statements.slice(0, 2))
        const helper = helperOf(accepted(source))
        assert(helper.body.exit[0] === 'return')
        assertEq(helper.body.exit[2], value)
        assertStructurallySame(helper.captures.map(capture => capture.binding), [selected])
    },
})
