/**
 * The shared dispatcher threads an interpreter's immutable state through only
 * demanded operands. Operands here use Amnesia, while the state records each
 * demand so evaluation order and failure propagation remain observable.
 *
 * @import { Exp, ExpOp } from '../types.ts'
 * @import { Closure, EdagValue, Runtime } from '../value/types.ts'
 * @import { Outcome } from '../value/call/types.ts'
 * @import { Context, Evaluator } from './types.ts'
 */

import { conditional } from '../testlib.f.js'
import { assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { invokerWith, noIn, operation, staticCall } from './module.f.mjs'
import { read } from '../value/property/module.f.mjs'
import runtimeEdag from '../../js/runtime/gen.edag.data.js'
import { noStatic, staticIds, staticPath } from '../module.f.mjs'
import { isNative } from '../../js/static/module.f.js'
import { invoke, invokeWith, vm } from '../amnesia/module.f.mjs'
import { settle } from '../value/call/module.f.mjs'

/** @type {Context} */
const context = { frame: ['F'], args: [10, 20], fixed: [4], rest: ['[]', [5]] }
/** @type {Evaluator<Exp, readonly Exp[]>} */
const evaluator = {
    context,
    operand: (e, state) => [[...state, e], vm(context)(e)],
    tail: (e, state) => [[...state, e], vm(context)(e)],
    expression: e => e,
    invoke,
}
const dispatch = operation(evaluator)

/** The node's outcome with the call it leaves, if one, made. @type {(e: ExpOp, state: readonly Exp[]) => readonly [readonly Exp[], import('../value/control/types.ts').ValueResult]} */
const run = (e, state) => {
    const [next, outcome] = dispatch(e, state)
    return [next, settle(invoke)(outcome)]
}

/** @type {(e: ExpOp, expected: EdagValue) => void} */
const eq = (e, expected) => { assertStructurallySame(run(e, [])[1], ['ok', expected]) }
/** @type {(e: ExpOp, expected?: EdagValue) => void} */
const failure = (e, expected = ['undefined']) => { assertStructurallySame(run(e, [])[1], ['error', expected]) }
/** @type {import('../types.ts').Function} */
const identity = ['=>', 1, [], ['arg', 0]]

/** A runtime whose `in` is a function of two parameters with the body given. @type {(body: Exp) => Runtime} */
const inRuntime = body => ['{}', [[':', 'in', ['=>', 2, [], body]]]]

/** A node evaluated under the executor's context with the runtime given, or none. @type {(runtime: Runtime | undefined, node: Exp) => unknown} */
const under = (runtime, node) => vm({ ...context, runtime })(node)
/** @type {import('../types.ts').Object} */
const throws = ['{}', [[':', 'valueOf', ['=>', 0, [], ['throw', 'conversion']]]]]

export const proof = {
    // `self` is the function being invoked, the same value every read, so
    // a body calls itself through it and compares it to itself as one;
    // outside a function there is none, and the evaluator throws
    self: () => {
        /** @type {Exp} */
        const fact = ['=>', 1, [], ['?:', ['<', ['arg', 0], 2], 1, ['*', ['arg', 0], ['()', ['self'], [['-', ['arg', 0], 1]]]]]]
        eq(['()', fact, [5]], 120)
        eq(['()', ['=>', 0, [], ['===', ['self'], ['self']]], []], true)
        // a nested function reaches its parent's `self` through a slot
        eq(['()', ['=>', 1, [], ['?:', ['arg', 0], ['()', ['=>', 0, [['self']], ['()', ['frame', 0], [0]]], []], 'base']], [1]], 'base')
        failure(['self'])
    },
    operators: () => {
        eq(['!', 0], true)
        eq(['~', 0], -1)
        eq(['Number', '42'], 42)
        eq(['String', 42], '42')
        eq(['typeof', 1n], 'bigint')
        // `instanceof Array`: an array's own tag and nothing else, never a
        // throw — `null`, `undefined`, an object and a function included
        eq(['instanceof', ['[]', []], 'Array'], true)
        eq(['instanceof', ['[]', [1, ['[]', []]]], 'Array'], true)
        eq(['instanceof', ['{}', []], 'Array'], false)
        eq(['instanceof', null, 'Array'], false)
        eq(['instanceof', ['undefined'], 'Array'], false)
        eq(['instanceof', 'a', 'Array'], false)
        eq(['instanceof', 1, 'Array'], false)
        eq(['instanceof', identity, 'Array'], false)
        eq(['+', '5'], 5)
        eq(['-', 5], -5)
        eq(['+', 2, 3], 5)
        eq(['-', 2, 3], -1)
        eq(['*', 2, 3], 6)
        eq(['/', 6, 3], 2)
        eq(['%', 7, 3], 1)
        eq(['**', 2, 3], 8)
        eq(['===', 2, 2], true)
        eq(['!==', 2, 3], true)
        eq(['<', 2, 3], true)
        eq(['<=', 3, 3], true)
        eq(['>', 2, 3], false)
        eq(['>=', 3, 3], true)
        eq(['&', 6, 3], 2)
        eq(['|', 6, 3], 7)
        eq(['^', 6, 3], 5)
        eq(['<<', 1, 3], 8)
        eq(['>>', -8, 1], -4)
        eq(['>>>', -1, 31], 1)
        eq(conditional("&&", 0, 1), 0)
        eq(conditional("&&", 2, 1), 1)
        eq(conditional("||", 0, 1), 1)
        eq(conditional("||", 2, 1), 2)
        eq(conditional("??", null, 1), 1)
        eq(conditional("??", 0, 1), 0)
        eq(['?:', true, 1, 2], 1)
        eq(['?:', false, 1, 2], 2)
        eq([',', [1, 2]], 2)
        eq([',', []], ['undefined'])
    },
    context: () => {
        eq(['undefined'], ['undefined'])
        eq(['frame', 0], 'F')
        eq(['args'], ['[]', [10, 20]])
        eq(['arg', 0], 4)
        eq(['rest'], ['[]', [5]])
    },
    containers: () => {
        eq(['[]', [1, ['...', ['[]', [2, 3]]]]], ['[]', [1, 2, 3]])
        eq(['{}', [[':', 'a', 1], ['...', ['{}', [[':', 'b', 2]]]]]], ['{}', [[':', 'a', 1], [':', 'b', 2]]])
        eq(['{}', [[':', 1, 2]]], ['{}', [[':', '1', 2]]])
        failure(['[]', [['...', null]]])
        failure(['{}', [['...', ['throw', 'spread']]]], 'spread')
        failure(['{}', [[':', ['{}', [[':', 'toString', ['=>', 0, [], ['throw', 'key']]]]], 1]]], 'key')
        failure(['{}', [[':', 'key', ['throw', 'value']]]], 'value')
    },
    reads: () => {
        const object = /** @type {const} */ (['{}', [[':', 'a', 7]]])
        eq(['.', object, 'a'], 7)
        eq(['()', ['entry'], [object, 'a']], 7)
        eq(['?.', null, 'a'], ['undefined'])
        eq(['?.', object, 'a'], 7)
        eq(['?.', ['{}', [[':', 'a', object]]], 'a', ['|.', 'a']], 7)
        eq(['()', ['entry'], [object, 1]], ['undefined'])
        failure(['()', ['entry'], [null, 'a']])
        eq(['()', ['hasEntry'], [object, 'a']], true)
        eq(['()', ['hasEntry'], [object, 1]], false)
        eq(['()', ['hasEntry'], [['{}', [[':', 'u', ['undefined']]]], 'u']], true)
        failure(['()', ['hasEntry'], [null, 'a']])
        eq(['()', ['slice'], ['abc', 1]], 'bc')
        eq(['()', ['slice'], [['{}', [[':', 'slice', ['=>', 0, [], 7]]]], 1]], 7)
        failure(['()', ['slice'], [null, 1]])
        failure(['()', ['slice'], [['{}', []], 1]])
        eq(['()', ['charCodeAt'], ['abc', 2]], 0x63)
        failure(['()', ['charCodeAt'], [null, 0]])
        failure(['.', null, 'a', ['|()', []]])
    },
    memberPresent: () => {
        for (const value of [null, ['undefined']]) {
            for (const name of ['field', 'toString']) {
                eq(['memberPresent', ['{}', [[':', name, /** @type {Exp} */ (value)]]], name], false)
            }
        }
        for (const value of [0, false, '', identity]) {
            eq(['memberPresent', ['{}', [[':', 'field', /** @type {Exp} */ (value)]]], 'field'], true)
        }
        eq(['memberPresent', ['{}', []], 'missing'], false)
        eq(['memberPresent', ['{}', []], 'toString'], true)
        eq(['memberPresent', ['[]', []], 'length'], true)
        eq(['memberPresent', ['[]', [0]], 0], true)
        eq(['memberPresent', ['[]', [null]], ['Number', '0']], false)
        eq(['memberPresent', ['[]', [['undefined']]], 0], false)
        eq(['memberPresent', ['[]', []], 0], false)
        eq(['memberPresent', '', 'length'], true)
        eq(['memberPresent', 'abc', ['Number', '1']], true)
        eq(['memberPresent', 'abc', 3], false)
        eq(['memberPresent', identity, 'length'], true)
        eq(['memberPresent', ['entry'], 'length'], true)
        eq(['memberPresent', ['Object.entries'], 'length'], true)
        eq(['memberPresent', 'abc', 'slice'], true)
        eq(['memberPresent', 'abc', 'startsWith'], false)
        eq(['memberPresent', 'abc', 'codePointAt'], false)
        failure(['memberPresent', null, 'field'])
        failure(['memberPresent', ['undefined'], 'field'])
        // A false answer does not stop an ordinary call's argument region;
        // a selected optional region can use it to skip that region.
        eq([',', [['memberPresent', ['{}', []], 'missing'], 7]], 7)
        eq(['?:', ['memberPresent', ['{}', []], 'missing'], ['throw', 'skipped'], 7], 7)
        failure([',', [['memberPresent', null, 'missing'], 7]])
    },
    // The entry check: the runtime's `in` body called with the key, read
    // from the node, and the evaluated operand, in that order; its answer
    // or its throw is the node's, the operand's failure comes first, and
    // an executor with no runtime, or a runtime without the body, refuses
    // the operator by name.
    inOperator: () => {
        const echo = inRuntime(['[]', [['arg', 0], ['arg', 1]]])
        assertStructurallySame(under(echo, ['in', 'x', 5]), ['ok', ['[]', ['x', 5]]])
        assertStructurallySame(under(echo, ['in', '', ['{}', []]]), ['ok', ['[]', ['', ['{}', []]]]])
        assertStructurallySame(under(inRuntime(['throw', 'not an object']), ['in', 'x', 1]), ['error', 'not an object'])
        assertStructurallySame(under(inRuntime(['throw', 'asked']), ['in', 'x', ['throw', 'operand']]), ['error', 'operand'])
        failure(['in', 'x', 5], noIn)
        for (const missing of [/** @type {Runtime} */ (['{}', []]), /** @type {Runtime} */ (['{}', [[':', 'in', 0]]])]) {
            assertStructurallySame(under(missing, ['in', 'x', 5]), ['error', noIn])
        }
        // the language's own runtime, `fjs/js/runtime`, answers it as the
        // record specifies: an enumerable own entry of an object, an array
        // or a function, one holding `undefined` included; neither a
        // `length` nor a function's properties; and a throw on a primitive
        const real = /** @type {Runtime} */ (assertOk(read(vm({ frame: [], args: [] })(/** @type {Exp} */ (/** @type {unknown} */ (runtimeEdag))), 'runtime')))
        assertStructurallySame(under(real, ['in', 'x', ['{}', [[':', 'x', 1]]]]), ['ok', true])
        assertStructurallySame(under(real, ['in', 'x', ['{}', [[':', 'x', ['undefined']]]]]), ['ok', true])
        assertStructurallySame(under(real, ['in', 'y', ['{}', [[':', 'x', 1]]]]), ['ok', false])
        assertStructurallySame(under(real, ['in', '0', ['[]', [7]]]), ['ok', true])
        assertStructurallySame(under(real, ['in', '1', ['[]', [7]]]), ['ok', false])
        assertStructurallySame(under(real, ['in', 'length', ['[]', [7]]]), ['ok', true])
        assertStructurallySame(under(real, ['in', 'length', ['=>', 0, [], 1]]), ['ok', true])
        assertStructurallySame(under(real, ['in', 'length', ['{}', []]]), ['ok', false])
        assertStructurallySame(under(real, ['in', 'length', ['{}', [[':', 'length', 0]]]]), ['ok', true])
        for (const primitive of /** @type {readonly Exp[]} */ ([null, ['undefined'], 1, 'abc', true, 1n])) {
            assertStructurallySame(under(real, ['in', 'x', primitive]), ['error', 'in: not an object'])
        }
        assertStructurallySame(under(real, ['in', '0', 'abc']), ['error', 'in: not an object'])
    },
    memberRuntime: () => {
        /** @type {(answer: Exp) => Runtime} */
        const runtime = answer => ['{}', [[':', 'dot', ['=>', 2, [], answer]]]]
        /** @type {(runtime: Runtime, node: Exp, expected: EdagValue) => void} */
        const check = (runtime, node, expected) => {
            assertStructurallySame(vm({ ...context, runtime })(node), ['ok', expected])
        }
        /** @type {(runtime: Runtime, node: Exp, expected: EdagValue) => void} */
        const refuses = (runtime, node, expected) => {
            assertStructurallySame(vm({ ...context, runtime })(node), ['error', expected])
        }
        for (const answer of [null, 0, false, '', ['{}', []], ['=>', 0, [], ['throw', 'argument-stage']]]) {
            // Runtime answers have the existing undefined-only presence
            // test; a null answer is present, unlike a stored own null.
            check(runtime(/** @type {Exp} */ (answer)), ['memberPresent', 'abc', 'startsWith'], true)
        }
        const absent = runtime(['undefined'])
        check(absent, ['memberPresent', 'abc', 'startsWith'], false)
        check(absent, ['memberPresent', 'abc', 'slice'], true)
        for (const missing of [/** @type {Runtime} */ (['{}', []]), /** @type {Runtime} */ (['{}', [[':', 'dot', 0]]])]) {
            check(missing, ['memberPresent', 'abc', 'startsWith'], false)
            check(missing, ['memberPresent', 'abc', 'slice'], true)
        }
        const throwing = runtime(['throw', 'lookup'])
        refuses(throwing, ['memberPresent', 'abc', 'startsWith'], 'lookup')
        refuses(throwing, ['memberPresent', 'abc', 'slice'], 'lookup')
        refuses(throwing, [',', [['memberPresent', 'abc', 'startsWith'], 7]], 'lookup')
        check(throwing, ['memberPresent', 'abc', 'length'], true)
        check(throwing, ['memberPresent', 'abc', 'missing'], false)
        for (const value of [null, ['undefined'], 0]) {
            check(throwing, ['memberPresent', ['{}', [[':', 'toString', /** @type {Exp} */ (value)]]], 'toString'], value === 0)
        }
        const receiverDependent = runtime(['?:', ['===', ['arg', 0], 'abc'], ['=>', 0, [], ['throw', 'argument-stage']], ['undefined']])
        check(receiverDependent, ['memberPresent', 'abc', 'startsWith'], true)
        check(receiverDependent, ['memberPresent', 'other', 'startsWith'], false)
        // A provider may execute the receiver-stage body, but the query
        // never invokes the argument-stage callable that body returns.
        refuses(runtime(['()', ['=>', 1, [], ['throw', 'receiver-stage']], [['arg', 0]]]), ['memberPresent', 'abc', 'startsWith'], 'receiver-stage')
        check(runtime(['=>', 0, [], ['throw', 'argument-stage']]), ['memberPresent', 'abc', 'startsWith'], true)
    },
    memberStaticRead: () => {
        // A pre-established static receiver still needs its runtime body
        // when its length is read; the query performs that read first.
        /** @type {(runtime: Runtime | undefined) => import('../value/control/types.ts').ValueResult} */
        const query = runtime => vm({ frame: [['Object.is']], args: [], runtime })(['memberPresent', ['frame', 0], 'length'])
        assertStructurallySame(query(undefined), ['error', noStatic('Object.is')])
        assertStructurallySame(query(['{}', []]), ['error', noStatic('Object.is')])
        assertStructurallySame(query(['{}', [[':', 'static', ['=>', 1, [], ['throw', 'static-read']]]]]), ['error', 'static-read'])
        assertStructurallySame(query(['{}', [[':', 'static', ['=>', 1, [], ['=>', 0, [], 0]]]]]), ['ok', true])
    },
    memberEvaluationOrder: () => {
        const stop = /** @type {const} */ (['throw', 'receiver'])
        const key = /** @type {const} */ (['Number', 0])
        assertStructurallySame(run(['memberPresent', stop, key], [])[0], [stop])
        assertStructurallySame(run(['memberPresent', null, key], [])[0], [null, key])
        const conversion = /** @type {const} */ (['Number', ['{}', [[':', 'valueOf', ['=>', 0, [], ['throw', 'key']]]]]])
        assertStructurallySame(run(['memberPresent', null, conversion], []), [[null, conversion], ['error', 'key']])
        // The optional receiver guard belongs outside the query and its
        // computed key, so neither is reached on the skipped path.
        assertStructurallySame(run(['?:', false, ['memberPresent', null, conversion], 7], [])[0], [false, 7])
    },
    // A static function is a value whether called or not, the node, one
    // function by its name; the body the runtime's `static` answers for its id
    // answers its call, with the static as the body's `self`,
    // and its `length`, and its text is its name's. With no runtime, or
    // none at the path, the dispatcher fails naming it at the read — every
    // static with a body alike — and the invoker at the call.
    objectIs: () => {
        failure(['()', ['Object.is'], [1, 1]], noStatic('Object.is'))
        failure(['Object.is'], 'no binding for the static Object.is')
        // a `static` that throws is the call's throw, asked for the body
        // directly, as the executors ask after the read
        /** @type {EdagValue} */
        const throwing = ['{}', [[':', 'static', ['=>', 1, [], ['throw', 'boom']]]]]
        const asked = invokeWith(throwing)
        assertEq(assertError(settle(asked)(staticCall(throwing, ['Object.is'], ['[]', []], () => { throw 'unreached' }, asked))), 'boom')
        const throwingRead = operation({ ...evaluator, context: { ...context, runtime: throwing }, invoke: asked })
        assertStructurallySame(throwingRead(['Object.is'], []), [[], ['error', 'boom']])
        for (const id of staticIds.filter(id => !isNative(staticPath(id)))) { failure([id], noStatic(id)) }
        /** @type {Context} */
        const withRuntime = {
            ...context,
            runtime: ['{}', [[':', 'static', ['=>', 1, [['{}', [[':', 'Object.is', ['=>', 2, [], ['[]', [['===', ['arg', 0], ['arg', 1]], ['self'], ['rest']]]]]]]], ['()', ['entry'], [['frame', 0], ['arg', 0]]]]]]],
        }
        const invokeBound = invokeWith(withRuntime.runtime)
        const bound = operation({ ...evaluator, context: withRuntime, invoke: invokeBound, operand: (e, state) => [[...state, e], vm(withRuntime)(e)] })
        /** @type {(e: ExpOp, expected: EdagValue) => void} */
        const boundEq = (e, expected) => { assertStructurallySame(settle(invokeBound)(bound(e, [])[1]), ['ok', expected]) }
        boundEq(['()', ['Object.is'], ['a', 'a', 'b']], ['[]', [true, ['Object.is'], ['[]', ['b']]]])
        boundEq(['Object.is'], ['Object.is'])
        boundEq(['.', ['Object.is'], 'length'], 2)
        boundEq(['.', ['Object.is'], 'name'], ['undefined'])
        boundEq(['String', ['Object.is']], 'function is() { [native code] }')
        boundEq(['===', ['Object.is'], ['Object.is']], true)
        // the static read, bound; its call, through an invoker without the
        // runtime, is the same failure
        assertStructurallySame(settle(invoke)(bound(['()', ['Object.is'], ['a', 'a']], [])[1]), ['error', noStatic('Object.is')])
    },
    // `Object.entries` is the dispatcher's own, with no runtime: a static
    // like every other, called natively on its first argument.
    objectEntries: () => {
        eq(['Object.entries'], ['Object.entries'])
        eq(['===', ['Object.entries'], ['Object.entries']], true)
        eq(['()', ['Object.entries'], [['{}', [[':', 'b', 1], [':', '0', 2]]]]], ['[]', [['[]', ['0', 2]], ['[]', ['b', 1]]]])
        eq(['.', ['Object.entries'], 'length'], 1)
        eq(['String', ['Object.entries']], 'function entries() { [native code] }')
        failure(['()', ['Object.entries'], [null]])
        failure(['()', ['Object.entries'], []])
    },
    calls: () => {
        const at = /** @type {const} */ (['[]', [42]])
        eq(['()', identity, [1]], 1)
        eq(['.', at, 'at', ['|()', [0]]], 42)
        eq(['.', at, 'at', ['|?.()', [0], ['|.', 'toFixed', ['|()', [1]]]]], '42.0')
        eq(['?.', at, 'at', ['|()', [0]]], 42)
        eq(['?.', at, 'at', ['|?.()', [0]]], 42)
        eq(['?.', null, 'at', ['|.', 'x']], ['undefined'])
        eq(['?.', ['{}', [[':', 'f', null]]], 'f', ['|?.()', [0], ['|.', 'x']]], ['undefined'])
        eq(['?.()', null, [0]], ['undefined'])
        eq(['?.()', identity, [3]], 3)
        eq(['?.()', ['=>', 1, [], ['{}', [[':', 'y', ['arg', 0]]]]], [3], ['|.', 'y']], 3)
        eq(['?.()', ['=>', 0, [], identity], [], ['|()', [7]]], 7)
        eq(['?.', ['{}', [[':', 'f', identity]]], 'f', ['|?.()', [8]]], 8)
        eq(['.', ['{}', [[':', 'toString', ['=>', 0, [], 'own']]]], 'toString', ['|()', []]], 'own')
        failure(['?.', null, 'a', ['|!()', []]])
        failure(['?.', ['{}', []], 'a', ['|!()', []]])
        failure(['()', 1, [2]])
        failure(['?.()', identity, [['throw', 9]]], 9)
    },
    lambda: () => {
        const f = assertOk(run(['=>', 0, ['captured'], ['frame', 0]], [])[1])
        assertStructurallySame(f, ['=>', 0, ['captured'], ['frame', 0]])
        eq(['()', ['=>', 0, ['captured'], ['frame', 0]], []], 'captured')
        eq(['()', ['=>', 0, [], ['rest']], [1, 2]], ['[]', [1, 2]])
        // Sharing policy survives a call and a builtin callback invocation.
        const child = /** @type {const} */ (['[]', []])
        const body = /** @type {const} */ (['===', child, child])
        eq(['()', ['=>', 0, [], body], []], false)
        eq(['.', ['[]', [1]], 'map', ['|()', [['=>', 0, [], body]]]], ['[]', [false]])
    },
    failures: () => {
        failure(['throw', 1], 1)
        failure(['throw', ['throw', 2]], 2)
        failure(['+', 0n])
        failure(['+', throws, 1], 'conversion')
        failure(['+', 1, throws], 'conversion')
        failure(['!', ['throw', 1]], 1)
        failure([',', [1, ['throw', 2], 3]], 2)
    },
    // `invokerWith` is an executor given only its `run`: a closure is run
    // under its invocation's context — its frame, its bindings, itself as
    // `self` and the runtime; a static's body found in the runtime is run
    // with the static as `self`; the helpers and an intrinsic are answered
    // in place; and a call a body leaves is made in its place.
    invokerWith: () => {
        /** The context echoed for `'echo'`, a call left for `'tail'`, every other body walked by Amnesia. @type {(fn: Closure, context: Context) => Outcome} */
        const echo = (fn, context) =>
            fn[3] === 'echo' ? ['ok', ['[]', [['[]', context.frame], ['[]', context.args], ['[]', context.fixed ?? []], context.rest ?? ['[]', []], context.self ?? null, context.runtime ?? null]]]
            : fn[3] === 'tail' ? ['call', ['=>', 1, ['g'], 'echo'], [7], ['[]', [8]]]
            : vm(context)(fn[3])
        /** @type {Closure} */
        const f = ['=>', 1, ['captured'], 'echo']
        const bare = invokerWith(echo)(undefined)
        assertStructurallySame(bare(f, [1], ['[]', [2]]), ['ok', ['[]', [['[]', ['captured']], ['[]', []], ['[]', [1]], ['[]', [2]], f, null]]])
        assertStructurallySame(bare(['=>', 0, [], 'tail'], [], ['[]', []]), ['ok', ['[]', [['[]', ['g']], ['[]', []], ['[]', [7]], ['[]', [8]], ['=>', 1, ['g'], 'echo'], null]]])
        assertStructurallySame(bare(['entry'], [['{}', [[':', 'a', 1]]], 'a'], ['[]', []]), ['ok', 1])
        assertStructurallySame(bare(['hasEntry'], [['{}', [[':', 'a', 1]]], 'b'], ['[]', []]), ['ok', false])
        assertStructurallySame(bare(['slice'], ['abcd', 1, 3], ['[]', []]), ['ok', 'bc'])
        assertStructurallySame(bare(['Object.is'], [], ['[]', []]), ['error', noStatic('Object.is')])
        /** @type {EdagValue} */
        const runtime = ['{}', [[':', 'static', ['=>', 1, [], ['=>', 2, [], 'echo']]]]]
        assertStructurallySame(invokerWith(echo)(runtime)(['Object.is'], [], ['[]', [1, 2, 3]]), ['ok', ['[]', [['[]', []], ['[]', []], ['[]', [1, 2]], ['[]', [3]], ['Object.is'], runtime]]])
    },
    evaluationOrder: () => {
        const [state, result] = run(['+', 1, 2], ['already'])
        assertStructurallySame(state, ['already', 1, 2])
        assertStructurallySame(result, ['ok', 3])
        assertStructurallySame(run(conditional("&&", 0, ['throw', 1]), [])[0], [0, 0])
        assertStructurallySame(run(['?:', true, 1, ['throw', 2]], [])[0], [true, 1])
        const stop = /** @type {const} */ (['throw', 1])
        assertEq(run(['+', stop, 2], [])[0].length, 1)
        assertStructurallySame(run(['+', throws, 2], [])[0], [throws, 2])
        assertStructurallySame(run(['[]', [1, stop, 3]], [])[0], [1, stop])
        assertStructurallySame(run(['{}', [[':', 'a', 1], [':', 'b', stop]]], [])[0], ['a', 1, 'b', stop])
        assertStructurallySame(run(['?.', null, 'a', ['|!()', [2]]], [])[0], [null, 2])
    },
}
