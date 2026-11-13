/**
 * Owning returns cross loop-transfer payloads without changing their signatures.
 *
 * @import { Function as FastFunction, Loop, Value } from '../../../js/ast/types.ts'
 * @import { Exp } from '../../types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { fromFast } from '../module.f.mjs'
import { liftReturns } from '../../../js/ast/returns/module.f.mjs'
import { toFast } from '../../to_fast/module.f.mjs'
import { _id as id, _ref as ref, _result as result, _target as target, _body as body, _calledFunction as calledFunction, _collectingMemo as collectingMemo } from '../proof.f.mjs'
import { escape, failed, mixed, evaluate, failure, flat } from '../member_returns/proof.f.mjs'

/** Terminal fixtures never execute a normal continue. @type {(kind: 'break' | 'continue', values: readonly Value[]) => FastFunction} */
const terminalTransfer = (kind, values) => {
    const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
    const parameters = kind === 'continue' ? values.map(() => id(0)) : []
    const results = kind === 'break' ? values.map(() => id(0)) : []
    const loop = /** @type {Loop} */ ({ target: loopTarget, parameters, initial: parameters.map(() => 0), results,
        body: body([kind, loopTarget, values]) })
    return { target, parameters: [], rest: null, self: null, captures: [],
        body: body(['return', target, failed('transfer suffix')], [['loop', loop]]) }
}

export const proof = /** @type {const} */ ({
    returningPayloadPositionsSkipTransfer: () => {
        for (const kind of /** @type {const} */ (['break', 'continue'])) {
            for (const position of /** @type {const} */ ([0, 1, 2])) {
                const payload = /** @type {Value} */ (['array', [kind, position]])
                const values = Array.from({ length: 3 }, (_, index) => index < position ? index
                    : index === position ? escape(payload) : failed('skipped transfer payload'))
                assertStructurallySame(evaluate(calledFunction(terminalTransfer(kind, values))), [kind, position])
            }
        }
    },
    earlierPayloadFailureBeforeSuccessfulReturn: () => {
        for (const kind of /** @type {const} */ (['break', 'continue'])) {
            assertEq(failure(calledFunction(terminalTransfer(kind, [failed('first payload'), escape()]))), 'first payload')
            assertEq(failure(calledFunction(terminalTransfer(kind, [1, failed('second payload'), escape()]))), 'second payload')
            failure(calledFunction(terminalTransfer(kind, [
                ['array', [['...', 0]]], escape(),
            ])))
        }
    },
    normalBreakResultArity: () => {
        const stop = id(0)
        for (const width of /** @type {const} */ ([0, 1, 3])) {
            const outputs = Array.from({ length: width }, () => id(0))
            const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const values = outputs.map((_, index) => index === 0 ? mixed(ref(stop), index + 1) : index + 1)
            const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [], initial: [], results: outputs,
                body: body(['break', loopTarget, values]) })
            const fn = /** @type {FastFunction} */ ({ target, parameters: [stop], rest: null, self: null, captures: [],
                body: body(['return', target, ['array', outputs.map(ref)]], [['loop', loop]]) })
            assertStructurallySame(evaluate(calledFunction(fn, [false])), outputs.map((_, index) => index + 1))
            if (width !== 0) { assertEq(evaluate(calledFunction(fn, [true])), 7) }
        }
    },
    simultaneousContinueValues: () => {
        const stop = id(0), count = id(0), left = id(0), right = id(0), first = id(0), second = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [count, left, right], initial: [0, 1, 2], results: [first, second],
            body: body(['continue', loopTarget, [['+', ref(count), 1], mixed(ref(stop), ref(right)), ref(left)]], [
                ['if', [], ['>=', ref(count), 3], body(['break', loopTarget, [ref(left), ref(right)]]), body(['yield', []])],
            ]) })
        const fn = /** @type {FastFunction} */ ({ target, parameters: [stop], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(first), ref(second)]]], [['loop', loop]]) })
        assertStructurallySame(evaluate(calledFunction(fn, [false])), [2, 1])
        assertEq(evaluate(calledFunction(fn, [true])), 7)
    },
    returnedPayloadKeepsIdentity: () => {
        const payload = id(0), original = id(0), returned = id(0)
        for (const kind of /** @type {const} */ (['break', 'continue'])) {
            const source = terminalTransfer(kind, [0, escape(ref(payload)), failed('skipped identity tail')])
            const fn = /** @type {FastFunction} */ ({ ...source, parameters: [payload] })
            assertStructurallySame(evaluate(fromFast(result(['array', [
                ['===', ref(original), ref(returned)], ['.', ref(returned), 'marker'],
            ]], [
                ['define', original, ['object', [[':', 'marker', 42]]], 'required'],
                ['define', returned, ['()', ['function', fn], [ref(original)]], 'required'],
            ]))), [true, 42])
        }
    },
    callerAndInitializerMemoAcrossBreak: () => {
        const stop = id(0), caller = id(0), selected = id(0), local = id(0), first = id(0), second = id(0), third = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const returned = /** @type {Value} */ (['array', [ref(selected), ref(selected), ref(caller)]])
        const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [], initial: [], results: [first, second, third],
            body: body(['break', loopTarget, [ref(selected), mixed(ref(stop), ref(caller), returned), ref(selected)]]) })
        const fn = /** @type {FastFunction} */ ({ target, parameters: [stop], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(first), ref(second), ref(third), ref(selected), ref(caller)]]], [
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
    iterationCaptureReturnThroughContinue: () => {
        const count = id(0), prior = id(0), local = id(0), output = id(0), captured = id(0)
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const getter = /** @type {Value} */ (['function', { target: owner, parameters: [], rest: null, self: null,
            captures: [{ binding: captured, value: ref(local) }],
            body: body(['return', owner, ['array', [ref(captured), ref(captured)]]]),
        }])
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [count, prior], initial: [0, null], results: [output],
            body: body(['continue', loopTarget, [['+', ref(count), 1], ['array', [
                ref(local), mixed(['===', ref(count), 1], ref(local), getter),
            ]]]], [
                ['if', [], ['>=', ref(count), 2], body(['break', loopTarget, [null]]), body(['yield', []])],
                ['define', local, ['array', [ref(count)]], 'lazy'], ['loop', collectingMemo(ref(local), 2)],
            ]) })
        const fn = /** @type {FastFunction} */ ({ target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, null], [['loop', loop]]) })
        const factory = id(0), first = id(0), second = id(0), left = id(0), right = id(0)
        const value = evaluate(fromFast(result(['array', [ref(left), ref(right)]], [
            ['define', factory, ['function', fn], 'required'],
            ['define', first, ['()', ref(factory), []], 'required'], ['define', second, ['()', ref(factory), []], 'required'],
            ['define', left, ['()', ref(first), []], 'required'], ['define', right, ['()', ref(second), []], 'required'],
        ])))
        assert(value instanceof Array && value[0] instanceof Array && value[1] instanceof Array)
        assertStructurallySame(value, [[[1], [1]], [[1], [1]]])
        assertEq(value[0][0], value[0][1])
        assertEq(value[1][0], value[1][1])
        assert(value[0][0] !== value[1][0])
    },
    nestedOuterBreakMemo: () => {
        const stop = id(0), caller = id(0), first = id(0), second = id(0)
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = /** @type {Loop} */ ({ target: innerTarget, parameters: [], initial: [], results: [],
            body: body(['break', outerTarget, [mixed(ref(stop), ref(caller), ['array', [ref(caller), ref(caller)]]), ref(caller)]]) })
        const dead = id(0)
        const outer = /** @type {Loop} */ ({ target: outerTarget, parameters: [], initial: [], results: [first, second],
            body: body(['break', outerTarget, [0, 0]], [['loop', inner], ['define', dead, failed('outer break suffix'), 'required']]) })
        const fn = /** @type {FastFunction} */ ({ target, parameters: [stop], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(first), ref(second), ref(caller)]]], [
                ['define', caller, ['array', [4]], 'lazy'], ['loop', outer],
            ]) })
        for (const stopped of /** @type {const} */ ([false, true])) {
            const value = evaluate(calledFunction(fn, [stopped]))
            assert(value instanceof Array)
            assertEq(value[0], value[1])
            if (!stopped) { assertEq(value[0], value[2]) }
            assertStructurallySame(value, stopped ? [[4], [4]] : [[4], [4], [4]])
        }
    },
    nestedOuterContinueMemoAndSimultaneousState: () => {
        const stop = id(0), caller = id(0), count = id(0), left = id(0), right = id(0), held = id(0)
        const first = id(0), second = id(0), third = id(0), dead = id(0)
        const outerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const inner = /** @type {Loop} */ ({ target: innerTarget, parameters: [], initial: [], results: [],
            body: body(['continue', outerTarget, [['+', ref(count), 1],
                mixed(ref(stop), ref(right), ['array', [ref(caller), ref(caller)]]), ref(left), ref(caller)]]) })
        const outer = /** @type {Loop} */ ({ target: outerTarget, parameters: [count, left, right, held], initial: [0, 1, 2, null], results: [first, second, third],
            body: body(['break', outerTarget, [0, 0, null]], [
                ['if', [], ['>=', ref(count), 3], body(['break', outerTarget, [ref(left), ref(right), ref(held)]]), body(['yield', []])],
                ['loop', inner], ['define', dead, failed('outer continue suffix'), 'required'],
            ]) })
        const fn = /** @type {FastFunction} */ ({ target, parameters: [stop], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(first), ref(second), ref(third), ref(caller)]]], [
                ['define', caller, ['array', [4]], 'lazy'], ['loop', outer],
            ]) })
        const normal = evaluate(calledFunction(fn, [false]))
        assert(normal instanceof Array)
        assertStructurallySame(normal, [2, 1, [4], [4]])
        assertEq(normal[2], normal[3])
        const stopped = evaluate(calledFunction(fn, [true]))
        assert(stopped instanceof Array)
        assertStructurallySame(stopped, [[4], [4]])
        assertEq(stopped[0], stopped[1])
    },
    metadataAndStableRoundTrips: () => {
        const stop = id(0), argument = id(0), rest = id(0), self = id(0), captured = id(0), count = id(0), value = id(0), output = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [count, value], initial: [0, ref(argument)], results: [output],
            body: body(['continue', loopTarget, [['+', ref(count), 1], mixed(ref(stop), ['+', ref(value), 1], ['array', [ref(captured), ref(captured), ref(rest)]])]], [
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
    noReturnIdentityAndIdempotence: () => {
        const output = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [], initial: [], results: [output],
            body: body(['break', loopTarget, [['block', result(3)]]]) })
        const source = body(['return', target, ref(output)], [['loop', loop]])
        assertEq(liftReturns(source, target), source)
        const returning = body(['return', target, ref(output)], [['loop', { ...loop,
            body: body(['break', loopTarget, [mixed(false, 3)]]) }]])
        const lifted = liftReturns(returning, target)
        assert(lifted !== returning)
        assertEq(liftReturns(lifted, target), lifted)
    },
    throw: {
        foreignReturnOwner: () => {
            const foreign = /** @type {const} */ ({ kind: 'function', index: 0 })
            calledFunction(terminalTransfer('break', [['block', body(['return', foreign, 7])]]))
        },
        operandCannotEscapeToTransferTarget: () => {
            const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const output = id(0)
            const operand = /** @type {Value} */ (['block', body(['break', loopTarget, [7]], [
                ['if', [], false, body(['return', target, 5]), body(['yield', []])],
            ])])
            const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [], initial: [], results: [output],
                body: body(['break', loopTarget, [operand]]) })
            calledFunction({ target, parameters: [], rest: null, self: null, captures: [], body: body(['return', target, ref(output)], [['loop', loop]]) })
        },
        foreignTransferTarget: () => {
            const output = id(0)
            const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const foreign = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [], initial: [], results: [output],
                body: body(['break', foreign, [mixed(false, 3)]]) })
            calledFunction({ target, parameters: [], rest: null, self: null, captures: [], body: body(['return', target, ref(output)], [['loop', loop]]) })
        },
        normalBreakArity: () => {
            const output = id(0)
            const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
            const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [], initial: [], results: [output],
                body: body(['break', loopTarget, [mixed(false, 3), 4]]) })
            calledFunction({ target, parameters: [], rest: null, self: null, captures: [], body: body(['return', target, ref(output)], [['loop', loop]]) })
        },
    },
})
