/**
 * Closure-construction completion integration over normalized FAST.
 *
 * @import { Function as FastFunction, Loop, Value } from '../../../js/ast/types.ts'
 * @import { Exp } from '../../types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { fromFast } from '../module.f.mjs'
import { liftReturns } from '../../../js/ast/returns/module.f.mjs'
import { toFast } from '../../to_fast/module.f.mjs'
import { _id as id, _ref as ref, _result as result, _target as target, _body as body, _calledFunction as calledFunction, _collectingMemo as collectingMemo } from '../proof.f.mjs'
import { requiredFunction, escape, failed, mixed, evaluate, failure, flat } from '../member_returns/proof.f.mjs'

/** Each capture is observed in declaration order through its distinct inner binding. @type {(values: readonly Value[]) => Value} */
const capturing = values => {
    const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
    const bindings = values.map(() => id(0))
    return ['function', {
        target: owner, parameters: [], rest: null, self: null,
        captures: values.map((value, index) => ({ binding: bindings[index], value })),
        body: body(['return', owner, ['array', bindings.map(ref)]]),
    }]
}

export const proof = /** @type {const} */ ({
    lazyInitializerReturnsAtDemand: () => {
        const output = id(0)
        assertEq(evaluate(calledFunction({ target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, ref(output)], [['define', output, capturing([escape()]), 'lazy']]) })), 7)
    },
    capturePositionsAndSkippedTail: () => {
        for (const index of /** @type {const} */ ([0, 1, 2])) {
            const values = Array.from({ length: 3 }, (_, position) => position < index ? position
                : position === index ? escape(11) : failed('skipped later capture'))
            const source = requiredFunction(capturing(values))
            const dead = id(0)
            const fn = /** @type {FastFunction} */ ({ ...source, body: { ...source.body, statements: [
                ...source.body.statements, ['define', dead, failed('skipped constructor suffix'), 'required'],
            ] } })
            assertEq(evaluate(calledFunction(fn)), 11)
        }
        assertEq(evaluate(calledFunction(requiredFunction(['()', capturing([escape(12)]), [failed('skipped call argument')]]))), 12)
    },
    earlierCaptureFailureBeforeSuccessfulReturn: () => {
        assertEq(failure(calledFunction(requiredFunction(capturing([failed('capture prefix'), escape()])))), 'capture prefix')
        assertEq(failure(calledFunction(requiredFunction(capturing([1, failed('second capture'), escape()])))), 'second capture')
        const closure = /** @type {Value} */ (['object', [[':', 'made', capturing([failed('nested capture'), escape()])]]])
        assertEq(failure(calledFunction(requiredFunction(closure))), 'nested capture')
    },
    normalCaptureBindingsAndAliases: () => {
        const stop = id(0), allocation = id(0), made = id(0), output = id(0)
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [stop], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(output), ref(allocation)]]], [
                ['define', allocation, ['array', [4]], 'required'],
                ['define', made, capturing([ref(allocation), mixed(ref(stop), ref(allocation), ref(allocation)), 9]), 'required'],
                ['define', output, ['()', ref(made), []], 'required'],
            ]),
        })
        assertStructurallySame(evaluate(calledFunction(fn, [true])), [4])
        const value = evaluate(calledFunction(fn, [false]))
        assert(value instanceof Array && value[0] instanceof Array)
        assertStructurallySame(value, [[[4], [4], 9], [4]])
        assertEq(value[0][0], value[1])
        assertEq(value[0][1], value[1])
    },
    returnedPayloadKeepsIdentity: () => {
        const payload = id(0), original = id(0), returned = id(0)
        const fn = requiredFunction(capturing([0, escape(ref(payload)), failed('unreached capture')]), [payload])
        const value = evaluate(fromFast(result(['array', [['===', ref(original), ref(returned)], ['.', ref(returned), 'marker']]], [
            ['define', original, ['object', [[':', 'marker', 42]]], 'required'],
            ['define', returned, ['()', ['function', fn], [ref(original)]], 'required'],
        ])))
        assertStructurallySame(value, [true, 42])
    },
    constructionDoesNotRunNestedBody: () => {
        const stop = id(0), captured = id(0), output = id(0)
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const closure = /** @type {Value} */ (['function', {
            target: owner, parameters: [], rest: null, self: null,
            captures: [{ binding: captured, value: mixed(ref(stop), 1) }],
            body: body(['throw', 'nested body is deferred']),
        }])
        const fn = /** @type {FastFunction} */ ({ target, parameters: [stop], rest: null, self: null, captures: [],
            body: body(['return', target, 23], [['define', output, closure, 'required']]) })
        assertEq(evaluate(calledFunction(fn, [false])), 23)
        assertEq(evaluate(calledFunction(fn, [true])), 7)
        assertEq(failure(calledFunction(requiredFunction(['()', closure, []], [stop]), [false])), 'nested body is deferred')
    },
    nestedFunctionRetainsItsReturnOwner: () => {
        const stop = id(0), captured = id(0), output = id(0), innerOutput = id(0)
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const closure = /** @type {Value} */ (['function', {
            target: owner, parameters: [], rest: null, self: null,
            captures: [{ binding: captured, value: mixed(ref(stop), 5) }],
            body: body(['return', owner, 99], [['define', innerOutput,
                ['block', body(['return', owner, ['+', ref(captured), 1]])], 'required']]),
        }])
        const fn = /** @type {FastFunction} */ ({ target, parameters: [stop], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(output), 'outer continues']]], [
                ['define', output, ['()', closure, []], 'required'],
            ]) })
        assertStructurallySame(evaluate(calledFunction(fn, [false])), [6, 'outer continues'])
        assertEq(evaluate(calledFunction(fn, [true])), 7)
    },
    selectedOuterRegions: () => {
        const value = capturing([failed('skipped capture prefix'), escape()])
        assertEq(evaluate(calledFunction(requiredFunction(['if', false, result(value), result(15)]))), 15)
        assertEq(evaluate(calledFunction(requiredFunction(['?.', null, 'f', ['|()', [value]]]))), undefined)
        assertEq(evaluate(calledFunction(requiredFunction(['array', [1, capturing([escape(16)]), failed('array suffix')]]))), 16)
    },
    memoCallerAndInitializerSharing: () => {
        const stop = id(0), caller = id(0), selected = id(0), recipeLocal = id(0), made = id(0), output = id(0)
        const payload = /** @type {Value} */ (['array', [ref(selected), ref(selected), ref(caller)]])
        const fn = /** @type {FastFunction} */ ({ target, parameters: [stop], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(output), ref(selected), ref(caller)]]], [
                ['define', caller, ['array', [4]], 'lazy'],
                ['define', selected, ['block', result(['array', [ref(recipeLocal), ref(recipeLocal)]], [
                    ['define', recipeLocal, ['array', [ref(caller)]], 'lazy'],
                ])], 'lazy'],
                ['define', made, capturing([ref(selected), mixed(ref(stop), ref(caller), payload), ref(selected)]), 'required'],
                ['define', output, ['()', ref(made), []], 'required'],
            ]) })
        const normal = evaluate(calledFunction(fn, [false]))
        assert(normal instanceof Array && normal[0] instanceof Array && normal[1] instanceof Array && normal[1][0] instanceof Array)
        assertEq(normal[0][0], normal[1])
        assertEq(normal[0][2], normal[1])
        assertEq(normal[0][1], normal[2])
        assertEq(normal[1][0], normal[1][1])
        assertEq(normal[1][0][0], normal[2])
        const returned = evaluate(calledFunction(fn, [true]))
        assert(returned instanceof Array && returned[0] instanceof Array && returned[0][0] instanceof Array)
        assertEq(returned[0], returned[1])
        assertEq(returned[0][0], returned[0][1])
        assertEq(returned[0][0][0], returned[2])
    },
    iterationClosureAndFreshInvocation: () => {
        const local = id(0), count = id(0), output = id(0), captured = id(0), made = id(0)
        const getterTarget = /** @type {const} */ ({ kind: 'function', index: 0 })
        const getter = /** @type {Value} */ (['function', {
            target: getterTarget, parameters: [], rest: null, self: null, captures: [{ binding: captured, value: ref(local) }],
            body: body(['return', getterTarget, ['array', [ref(captured), ref(captured)]]]),
        }])
        const witness = collectingMemo(ref(local), 2)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({
            target: loopTarget, parameters: [count], initial: [0], results: [output],
            body: body(['break', loopTarget, [null]], [
                ['if', [], ['<', ref(count), 2], body(['continue', loopTarget, [['+', ref(count), 1]]], [
                    ['define', local, ['array', [ref(count)]], 'lazy'], ['loop', witness],
                    ['define', made, capturing([ref(local), mixed(['===', ref(count), 1], ref(local), getter)]), 'required'],
                ]), body(['yield', []])],
            ]),
        })
        const factory = /** @type {FastFunction} */ ({ target, parameters: [], rest: null, self: null, captures: [], body: body(['return', target, null], [['loop', loop]]) })
        const factoryBinding = id(0), firstFn = id(0), secondFn = id(0), left = id(0), right = id(0)
        const value = evaluate(fromFast(result(['array', [ref(left), ref(right)]], [
            ['define', factoryBinding, ['function', factory], 'required'],
            ['define', firstFn, ['()', ref(factoryBinding), []], 'required'], ['define', secondFn, ['()', ref(factoryBinding), []], 'required'],
            ['define', left, ['()', ref(firstFn), []], 'required'], ['define', right, ['()', ref(secondFn), []], 'required'],
        ])))
        assert(value instanceof Array && value[0] instanceof Array && value[1] instanceof Array)
        assertStructurallySame(value, [[[1], [1]], [[1], [1]]])
        assertEq(value[0][0], value[0][1])
        assertEq(value[1][0], value[1][1])
        assert(value[0][0] !== value[1][0])
    },
    metadataAndStableRoundTrips: () => {
        const stop = id(0), argument = id(0), rest = id(0), captured = id(0), self = id(0), made = id(0)
        const innerArg = id(0), innerRest = id(0), innerSelf = id(0), first = id(0), second = id(0)
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [stop, argument], rest, self, captures: [{ binding: captured, value: ['array', [4]] }],
            body: body(['return', target, ['array', [['()', ref(made), [ref(argument), 8, 9]], ref(captured), ref(rest), ['===', ref(self), ref(self)]]]], [
                ['define', made, ['function', {
                    target: owner, parameters: [innerArg], rest: innerRest, self: innerSelf,
                    captures: [{ binding: first, value: ref(captured) }, { binding: second,
                        value: mixed(ref(stop), ref(rest), ['array', [ref(captured), ref(captured), ref(rest)]]) }],
                    body: body(['return', owner, ['array', [ref(first), ref(second), ref(innerArg), ref(innerRest), ['===', ref(innerSelf), ref(innerSelf)]]]]),
                }], 'required'],
            ]),
        })
        let graph = fromFast(result(['function', fn]))
        /** @type {readonly Exp[]} */
        let graphs = [graph]
        for (let index = 0; index < 6; index += 1) { graph = fromFast(assertOk(toFast(graph))); graphs = [...graphs, graph] }
        for (const later of graphs.slice(4)) { assertStructurallySame(flat(later), flat(graphs[3])) }
        for (const current of graphs) {
            assert(current instanceof Array && current[0] === '=>')
            assertEq(current[1], 2)
            assertEq(current[2].length, 1)
            const returned = evaluate(['()', current, [true, 1, 6, 7]])
            assert(returned instanceof Array)
            assertEq(returned[0], returned[1])
            assertStructurallySame(returned, [[4], [4], [6, 7]])
            const normal = evaluate(['()', current, [false, 1, 6, 7]])
            assert(normal instanceof Array && normal[0] instanceof Array)
            assertEq(normal[0][0], normal[1])
            assertEq(normal[0][1], normal[2])
            assertStructurallySame(normal, [[[4], [6, 7], 1, [8, 9], true], [4], [6, 7], true])
        }
    },
    directBreakCaptureReturn: () => {
        const stop = id(0), local = id(0), output = id(0)
        const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const loop = /** @type {Loop} */ ({ target: loopTarget, parameters: [], initial: [], results: [output],
            body: body(['break', loopTarget, [capturing([ref(local), mixed(ref(stop), 1)])]], [
                ['define', local, ['array', [4]], 'lazy'],
            ]) })
        const fn = /** @type {FastFunction} */ ({ target, parameters: [stop], rest: null, self: null, captures: [],
            body: body(['return', target, ref(output)], [['loop', loop]]) })
        assertStructurallySame(evaluate(fromFast(result(['()', ['()', ['function', fn], [false]], []]))), [[4], 1])
        assertEq(evaluate(calledFunction(fn, [true])), 7)
    },
    noReturnIdentityAndIdempotence: () => {
        for (const value of [capturing([]), capturing([1, ['array', [2]], ['object', [[':', 'x', 3]]]])]) {
            const source = requiredFunction(value).body
            assertEq(liftReturns(source, target), source)
        }
        const source = requiredFunction(capturing([1, mixed(false, 2)])).body
        const lifted = liftReturns(source, target)
        assert(lifted !== source)
        assertEq(liftReturns(lifted, target), lifted)
    },
    throw: {
        foreignCaptureOwner: () => {
            const foreign = /** @type {const} */ ({ kind: 'function', index: 0 })
            calledFunction(requiredFunction(capturing([['block', body(['return', foreign, 7])]])))
        },
        nestedBodyCannotReturnToConstructor: () => {
            const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
            const captured = id(0), output = id(0)
            calledFunction(requiredFunction(['function', { target: owner, parameters: [], rest: null, self: null,
                captures: [{ binding: captured, value: mixed(false, 1) }],
                body: body(['return', owner, ref(captured)], [['define', output, escape(), 'required']]),
            }]))
        },
    },
})
