/**
 * Object-spread completion integration over normalized FAST.
 *
 * @import { Function as FastFunction, Loop, Value } from '../../../js/ast/types.ts'
 * @import { Exp } from '../../types.ts'
 * @import { StringMap } from '../../../types/object/types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { fromFast } from '../module.f.mjs'
import { requiredFunction, escape, failed, mixed, evaluate, failure, flat } from '../member_returns/proof.f.mjs'
import { liftReturns } from '../../../js/ast/returns/module.f.mjs'
import { toFast } from '../../to_fast/module.f.mjs'
import { _id as id, _ref as ref, _result as result, _target as target, _body as body, _calledFunction as calledFunction, _collectingMemo as collectingMemo } from '../proof.f.mjs'

/** @type {(value: Value) => Value} */
const simpleFunction = value => {
    const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
    return ['function', { target: owner, parameters: [], rest: null, self: null, captures: [], body: body(['return', owner, value]) }]
}

/** @type {(toString: Value, valueOf?: Value) => Value} */
const keyMethods = (toString, valueOf = 0) => ['object', [[':', 'toString', toString], [':', 'valueOf', valueOf]]]

export const proof = /** @type {const} */ ({
    lazyInitializerReturnsAtDemand: () => {
        const output = id(0)
        assertEq(evaluate(calledFunction({ target, parameters: [], rest: null, self: null, captures: [],
            body: body(['return', target, ref(output)], [['define', output, ['object', [['...', escape()]]], 'lazy']]),
        })), 7)
    },
    returningSpreadOperandSkipsCopyAndTail: () => {
        const payload = id(0)
        const fn = requiredFunction(['object', [
            [':', 'before', 1], ['...', escape(ref(payload))],
            [':', failed('skipped key'), failed('skipped value')], ['...', failed('skipped spread')],
        ]], [payload])
        for (const value of /** @type {readonly Value[]} */ ([7, null, ['array', [1]], ['object', [[':', 'x', 4]]]])) {
            assertStructurallySame(evaluate(calledFunction(fn, [value])), evaluate(calledFunction(requiredFunction(value))))
        }
        const original = id(0), returned = id(0)
        assertStructurallySame(evaluate(fromFast(result(['array', [
            ['===', ref(returned), ref(original)], ['.', ref(returned), 'x'],
        ]], [
            ['define', original, ['object', [[':', 'x', 41]]], 'required'],
            ['define', returned, ['()', ['function', fn], [ref(original)]], 'required'],
        ]))), [true, 41])
        assertStructurallySame(evaluate(fromFast(result(['array', [
            ['===', ref(returned), ref(original)], ['()', ref(returned), []],
        ]], [
            ['define', original, simpleFunction(42), 'required'],
            ['define', returned, ['()', ['function', fn], [ref(original)]], 'required'],
        ]))), [true, 42])
    },
    earlierEntriesBeforeLaterReturn: () => {
        const cases = /** @type {readonly (readonly [Value, string])[]} */ ([
            [['object', [['...', failed('spread operand')], [':', 'x', escape()]]], 'spread operand'],
            [['object', [['...', ['object', []]], [':', failed('key expression'), escape()]]], 'key expression'],
            [['object', [
                ['...', null], [':', keyMethods(simpleFunction(failed('key conversion'))), escape()],
            ]], 'key conversion'],
            [['object', [
                ['...', ['object', []]], [':', 'duplicate', failed('earlier value')], ['...', ['object', []]], [':', 'duplicate', escape()],
            ]], 'earlier value'],
            [['object', [
                [':', keyMethods(simpleFunction(failed('earlier key'))), 1], ['...', escape()],
            ]], 'earlier key'],
        ])
        for (const [value, message] of cases) { assertEq(failure(calledFunction(requiredFunction(value))), message) }
        assertEq(evaluate(calledFunction(requiredFunction(['object', [['...', ['object', []]], [':', 'x', escape()], ['...', failed('tail')]]]))), 7)
    },
    returningKeySkipsConversionAndValue: () => {
        const payload = id(0)
        const original = /** @type {Value} */ (['object', [
            [':', 'marker', 43], [':', 'toString', simpleFunction(failed('unreached conversion'))],
        ]])
        const fn = requiredFunction(['object', [
            ['...', ['object', [[':', 'before', 1]]]],
            [':', escape(ref(payload)), failed('unreached value')], ['...', failed('unreached later spread')],
        ]], [payload])
        const binding = id(0), observed = id(0)
        assertStructurallySame(evaluate(fromFast(result(['array', [
            ['===', ref(observed), ref(binding)], ['.', ref(observed), 'marker'],
        ]], [
            ['define', binding, original, 'required'], ['define', observed, ['()', ['function', fn], [ref(binding)]], 'required'],
        ]))), [true, 43])
    },
    mixedEntryKeyConversion: () => {
        const stop = id(0)
        const keys = /** @type {readonly (readonly [Value, string])[]} */ ([
            [undefined, 'undefined'], [null, 'null'], [-0, '0'], [7n, '7'],
            [['array', [1, null, 3]], '1,,3'], [keyMethods(simpleFunction('chosen')), 'chosen'],
            [keyMethods(simpleFunction(['object', []]), simpleFunction('fallback')), 'fallback'],
        ])
        for (const [key, spelling] of keys) {
            for (const leading of /** @type {const} */ ([false, true])) {
                const entries = /** @type {import('../../../js/ast/types.ts').Entry<Value>[]} */ ([
                    ...leading ? [/** @type {const} */ (['...', ['object', []]])] : [],
                    [':', 'before', 1], ['...', ['object', [[':', 'spread', 2]]]],
                    [':', key, mixed(ref(stop), 9)], ['...', ['object', []]],
                ])
                const fn = requiredFunction(['object', entries], [stop])
                const value = evaluate(calledFunction(fn, [false]))
                assert(value !== null && typeof value === 'object' && !(value instanceof Array))
                assertStructurallySame(Object.entries(value), [['before', 1], ['spread', 2], [spelling, 9]].toSorted((a, b) =>
                    spelling === '0' || spelling === '7' ? (a[0] === spelling ? -1 : b[0] === spelling ? 1 : 0) : 0))
                assertEq(evaluate(calledFunction(fn, [true])), 7)
            }
        }
    },
    duplicateEnumerationAndAliases: () => {
        const stop = id(0), first = id(0), second = id(0), output = id(0)
        const value = /** @type {Value} */ (['object', [
            [':', 'a', ref(first)], ['...', ['object', [[':', 'b', ref(first)], [':', 'a', ref(second)], [':', 2, 'two']]]],
            [':', '__proto__', ref(first)], ['...', ['object', [[':', 1, 'one'], [':', '__proto__', ref(second)], [':', 'b', ref(second)]]]],
            [':', 'c', mixed(ref(stop), ref(first), ref(second))], [':', 'a', ref(first)],
        ]])
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [stop], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(output), ref(output), ref(first), ref(second), ['()', ['Object.entries'], [ref(output)]]]]], [
                ['define', first, ['array', [4]], 'required'], ['define', second, ['array', [9]], 'required'], ['define', output, value, 'required'],
            ]),
        })
        assertStructurallySame(evaluate(calledFunction(fn, [true])), [9])
        const normal = evaluate(calledFunction(fn, [false]))
        assert(normal instanceof Array && normal[0] !== null && typeof normal[0] === 'object' && normal[4] instanceof Array)
        const object = /** @type {StringMap<unknown>} */ (normal[0])
        assertEq(normal[0], normal[1])
        assertEq(object.a, normal[2])
        assertEq(object.b, normal[3])
        assertEq(object.c, normal[2])
        assert(Object.hasOwn(object, '__proto__'))
        assertEq(object['__proto__'], normal[3])
        assertStructurallySame(Object.keys(object), ['1', '2', 'a', 'b', '__proto__', 'c'])
        assertStructurallySame(normal[4].map(entry => { assert(entry instanceof Array); return entry[0] }), ['1', '2', 'a', 'b', '__proto__', 'c'])
    },
    integerKeyEnumerationBoundaries: () => {
        const value = evaluate(calledFunction(requiredFunction(['object', [
            [':', '01', 'leading'],
            ['...', ['object', [[':', '10', 'ten'], [':', '2', 'two'], [':', '4294967294', 'last index'], [':', '4294967295', 'ordinary']]]],
            [':', 'after', mixed(false, 1)], ['...', ['object', [[':', '01', 'replaced'], [':', 'extra', 2]]]], [':', '2', 'replacement'],
        ]])))
        assert(value !== null && typeof value === 'object' && !(value instanceof Array))
        assertStructurallySame(Object.entries(value), [
            ['2', 'replacement'], ['10', 'ten'], ['4294967294', 'last index'], ['01', 'replaced'],
            ['4294967295', 'ordinary'], ['after', 1], ['extra', 2],
        ])
    },
    stringSpreadsUseUtf16Properties: () => {
        const value = /** @type {Value} */ (['object', [
            ['...', '😀'], [':', 'middle', 1], ['...', '\ud800X\udfff'], [':', 'tail', mixed(false, 2)],
        ]])
        const actual = evaluate(calledFunction(requiredFunction(value)))
        assert(actual !== null && typeof actual === 'object' && !(actual instanceof Array))
        assertStructurallySame(Object.entries(actual), [['0', '\ud800'], ['1', 'X'], ['2', '\udfff'], ['middle', 1], ['tail', 2]])
        const astral = evaluate(calledFunction(requiredFunction(['object', [['...', '😀'], [':', 'tail', mixed(false, 3)]]])))
        assert(astral !== null && typeof astral === 'object' && !(astral instanceof Array))
        assertStructurallySame(Object.entries(astral), [['0', '\ud83d'], ['1', '\ude00'], ['tail', 3]])
    },
    nonobjectSpreadsAndArrayIndices: () => {
        for (const source of /** @type {readonly Value[]} */ ([null, undefined, false, true, 0, 7n, simpleFunction(1)])) {
            assertStructurallySame(evaluate(calledFunction(requiredFunction(['object', [
                [':', 'before', 1], ['...', source], [':', 'after', mixed(false, 2)],
            ]]))), { before: 1, after: 2 })
        }
        assertStructurallySame(evaluate(calledFunction(requiredFunction(['object', [
            ['...', ['array', ['a', 'b']]], [':', '1', 'replaced'], ['...', ['array', []]], [':', 'tail', mixed(false, 3)],
        ]]))), { 0: 'a', 1: 'replaced', tail: 3 })
    },
    skippedOuterRegionsAndNestedConsumers: () => {
        const object = /** @type {Value} */ (['object', [['...', failed('unreached source')], [':', 'x', escape()]]])
        assertEq(evaluate(calledFunction(requiredFunction(['if', false, result(object), result(11)]))), 11)
        assertEq(evaluate(calledFunction(requiredFunction(['?.', null, 'x', ['|()', [object]]]))), undefined)
        assertEq(evaluate(calledFunction(requiredFunction(['array', [1, ['object', [['...', ['object', []]], [':', 'x', escape(12)]]], failed('tail')]]))), 12)
    },
    memoCallerAndInitializerSharing: () => {
        const stop = id(0), caller = id(0), selected = id(0), recipeLocal = id(0), output = id(0)
        const payload = /** @type {Value} */ (['array', [ref(selected), ref(selected), ref(caller)]])
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [stop], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [ref(output), ref(selected), ref(caller)]]], [
                ['define', caller, ['array', [4]], 'lazy'],
                ['define', selected, ['block', result(['object', [[':', 'shared', ref(recipeLocal)], [':', 'alias', ref(recipeLocal)]]], [
                    ['define', recipeLocal, ['array', [ref(caller)]], 'lazy'],
                ])], 'lazy'],
                ['define', output, ['object', [['...', ref(selected)], [':', 'tail', mixed(ref(stop), ref(caller), payload)], ['...', ref(selected)]]], 'required'],
            ]),
        })
        const normal = evaluate(calledFunction(fn, [false]))
        assert(normal instanceof Array && normal[0] !== null && typeof normal[0] === 'object' && normal[1] !== null && typeof normal[1] === 'object')
        const object = /** @type {StringMap<unknown>} */ (normal[0])
        const source = /** @type {StringMap<unknown>} */ (normal[1])
        assertEq(object.shared, object.alias)
        assertEq(object.shared, source.shared)
        assertEq(source.shared, source.alias)
        assertEq(object.tail, normal[2])
        assert(source.shared instanceof Array)
        assertEq(source.shared[0], normal[2])
        const returned = evaluate(calledFunction(fn, [true]))
        assert(returned instanceof Array && returned[0] !== null && typeof returned[0] === 'object')
        assertEq(returned[0], returned[1])
        const returnedSource = /** @type {StringMap<unknown>} */ (returned[0])
        assertEq(returnedSource.shared, returnedSource.alias)
        assert(returnedSource.shared instanceof Array)
        assertEq(returnedSource.shared[0], returned[2])
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
                    ['define', made, ['object', [
                        ['...', ['object', [[':', 'before', ref(local)]]]],
                        [':', 'tail', mixed(['===', ref(count), 1], ref(local), getter)],
                    ]], 'required'],
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
        const stop = id(0), argument = id(0), rest = id(0), captured = id(0), self = id(0), output = id(0)
        const fn = /** @type {FastFunction} */ ({
            target, parameters: [stop, argument], rest, self, captures: [{ binding: captured, value: ['array', [4]] }],
            body: body(['return', target, ['array', [ref(output), ref(captured), ref(rest), ['===', ref(self), ref(self)]]]], [
                ['define', output, ['object', [
                    ['...', ['object', [[':', 'argument', ref(argument)], [':', 'capture', ref(captured)]]]],
                    [':', 'args', mixed(ref(stop), ref(rest), ['array', [ref(captured), ref(captured), ref(rest)]])], ['...', ref(rest)],
                ]], 'required'],
            ]),
        })
        let graph = fromFast(result(['function', fn]))
        /** @type {readonly Exp[]} */
        let graphs = [graph]
        for (let index = 0; index < 6; index += 1) {
            graph = fromFast(assertOk(toFast(graph)))
            graphs = [...graphs, graph]
        }
        for (const later of graphs.slice(4)) { assertStructurallySame(flat(later), flat(graphs[3])) }
        for (const current of graphs) {
            assert(current instanceof Array && current[0] === '=>')
            assertEq(current[1], 2)
            assertEq(current[2].length, 1)
            const returned = evaluate(['()', current, [true, 1, 8, 9]])
            assert(returned instanceof Array)
            assertEq(returned[0], returned[1])
            assertStructurallySame(returned, [[4], [4], [8, 9]])
            const normal = evaluate(['()', current, [false, 1, 8, 9]])
            assert(normal instanceof Array && normal[0] !== null && typeof normal[0] === 'object')
            const object = /** @type {StringMap<unknown>} */ (normal[0])
            assertEq(object.capture, normal[1])
            assertEq(object.args, normal[2])
            assertEq(normal[3], true)
            assertStructurallySame(Object.entries(object), [['0', 8], ['1', 9], ['argument', 1], ['capture', [4]], ['args', [8, 9]]])
        }
    },
    noReturnIdentityAndIdempotence: () => {
        for (const value of /** @type {readonly Value[]} */ ([
            ['object', [['...', null], [':', 'x', 1]]], ['object', [['...', '😀'], [':', ['array', [1, 2]], 3]]],
            ['object', [['...', ['object', [[':', '__proto__', 4]]]], [':', 'a', 5], ['...', ['array', [6]]]]],
        ])) {
            const source = requiredFunction(value).body
            assertEq(liftReturns(source, target), source)
        }
        const source = requiredFunction(['object', [['...', ['object', []]], [':', 'x', mixed(false, 2)]]]).body
        const lifted = liftReturns(source, target)
        assert(lifted !== source)
        assertEq(liftReturns(lifted, target), lifted)
    },
    captureObjectSpreadReturn: () => {
        const captured = id(0)
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        assertEq(evaluate(calledFunction(requiredFunction(['function', {
            target: owner, parameters: [], rest: null, self: null,
            captures: [{ binding: captured, value: ['object', [['...', escape()]]] }],
            body: body(['return', owner, ref(captured)]),
        }]))), 7)
    },
    throw: {
        foreignSpreadReturn: () => {
            const foreign = /** @type {const} */ ({ kind: 'function', index: 0 })
            const wrong = /** @type {Value} */ (['block', body(['return', foreign, 7])])
            fromFast(result(['function', requiredFunction(['object', [['...', wrong]]])]))
        },
    },
})
