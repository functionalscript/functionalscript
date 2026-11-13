/**
 * Operand-local required work retains its execution point during construction.
 *
 * @import { BindingId, Block, Function as FastFunction, Loop, Value } from '../../../js/ast/types.ts'
 * @import { Exp } from '../../types.ts'
 * @import { Runtime } from '../../value/types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { fromFast } from '../module.f.mjs'
import { toFast } from '../../to_fast/module.f.mjs'
import { identityAnalysis } from '../../analysis/module.f.mjs'
import { vm } from '../../amnesia/module.f.mjs'
import { memo } from '../../memo/module.f.mjs'
import { _id as id, _ref as ref, _result as result, _target as target, _body as body } from '../proof.f.mjs'
import { requiredFunction, failed, evaluate, flat, throwingRuntime } from '../member_returns/proof.f.mjs'
import { tryStringify } from '../../../compiler/serializer/module.f.mjs'
import { parse } from '../../../compiler/transpiler/module.f.mjs'
import { _defaultExport, unresolved } from '../../../compiler/edag/module.f.mjs'

/** A value block retains required work even when its result ignores it. @type {(value: Value, work: Value) => Value} */
export const _anchored = (value, work) => ['block', result(value, [['define', id(0), work, 'required']])]

/** The callee computation itself fails before any containing arguments. @type {Value} */
export const _invalid = ['()', 0, []]

/** @type {(graph: Exp) => Exp} */
export const _convert = graph => fromFast(assertOk(toFast(graph)))

/** The two supplied graph reproductions retain distinct first failures. @type {readonly (readonly [Exp, Exp])[]} */
export const _graphs = (() => {
    const bad = /** @type {const} */ (['.', null, 'x'])
    const both = /** @type {const} */ (['[]', [bad, bad]])
    return [
        [['[]', [['()', 0, []], [',', [['throw', 'later'], 1]]]], ['undefined']],
        [['===', ['throw', 'earlier'], ['.', bad, 'f', ['|()', [both, both]]]], 'earlier'],
    ]
})()

/** Invocation-local represented executors agree before and after conversion. @type {(graph: Exp, expected: Exp, runtime?: Runtime) => void} */
const firstFailure = (graph, expected, runtime) => {
    for (const current of [graph, _convert(graph)]) {
        assertStructurallySame(memo(assertOk(identityAnalysis(current)))({ args: [], runtime }), ['error', expected])
        assertStructurallySame(vm({ args: [], frame: [], runtime })(current), ['error', expected])
    }
}

/** Two retained local definitions share their allocation in the operand. @type {() => Exp} */
const successfulGraph = () => {
    const local = id(0), box = id(0)
    const operand = /** @type {Value} */ (['block', result(['array', [ref(box), ref(local), ref(local)]], [
        ['define', local, ['array', [4]], 'required'], ['define', box, ['array', [ref(local)]], 'required'],
    ])])
    return fromFast(result(['array', [0, operand]]))
}

/** @type {(source: string) => Exp} */
const sourceGraph = source => _defaultExport(unresolved(assertOk(parse('/operand-order.f.js')(source))).edag)

/** Helper captures execute before loop-entry initializer work. @type {() => { readonly external: BindingId; readonly block: Block }} */
export const _loopEntry = () => {
    const external = id(0), parameter = id(0), output = id(0)
    const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
    const loop = /** @type {Loop} */ ({ target, parameters: [parameter], initial: [_anchored(0, failed('later initial'))], results: [output],
        body: body(['break', target, [ref(external)]]),
    })
    return { external, block: result(ref(output), [['loop', loop]]) }
}

/** @type {(value: Value, later?: Value) => readonly Value[]} */
export const _consumers = (value, later = _anchored(1, failed('later'))) => {
    const first = id(0), second = id(0)
    const fn = /** @type {FastFunction} */ ({ target, parameters: [], rest: null, self: null,
        captures: [{ binding: first, value }, { binding: second, value: later }],
        body: body(['return', target, ['array', [ref(first), ref(second)]]]),
    })
    return [
        ['+', value, later],
        ['array', [value, later]],
        ['object', [[':', 'first', value], [':', 'second', later]]],
        ['()', value, [later]],
        ['()', ['function', requiredFunction(0)], [value, later]],
        ['.', value, ['Number', later]],
        ['function', fn],
    ]
}

export const proof = {
    suppliedGraphsRetainTheirFirstFailure: () => {
        for (const [graph, expected] of _graphs) { firstFailure(graph, expected) }
    },
    eagerConsumersKeepEarlierFailedComputations: () => {
        for (const value of _consumers(_invalid)) { firstFailure(fromFast(result(value)), ['undefined']) }
    },
    earlierOperatorCoercionPrecedesLaterAnchors: () => {
        const object = /** @type {Value} */ (['object', [[':', 'valueOf', ['function', requiredFunction(failed('coercion'))]]]])
        firstFailure(fromFast(result(['array', [['-', object], _anchored(1, failed('later'))]])), 'coercion')
    },
    implicitExpansionAndLookupPrecedeLaterAnchors: () => {
        const later = _anchored(1, failed('later'))
        const values = /** @type {readonly Value[]} */ ([
            ['array', [['...', null], later]],
            ['()', ['function', requiredFunction(0)], [['...', null], later]],
            ['.', null, 'f', ['|()', [later]]],
        ])
        for (const value of values) { firstFailure(fromFast(result(value)), ['undefined']) }
        firstFailure(fromFast(result(['.', 'abc', 'slice', ['|()', [later]]])), 'lookup', throwingRuntime)
    },
    computedKeysConvertBeforeTheirValuesAndArguments: () => {
        const numeric = /** @type {Value} */ (['object', [[':', 'valueOf', ['function', requiredFunction(failed('numeric key'))]]]])
        const string = /** @type {Value} */ (['object', [[':', 'toString', ['function', requiredFunction(failed('string key'))]]]])
        firstFailure(fromFast(result(['object', [[':', string, _anchored(1, failed('later'))]]])), 'string key')
        firstFailure(fromFast(result(['.', ['array', [0]], ['Number', numeric], ['|()', [_anchored(1, failed('later'))]]])), 'numeric key')
    },
    callableValidationStillFollowsArguments: () => {
        firstFailure(fromFast(result(['()', 0, [_anchored(1, failed('argument'))]])), 'argument')
        firstFailure(fromFast(result(['.', ['object', [[':', 'f', 0]]], 'f', ['|()', [_anchored(1, failed('argument'))]]])), 'argument')
    },
    externalLoopCapturesPrecedeEntryAnchors: () => {
        const { external, block } = _loopEntry()
        firstFailure(fromFast(block, [[external, ['()', 0, []]]]), ['undefined'])
        firstFailure(fromFast(block, [[external, ['throw', 'capture']]]), 'capture')
    },
    multipleNormalResultsRetainOperandOrderAndSharing: () => {
        const first = id(0), second = id(0), shared = id(0)
        const yielded = body(['yield', [_invalid, _anchored(1, failed('later result'))]])
        firstFailure(fromFast(yielded), ['undefined'])
        firstFailure(fromFast(result(['array', [ref(first), ref(second)]], [['block', [first, second], yielded]])), ['undefined'])
        const graph = fromFast(body(['yield', [ref(shared), ref(shared)]], [['define', shared, ['array', [4]], 'required']]))
        for (const current of [graph, _convert(graph)]) {
            const value = evaluate(current)
            assert(value instanceof Array)
            assertStructurallySame(value, [[4], [4]])
            assertEq(value[0], value[1])
        }
    },
    unselectedRegionsDoNotRunTheirAnchors: () => {
        const skipped = _anchored(1, failed('unselected'))
        const values = /** @type {readonly (readonly [Value, unknown])[]} */ ([
            [['?:', false, skipped, 7], 7],
            [['?.()', null, [skipped]], undefined],
            [['?.', null, ['Number', skipped], ['|()', [skipped]]], undefined],
            [['.', ['object', []], 'missing', ['|?.()', [skipped]]], undefined],
        ])
        for (const [value, expected] of values) {
            const graph = fromFast(result(value))
            assertStructurallySame(evaluate(graph), expected)
            assertStructurallySame(evaluate(_convert(graph)), expected)
        }
    },
    sharedLocalValuesAndCapturesStayFreshPerInvocation: () => {
        const argument = id(0), local = id(0), box = id(0), captured = id(0)
        const closure = /** @type {Value} */ (['function', { ...requiredFunction(ref(captured)), captures: [{ binding: captured, value: ref(local) }] }])
        const operand = /** @type {Value} */ (['block', result(['array', [ref(box), ref(local), ref(local), closure]], [
            ['define', local, ['array', [ref(argument)]], 'required'],
            ['define', box, ['array', [ref(local)]], 'required'],
        ])])
        const fn = /** @type {FastFunction} */ ({ target, parameters: [argument], rest: null, self: null, captures: [],
            body: body(['return', target, ['array', [['.', ref(argument), 'length'], operand]]]),
        })
        const original = id(0), factory = id(0), first = id(0), second = id(0)
        const closureOf = (/** @type {Value} */ value) => /** @type {Value} */ (['.', ['.', value, 1], 3])
        const graph = fromFast(result(['array', [
            ['()', closureOf(ref(first)), []], ['()', closureOf(ref(first)), []], ['()', closureOf(ref(second)), []],
            ref(original), ['.', ref(factory), 'length'], ['.', ['.', ref(first), 1], 0], ['.', ref(first), 0],
        ]], [
            ['define', original, ['array', [4]], 'required'], ['define', factory, ['function', fn], 'required'],
            ['define', first, ['()', ref(factory), [ref(original)]], 'required'],
            ['define', second, ['()', ref(factory), [ref(original)]], 'required'],
        ]))
        for (const current of [graph, _convert(graph)]) {
            const value = evaluate(current)
            assert(value instanceof Array && value[0] instanceof Array && value[2] instanceof Array && value[5] instanceof Array)
            assertEq(value[4], 1)
            assertEq(value[6], 1)
            assertEq(value[0], value[1])
            assert(value[0] !== value[2])
            assertEq(value[0][0], value[3])
            assertEq(value[2][0], value[3])
            assertEq(value[5][0], value[0])
        }
    },
    lexicalShadowsAndOuterAliasesSurviveConversion: () => {
        const outer = id(0), local = id(0), alias = id(0)
        const operand = /** @type {Value} */ (['block', result(['array', [ref(local), ref(alias)]], [
            ['define', alias, ref(outer), 'required'], ['define', local, ['array', [9]], 'required'],
        ])])
        const graph = fromFast(result(['array', [ref(outer), operand, ref(outer)]], [['define', outer, ['array', [4]], 'required']]))
        for (const current of [graph, _convert(graph)]) {
            const value = evaluate(current)
            assert(value instanceof Array && value[1] instanceof Array)
            assertStructurallySame(value, [[4], [[9], [4]], [4]])
            assertEq(value[0], value[2])
            assertEq(value[0], value[1][1])
            assert(value[0] !== value[1][0])
        }
    },
    exactGraphsStabilizeWithoutAccumulatingAnchors: () => {
        const graph = successfulGraph()
        let current = graph
        const canonical = flat(graph)
        for (let i = 0; i < 6; i += 1) {
            current = _convert(current)
            assertStructurallySame(flat(current), canonical)
            assertStructurallySame(evaluate(current), [0, [[[4]], [4], [4]]])
        }
    },
    localizedOperandSourceHasAnExactFixedPoint: () => {
        for (const original of [..._graphs.map(([graph]) => graph), successfulGraph()]) {
            let written = assertOk(tryStringify(original))
            const normalized = sourceGraph(written)
            const canonical = flat(normalized)
            for (let i = 0; i < 5; i += 1) {
                const current = sourceGraph(written)
                assertStructurallySame(flat(current), canonical)
                const next = assertOk(tryStringify(current))
                assertEq(next, written)
                written = next
            }
        }
        for (const [original, expected] of _graphs) {
            firstFailure(sourceGraph(assertOk(tryStringify(original))), expected)
        }
    },
    scalarSourceLoopRetainsLocalOperandSharing: () => {
        const original = sourceGraph('const f=n=>{let r=1;while(r<n){r=r*2;}return r;};export default[f(5),(()=>{const a=[];const b=[a];return[b,a,a];})()];')
        let written = assertOk(tryStringify(original))
        const canonical = flat(sourceGraph(written))
        for (let i = 0; i < 5; i += 1) {
            const current = sourceGraph(written)
            assertStructurallySame(flat(current), canonical)
            const next = assertOk(tryStringify(current))
            assertEq(next, written)
            const value = evaluate(current)
            assert(value instanceof Array && value[1] instanceof Array && value[1][0] instanceof Array)
            assertStructurallySame(value, [8, [[[]], [], []]])
            assertEq(value[1][0][0], value[1][1])
            assertEq(value[1][1], value[1][2])
            written = next
        }
    },
}
