/**
 * Forwarding a normal result changes its result signature alone. Tests use
 * matching region widths and retain the lexical owners of abrupt branches.
 *
 * @import { BindingId, Block, Function as FastFunction, Statement, Value } from '../types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { evaluate } from '../../../edag/from_fast/member_returns/proof.f.mjs'
import { fromFast } from '../../../edag/from_fast/module.f.mjs'
import { _joinResults } from '../../../edag/to_fast/join/module.f.mjs'
import { _sourceLoops } from '../../../edag/to_fast/source/loops/module.f.mjs'
import { _forwardResult } from './module.f.js'

/** Equal presentation indices keep distinct nominal identities. @type {() => BindingId} */
const id = () => ({ index: 0 })
/** @type {(binding: BindingId) => Value} */
const ref = binding => ['ref', binding]
/** @type {(exit: Block['exit'], statements?: readonly Statement[]) => Block} */
const block = (exit, statements = []) => ({ statements, exit })
/** @type {(value: Value) => Block} */
const yielded = value => block(['yield', [value]])
/** @type {(results: readonly BindingId[], inner: readonly BindingId[], test: Value, then: Block, otherwise: Block, exit: Block['exit']) => Statement} */
const forwarding = (results, inner, test, then, otherwise, exit) => ['block', results,
    block(exit, [['if', inner, test, then, otherwise]])]
/** @type {(statement: Statement) => void} */
const unchanged = statement => { assertEq(_forwardResult(statement), statement) }
/** @type {(fn: FastFunction, args?: readonly import('../../../edag/types.ts').Exp[]) => unknown} */
const called = (fn, args = []) => evaluate(['()', fromFast(yielded(['function', fn])), args])

export const proof = /** @type {const} */ ({
    forwardingPreservesTheOuterSignatureAndBothBranches: () => {
        const out = id(), inner = id()
        /** @type {readonly BindingId[]} */
        const results = [out]
        /** @type {Value} */
        const test = ['===', 1, 1]
        const then = yielded(['array', [1]]), otherwise = yielded(['array', [2]])
        const source = forwarding(results, [inner], test, then, otherwise, ['yield', [ref(inner)]])
        const result = _forwardResult(source)
        assert(result[0] === 'if')
        assertEq(result[1], results)
        assertEq(result[2], test)
        assertEq(result[3], then)
        assertEq(result[4], otherwise)
        assertEq(result[1][0], out)
        for (const statement of /** @type {const} */ ([source, result])) {
            assertStructurallySame(evaluate(fromFast(block(['yield', [ref(out)]], [statement]))), [1])
        }
    },
    lexicalShadowsAndCaptureReadsKeepTheirExistingBindings: () => {
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const nested = /** @type {const} */ ({ kind: 'function', index: 0 })
        const out = id(), inner = id(), final = id(), saved = id(), first = id(), second = id()
        /** @type {Value} */
        const captured = ['function', { target: nested, parameters: [], rest: null, self: null,
            captures: [{ binding: first, value: ref(out) }, { binding: second, value: ref(inner) }],
            body: block(['return', nested, ['array', [ref(first), ref(second)]]]) }]
        /** @type {Value} */
        const test = ['===', ref(inner), 1]
        const then = block(['yield', [ref(out)]], [
            ['define', saved, captured, 'required'], ['define', out, ['array', [7]], 'required'],
        ])
        const otherwise = yielded(['array', [ref(out), ref(inner)]])
        const source = forwarding([out], [inner], test, then, otherwise, ['yield', [ref(inner)]])
        const result = _forwardResult(source)
        assert(result[0] === 'if')
        assertEq(result[2], test)
        assertEq(result[3], then)
        assertEq(result[4], otherwise)
        assertEq(result[3].statements[0], then.statements[0])
        for (const statement of /** @type {const} */ ([source, result])) {
            /** @type {FastFunction} */
            const fn = { target: owner, parameters: [out, inner], rest: null, self: null, captures: [],
                body: block(['return', owner, ['array', [ref(out), ref(inner), ref(final)]]], [
                    ['block', [final], block(['yield', [ref(out)]], [statement])],
                ]) }
            assertStructurallySame(called(fn, [9, 1]), [9, 1, [7]])
            assertStructurallySame(called(fn, [9, 2]), [9, 2, [9, 2]])
        }
    },
    abruptArmsRetainTheirEnclosingFunctionAndLoopOwners: () => {
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const out = id(), inner = id(), state = id(), completed = id()
        /** @type {readonly Block['exit'][]} */
        const exits = [['return', owner, 13], ['break', target, [13]], ['continue', target, [['+', ref(state), 1]]]]
        for (const exit of exits) {
            const then = block(exit), otherwise = yielded(2)
            /** @type {Value} */
            const test = exit[0] === 'continue' ? ['<', ref(state), 1] : true
            const source = forwarding([out], [inner], test, then, otherwise, ['yield', [ref(inner)]])
            const result = _forwardResult(source)
            assert(result[0] === 'if')
            assertEq(result[3], then)
            assertEq(result[3].exit, exit)
            for (const statement of /** @type {const} */ ([source, result])) {
                /** @type {FastFunction} */
                const fn = { target: owner, parameters: [], rest: null, self: null, captures: [], body: block(['return', owner, ref(completed)], [
                    ['loop', { target, parameters: [state], initial: [0], results: [completed],
                        body: block(['break', target, [ref(out)]], [statement]) }],
                ]) }
                assertEq(called(fn), exit[0] === 'continue' ? 2 : 13)
            }
        }
    },
    validOutsideProfilesKeepTheOriginalStatementIdentity: () => {
        const out = id(), inner = id(), other = id(), second = id(), local = id()
        const normal = yielded(1), empty = block(['yield', []])
        /** @type {Statement} */
        const branch = ['if', [inner], true, normal, normal]
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        /** @type {readonly Statement[]} */
        const sources = [
            ['define', local, 0, 'required'], branch,
            ['loop', { target, parameters: [], initial: [], results: [], body: block(['break', target, []]) }],
            forwarding([], [], true, empty, empty, ['yield', []]),
            forwarding([out, other], [inner, second], true, block(['yield', [1, 2]]), block(['yield', [3, 4]]), ['yield', [ref(inner), ref(second)]]),
            ['block', [out], yielded(1)],
            ['block', [out], block(['yield', [ref(inner)]], [branch, ['define', local, 0, 'required']])],
            ['block', [out], block(['yield', [ref(inner)]], [['define', local, 0, 'required'], branch])],
            ['block', [out], block(['yield', [ref(inner)]], [['define', inner, 1, 'required']])],
            forwarding([out], [], true, empty, empty, ['yield', [1]]),
            forwarding([out], [inner, second], true, block(['yield', [1, 2]]), block(['yield', [3, 4]]), ['yield', [ref(inner)]]),
            forwarding([out], [inner], true, normal, normal, ['throw', 'following failure']),
            forwarding([out], [inner], true, normal, normal, ['yield', [0]]),
            forwarding([out], [inner], true, normal, normal, ['yield', [['array', []]]]),
            // `other` is an established caller input, distinct from the new join.
            forwarding([out], [inner], true, normal, normal, ['yield', [ref(other)]]),
        ]
        for (const source of sources) { unchanged(source) }
    },
    unreachableNormalExitDoesNotInventAResult: () => {
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const out = id(), inner = id()
        const source = forwarding([out], [inner], true, block(['return', owner, 7]), block(['throw', 'other arm']), ['yield', []])
        unchanged(source)
        /** @type {FastFunction} */
        const fn = { target: owner, parameters: [], rest: null, self: null, captures: [], body: block(['return', owner, 0], [source]) }
        assertEq(called(fn), 7)
    },
    joinRecoveryForwardsNestedResultsDuringItsPostorderWalk: () => {
        const out = id(), inner = id(), final = id()
        const then = yielded(1), otherwise = yielded(2)
        const source = forwarding([out], [inner], true, then, otherwise, ['yield', [ref(inner)]])
        const nested = block(['yield', [ref(final)]], [['block', [final], block(['yield', [ref(out)]], [source])]])
        const result = _joinResults(nested)
        const statement = result.statements[0]
        assert(statement[0] === 'if')
        assertEq(statement[1][0], final)
        assertStructurallySame(statement[3], then)
        assertStructurallySame(statement[4], otherwise)
        assertStructurallySame(evaluate(fromFast(result)), evaluate(fromFast(nested)))
    },
    sourceLoopPreparationForwardsResultsBeforeChoosingItsLoopPlan: () => {
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const entry = id(), state = id(), out = id(), inner = id(), completed = id()
        const then = yielded(1), otherwise = yielded(2)
        const source = forwarding([out], [inner], ['>', ref(state), 0], then, otherwise, ['yield', [ref(inner)]])
        /** @type {FastFunction} */
        const fn = { target: owner, parameters: [entry], rest: null, self: null, captures: [], body: block(['return', owner, ref(completed)], [
            ['loop', { target, parameters: [state], initial: [ref(entry)], results: [completed],
                body: block(['break', target, [ref(out)]], [source]) }],
        ]) }
        const result = assertOk(_sourceLoops(yielded(['function', fn])))
        assert(result.exit[0] === 'yield')
        const value = result.exit[1][0]
        assert(value instanceof Array && value[0] === 'function')
        const loop = value[1].body.statements[0]
        assert(loop[0] === 'loop')
        const statement = loop[1].body.statements[0]
        assert(statement[0] === 'if')
        assertEq(statement[1][0], out)
        assertEq(statement[3], then)
        assertEq(statement[4], otherwise)
        assertEq(called(value[1], [1]), 1)
        assertEq(called(value[1], [0]), 2)
    },
})
