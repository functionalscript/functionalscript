/**
 * Loop entries establish ordered values in the enclosing completion region.
 *
 * @import { Function as FastFunction, Loop, Value } from '../../../js/ast/types.ts'
 * @import { Exp } from '../../types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { fromFast } from '../module.f.mjs'
import { liftReturns } from '../../../js/ast/returns/module.f.mjs'
import { invocationRootOf } from '../loop/root/module.f.mjs'
import { toFast } from '../../to_fast/module.f.mjs'
import { _id as id, _ref as ref, _result as result, _target as target, _body as body, _calledFunction as calledFunction } from '../proof.f.mjs'
import { escape, failed, mixed, evaluate, failure, flat } from '../member_returns/proof.f.mjs'

/** @type {(initial: readonly Value[]) => FastFunction} */
const terminalEntry = initial => {
    const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
    const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: initial.map(() => id(0)), initial, results: [],
        body: body(['throw', 'skipped loop body']) })
    return { target, parameters: [], rest: null, self: null, captures: [],
        body: body(['return', target, failed('skipped loop suffix')], [['loop', loop]]) }
}

export const proof = /** @type {const} */ ({
    returningEntryPositionsSkipRemainingSetup: () => {
        for (const position of /** @type {const} */ ([0, 1, 2])) {
            const initial = Array.from({ length: 3 }, (_, index) => index < position ? index
                : index === position ? escape(['array', ['entry', position]]) : failed('skipped entry value'))
            assertStructurallySame(evaluate(calledFunction(terminalEntry(initial))), ['entry', position])
        }
    },
    earlierEntryFailureBeforeSuccessfulReturn: () => {
        assertEq(failure(calledFunction(terminalEntry([failed('first entry'), escape()]))), 'first entry')
        assertEq(failure(calledFunction(terminalEntry([1, failed('second entry'), escape()]))), 'second entry')
        failure(calledFunction(terminalEntry([['array', [['...', 0]]], escape()])))
    },
    normalEntrySignaturesAndStateOrder: () => {
        const stop = id(0)
        for (const width of /** @type {const} */ ([0, 1, 3])) {
            const parameters = Array.from({ length: width }, () => id(0))
            const outputs = parameters.map(() => id(0))
            const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const loop = /** @type {Loop} */ ({ target: loopTarget, parameters,
                initial: parameters.map((_, index) => index === 0 ? mixed(ref(stop), index + 1) : index + 1), results: outputs,
                body: body(['break', loopTarget, parameters.map(ref)]) })
            const fn = /** @type {FastFunction} */ ({ target, parameters: [stop], rest: null, self: null, captures: [],
                body: body(['return', target, ['array', outputs.map(ref)]], [['loop', loop]]) })
            assertStructurallySame(evaluate(calledFunction(fn, [false])), parameters.map((_, index) => index + 1))
            if (width !== 0) { assertEq(evaluate(calledFunction(fn, [true])), 7) }
        }
    },
    normalEntryThenSimultaneousContinue: () => {
        const stop = id(0), count = id(0), left = id(0), right = id(0), first = id(0), second = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [count, left, right],
            initial: [0, mixed(ref(stop), 1), 2], results: [first, second],
            body: body(['continue', loopTarget, [['+', ref(count), 1], ref(right), ref(left)]], [
                ['if', [], ['>=', ref(count), 3], body(['break', loopTarget, [ref(left), ref(right)]]), body(['yield', []])],
            ]) })
        const fn = /** @type {FastFunction} */ ({ target, parameters: [stop], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(first), ref(second)]]], [['loop', loop]]) })
        assertStructurallySame(evaluate(calledFunction(fn, [false])), [2, 1])
        assertEq(evaluate(calledFunction(fn, [true])), 7)
    },
    returnedEntryKeepsEstablishedIdentity: () => {
        const payload = id(0), original = id(0), returned = id(0)
        const source = terminalEntry([0, escape(ref(payload)), failed('skipped identity tail')])
        const fn = /** @type {FastFunction} */ ({ ...source, parameters: [payload] })
        assertStructurallySame(evaluate(fromFast(result(['array', [
            ['===', ref(original), ref(returned)], ['.', ref(returned), 'marker'],
        ]], [
            ['define', original, ['object', [[':', 'marker', 42]]], 'required'],
            ['define', returned, ['()', ['function', fn], [ref(original)]], 'required'],
        ]))), [true, 42])
    },
    skippedBranchDoesNotEnterLoop: () => {
        const reached = id(0)
        const source = terminalEntry([escape('reached'), failed('skipped later entry')])
        const fn = /** @type {FastFunction} */ ({ ...source, parameters: [reached],
            body: body(['return', target, 'not reached'], [
                ['if', [], ref(reached), source.body, body(['yield', []])],
            ]) })
        assertEq(evaluate(calledFunction(fn, [false])), 'not reached')
        assertEq(evaluate(calledFunction(fn, [true])), 'reached')
    },
    returnedEntryLeavesLaterCallerMemoUndemanded: () => {
        const lazy = id(0)
        const source = terminalEntry([escape(), ref(lazy)])
        const fn = /** @type {FastFunction} */ ({ ...source,
            body: { ...source.body, statements: [['define', lazy, failed('undemanded caller memo'), 'lazy'], ...source.body.statements] } })
        assertEq(evaluate(calledFunction(fn)), 7)
    },
    callerAndInitializerMemoAcrossEntry: () => {
        const stop = id(0), caller = id(0), selected = id(0), local = id(0)
        const first = id(0), second = id(0), third = id(0), output = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const returned = /** @type {Value} */ (['array', [ref(selected), ref(selected), ref(caller)]])
        const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [first, second, third],
            initial: [ref(selected), mixed(ref(stop), ref(caller), returned), ref(selected)], results: [output],
            body: body(['break', loopTarget, [['array', [ref(first), ref(second), ref(third), ref(selected), ref(caller)]]]]) })
        const fn = /** @type {FastFunction} */ ({ target, parameters: [stop], rest: null, self: null, captures: [],
            body: body(['return', target, ref(output)], [
                ['define', caller, ['array', [4]], 'lazy'],
                ['define', selected, ['block', result(['array', [ref(local), ref(local)]], [
                    ['define', local, ['array', [ref(caller)]], 'lazy'],
                ])], 'lazy'], ['loop', loop],
            ]) })
        const normal = evaluate(calledFunction(fn, [false]))
        assert(normal instanceof Array && normal[0] instanceof Array && normal[0][0] instanceof Array)
        assertEq(normal[0], normal[2])
        assertEq(normal[0], normal[3])
        assertEq(normal[1], normal[4])
        assertEq(normal[0][0], normal[0][1])
        assertEq(normal[0][0][0], normal[4])
        const stopped = evaluate(calledFunction(fn, [true]))
        assert(stopped instanceof Array && stopped[0] instanceof Array && stopped[0][0] instanceof Array)
        assertEq(stopped[0], stopped[1])
        assertEq(stopped[0][0], stopped[0][1])
        assertEq(stopped[0][0][0], stopped[2])
    },
    freshInnerEntriesCaptureOuterIterationValues: () => {
        const count = id(0), prior = id(0), local = id(0), input = id(0), output = id(0), saved = id(0), captured = id(0)
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const getter = /** @type {Value} */ (['function', { target: owner, parameters: [], rest: null, self: null,
            captures: [{ binding: captured, value: ref(input) }], body: body(['return', owner, ref(captured)]),
        }])
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = /** @type {Loop} */ ({ target: innerTarget, parameters: [input],
            initial: [mixed(false, ref(local))], results: [saved], body: body(['break', innerTarget, [getter]]) })
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const outer = /** @type {Loop} */ ({ target: outerTarget, parameters: [count, prior], initial: [0, null], results: [output],
            body: body(['continue', outerTarget, [['+', ref(count), 1], ['array', [ref(prior), ref(saved), ref(local), ref(local)]]]], [
                ['if', [], ['>=', ref(count), 2], body(['break', outerTarget, [ref(prior)]]), body(['yield', []])],
                ['define', local, ['array', [ref(count)]], 'lazy'], ['loop', inner],
            ]) })
        const fn = /** @type {FastFunction} */ ({ target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, ref(output)], [['loop', outer]]) })
        const factory = id(0), first = id(0), second = id(0)
        const value = evaluate(fromFast(result(['array', [
            ['()', ['.', ref(first), 1], []], ['.', ref(first), 2], ['.', ref(first), 3],
            ['()', ['.', ['.', ref(first), 0], 1], []], ['.', ['.', ref(first), 0], 2],
            ['()', ['.', ref(second), 1], []],
        ]], [
            ['define', factory, ['function', fn], 'required'],
            ['define', first, ['()', ref(factory), []], 'required'], ['define', second, ['()', ref(factory), []], 'required'],
        ])))
        assert(value instanceof Array)
        assertStructurallySame(value, [[1], [1], [1], [0], [0], [1]])
        assertEq(value[0], value[1])
        assertEq(value[0], value[2])
        assertEq(value[3], value[4])
        assert(value[0] !== value[3])
        assert(value[0] !== value[5])
    },
    nestedEntryReturnsToEnclosingFunction: () => {
        const stop = id(0), innerState = id(0), output = id(0), dead = id(0)
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = /** @type {Loop} */ ({ target: innerTarget, parameters: [innerState], initial: [mixed(ref(stop), 3)], results: [],
            body: body(['break', innerTarget, []]) })
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const outer = /** @type {Loop} */ ({ target: outerTarget, parameters: [], initial: [], results: [output],
            body: body(['break', outerTarget, [9]], [
                ['loop', inner], ['define', dead, 1, 'required'],
            ]) })
        const fn = /** @type {FastFunction} */ ({ target, parameters: [stop], rest: null, self: null, captures: [],
            body: body(['return', target, ref(output)], [['loop', outer]]) })
        assertEq(evaluate(calledFunction(fn, [false])), 9)
        assertEq(evaluate(calledFunction(fn, [true])), 7)
    },
    entryOperandOwnsItsLocalLoop: () => {
        const stop = id(0), local = id(0), state = id(0), output = id(0)
        const localTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const localLoop = /** @type {Loop} */ ({ target: localTarget, parameters: [], initial: [], results: [local],
            body: body(['break', localTarget, [mixed(ref(stop), 3)]]) })
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [state],
            initial: [['block', result(ref(local), [['loop', localLoop]])]], results: [output], body: body(['break', loopTarget, [ref(state)]]) })
        const fn = /** @type {FastFunction} */ ({ target, parameters: [stop], rest: null, self: null, captures: [],
            body: body(['return', target, ref(output)], [['loop', loop]]) })
        assertEq(evaluate(calledFunction(fn, [false])), 3)
        assertEq(evaluate(calledFunction(fn, [true])), 7)
    },
    metadataAndStableRoundTrips: () => {
        const stop = id(0), argument = id(0), rest = id(0), self = id(0), captured = id(0), count = id(0), value = id(0), output = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const returned = /** @type {Value} */ (['array', [ref(captured), ref(captured), ref(rest)]])
        const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [count, value],
            initial: [0, mixed(ref(stop), ref(argument), returned)], results: [output],
            body: body(['continue', loopTarget, [['+', ref(count), 1], ['+', ref(value), 1]]], [
                ['if', [], ['>=', ref(count), 2], body(['break', loopTarget, [['array', [ref(value), ref(captured), ref(rest), ['===', ref(self), ref(self)]]]]]), body(['yield', []])],
            ]) })
        const fn = /** @type {FastFunction} */ ({ target, parameters: [stop, argument], rest, self,
            captures: [{ binding: captured, value: ['array', [4]] }], body: body(['return', target, ref(output)], [['loop', loop]]) })
        let graph = fromFast(result(['function', fn]))
        /** @type {readonly Exp[]} */
        let graphs = [graph]
        for (let index = 0; index < 6; index += 1) { graph = fromFast(assertOk(toFast(graph))); graphs = [...graphs, graph] }
        for (const later of graphs.slice(4)) { assertStructurallySame(flat(later), flat(graphs[3])) }
        for (const current of graphs) {
            assert(current instanceof Array && current[0] === '=>')
            assertEq(current[1], 2)
            assertEq(current[2].length, 1)
            const stopped = evaluate(['()', current, [true, 1, 8, 9]])
            assert(stopped instanceof Array)
            assertEq(stopped[0], stopped[1])
            assertStructurallySame(stopped, [[4], [4], [8, 9]])
            assertStructurallySame(evaluate(['()', current, [false, 1, 8, 9]]), [3, [4], [8, 9], true])
        }
    },
    computedEntryRetainsHelperFallback: () => {
        const start = id(0), stop = id(0), rest = id(0), count = id(0), steps = id(0), output = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [count, steps],
            initial: [mixed(ref(stop), ['+', ref(start), 1]), 0], results: [output],
            body: body(['continue', loopTarget, [['+', ref(count), 1], ['+', ref(steps), 1]]], [
                ['if', [], ['>=', ref(count), 3], body(['break', loopTarget, [['array', [ref(count), ref(steps)]]]]), body(['yield', []])],
            ]) })
        for (const restBinding of /** @type {const} */ ([null, rest])) {
            const fn = /** @type {FastFunction} */ ({ target, parameters: [start, stop], rest: restBinding, self: null, captures: [],
                body: body(['return', target, restBinding === null ? ref(output) : ['array', [ref(output), ref(restBinding)]]], [['loop', loop]]) })
            const lifted = /** @type {FastFunction} */ ({ ...fn, body: liftReturns(fn.body, target) })
            assertEq(invocationRootOf(fn), null)
            assertEq(invocationRootOf(lifted), null)
            const graph = fromFast(result(['function', fn]))
            assert(graph instanceof Array && graph[0] === '=>')
            assertEq(graph[1], 2)
            assertStructurallySame(evaluate(['()', graph, [0, false, 8, 9]]), restBinding === null ? [3, 2] : [[3, 2], [8, 9]])
            assertEq(evaluate(['()', graph, [0, true, 8, 9]]), 7)
        }
    },
    noReturnIdentityAndIdempotence: () => {
        const state = id(0), output = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [state], initial: [['block', result(3)]], results: [output],
            body: body(['break', loopTarget, [ref(state)]]) })
        const source = body(['return', target, ref(output)], [['loop', loop]])
        assertEq(liftReturns(source, target), source)
        const returning = body(['return', target, ref(output)], [['loop', { ...loop, initial: [mixed(false, 3)] }]])
        const lifted = liftReturns(returning, target)
        assert(lifted !== returning)
        assertEq(liftReturns(lifted, target), lifted)
    },
    throw: {
        foreignReturnOwner: () => {
            const foreign = /** @type {const} */ ({ kind: 'function', index: 0 })
            calledFunction(terminalEntry([['block', body(['return', foreign, 7])]]))
        },
        newLoopTargetIsNotActiveDuringEntry: () => {
            const source = terminalEntry([0])
            const statement = source.body.statements[0]
            assert(statement[0] === 'loop')
            const loop = /** @type {Loop} */ ({ ...statement[1], initial: [['block', body(['break', statement[1].target, []])]] })
            calledFunction({ ...source, body: body(['return', target, 9], [['loop', loop]]) })
        },
        entryOperandCannotEscapeToEnclosingLoop: () => {
            const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const state = id(0), output = id(0)
            const operand = /** @type {Value} */ (['block', body(['break', outerTarget, [7]], [
                ['if', [], false, body(['return', target, 5]), body(['yield', []])],
            ])])
            const inner = /** @type {Loop} */ ({ target: innerTarget, parameters: [state], initial: [operand], results: [],
                body: body(['break', innerTarget, []]) })
            const outer = /** @type {Loop} */ ({ target: outerTarget, parameters: [], initial: [], results: [output],
                body: body(['break', outerTarget, [9]], [['loop', inner]]) })
            calledFunction({ target, parameters: [], rest: null, self: null, captures: [], body: body(['return', target, ref(output)], [['loop', outer]]) })
        },
    },
})
