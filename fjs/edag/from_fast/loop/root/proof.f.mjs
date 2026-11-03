/**
 * Canonical roots retain the invocation ABI and one opaque public result.
 * @import { BindingId, Block, Exit, Function as FastFunction, Loop, Statement, Value } from '../../../../js/ast/types.ts'
 * @import { Exp } from '../../../types.ts'
 */
import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../../asserts/module.f.js'
import { checked, identityAnalysis } from '../../../analysis/module.f.mjs'
import { memo } from '../../../memo/module.f.mjs'
import { toData } from '../../../value/to_unknown/module.f.mjs'
import { toFast } from '../../../to_fast/module.f.mjs'
import { fromFast } from '../../module.f.mjs'
import { rootLoopOf } from '../module.f.mjs'
import { directInvocationRoot, invocationRootOf } from './module.f.mjs'
import { _restTransition } from '../../../../js/ast/invocation/module.f.js'

/** @type {(index: number) => BindingId} */
const id = index => ({ index })
/** @type {(binding: BindingId) => Value} */
const ref = binding => ['ref', binding]
/** @type {(exit: Block['exit'], statements?: readonly Statement[]) => Block} */
const body = (exit, statements = []) => ({ statements, exit })
const target = /** @type {const} */ ({ kind: 'function', index: 0 })
const loopTarget = /** @type {const} */ ({ kind: 'loop', index: 0 })
const a = id(0), b = id(1), x = id(2), y = id(3), output = id(4), alias = id(5), self = id(6)
/** @type {(region: Block, parameters?: readonly BindingId[]) => Loop} */
const loopOf = (region, parameters = [x, y]) => ({ target: loopTarget, parameters, initial: parameters.map((_, i) => ref([a, b][i])), results: [output], body: region })
/** @type {(loop: Loop) => FastFunction} */
const root = loop => ({ target, parameters: [a, b], rest: null, self: null, captures: [], body: body(['return', target, ref(output)], [['loop', loop]]) })
/** @type {(length: number) => FastFunction} */
const fixedRoot = length => {
    const parameters = Array.from({ length }, () => id(0))
    const states = Array.from({ length }, () => id(0))
    const loop = { ...loopOf(body(['break', loopTarget, [0]])), parameters: states, initial: parameters.map(ref) }
    return { ...root(loop), parameters }
}
const again = id(7)
const entryRest = id(50), currentRest = id(51)
/** @type {(region: Block) => Loop} */
const restLoopOf = region => ({ ...loopOf(region), parameters: [x, y, currentRest], initial: [ref(a), ref(b), ref(entryRest)] })
/** @type {(loop: Loop) => FastFunction} */
const restRoot = loop => ({ ...root(loop), rest: entryRest })
/** @type {readonly Statement[]} */
const entryAliases = [['define', alias, ref(a), 'lazy'], ['define', again, ref(alias), 'required']]
/** @type {(value: Value, prefix?: readonly Statement[]) => FastFunction} */
const retainedEntryRoot = (value, prefix = []) => {
    const loop = loopOf(body(['continue', loopTarget, [ref(x), ref(y)]], [
        ['if', [], ['<', ref(x), 2], body(['continue', loopTarget, [['+', ref(x), 1], ref(y)]]), body(['break', loopTarget, [value]])],
    ]))
    return { ...root(loop), body: body(['return', target, ref(output)], [...prefix, ['loop', loop]]) }
}
/** @type {(value: Value) => Value} */
const capturedValue = value => {
    const captured = id(0)
    const nested = /** @type {const} */ ({ kind: 'function', index: 0 })
    return ['function', { target: nested, parameters: [], rest: null, self: null,
        captures: [{ binding: captured, value }], body: body(['return', nested, ref(captured)]) }]
}
/** @type {(fn: FastFunction) => Exp} */
const graph = fn => fromFast(body(['yield', [['function', fn]]]))
/** @type {(fn: FastFunction, args: readonly Value[]) => import('../../../../types/result/types.ts').Result<unknown, unknown>} */
const evaluate = (fn, args) => {
    const result = memo(assertOk(identityAnalysis(fromFast(body(['yield', [['()', ['function', fn], args]]])))))({ args: [] })
    return result[0] === 'error' ? result : toData(result[1])
}

export const proof = {
    terminalNestedLoopsRetainTheirTransferOwner: () => {
        const nested = /** @type {const} */ ({ kind: 'loop', index: 0 })
        /** @type {Loop} */
        const terminal = { target: nested, parameters: [], initial: [], results: [], body: body(['throw', 7]) }
        const loop = restLoopOf(body(['loop', terminal]))
        const original = restRoot(loop)
        assertEq(invocationRootOf(original), loop)
        const resolved = directInvocationRoot(original, loop)
        assert(resolved.body.exit[0] === 'loop')
        assertEq(resolved.body.exit[1], terminal)
        assertError(evaluate(original, [1, 2]))
        assertError(evaluate(resolved, [1, 2]))
        /** @type {Loop} */
        const escaping = { ...terminal, body: body(['continue', loopTarget, [ref(x), ref(y), ref(currentRest)]]) }
        assertEq(invocationRootOf(restRoot(restLoopOf(body(['loop', escaping])))), null)
    },
    restInvocationsKeepFreshStateAndStableOrdinaryGraphs: () => {
        const args = /** @type {const} */ ([['-', ref(x), 1], ref(y), ['...', ref(currentRest)]])
        const loop = restLoopOf(body(['yield', []], [['if', [], ['>', ref(x), 0], _restTransition(2, args, loopTarget),
            body(['break', loopTarget, [['array', [ref(currentRest), ref(currentRest), ref(y)]]]])]]))
        const fn = restRoot(loop)
        assertEq(invocationRootOf(fn), loop)
        const first = graph(fn)
        let normalized = first
        for (let generation = 0; generation < 5; generation += 1) {
            normalized = fromFast(assertOk(toFast(normalized)))
            assertStructurallySame(assertOk(identityAnalysis(normalized)), assertOk(identityAnalysis(first)))
        }
        const result = assertOk(evaluate(fn, [3, 4, 7, 8]))
        assert(result instanceof Array)
        assertEq(result[0], result[1])
        assertStructurallySame(result, [[7, 8], [7, 8], 4])
        const direct = directInvocationRoot(fn, loop)
        assertEq(direct.rest, entryRest)
        assertEq(direct.parameters, fn.parameters)
        const conditional = direct.body.statements.at(-1)
        assert(conditional !== undefined && conditional[0] === 'if')
        assertEq(conditional[3].statements.length, 0)
        assert(conditional[3].exit[0] === 'return')
        assertEq(/** @type {Extract<Value, readonly ['()', ...unknown[]]>} */ (conditional[3].exit[2])[2], args)
    },
    restEntryAliasesAndPublicArity: () => {
        const restAlias = id(0)
        const loop = restLoopOf(body(['break', loopTarget, [ref(currentRest)]]))
        const entered = /** @type {Loop} */ ({ ...loop, initial: [ref(a), ref(b), ref(restAlias)] })
        const fn = /** @type {FastFunction} */ ({ ...restRoot(entered), body: body(['return', target, ref(output)], [['define', restAlias, ref(entryRest), 'required'], ['loop', entered]]) })
        assertEq(invocationRootOf(fn), entered)
        assertStructurallySame(assertOk(evaluate(fn, [1, 2, 3])), [3])
        const zero = /** @type {Loop} */ ({ ...loop, parameters: [currentRest], initial: [ref(entryRest)] })
        const zeroFn = /** @type {FastFunction} */ ({ ...restRoot(zero), parameters: [] })
        assertEq(invocationRootOf(zeroFn), zero)
        assertStructurallySame(assertOk(evaluate(zeroFn, [1, 2])), [1, 2])
        const wide = fixedRoot(16)
        const wideLoop = /** @type {Extract<Statement, readonly ['loop', ...unknown[]]>} */ (wide.body.statements[0])[1]
        const all = /** @type {Loop} */ ({ ...wideLoop, parameters: [...wideLoop.parameters, currentRest], initial: [...wideLoop.initial, ref(entryRest)], body: body(['break', loopTarget, [ref(currentRest)]]) })
        const wideFn = /** @type {FastFunction} */ ({ ...wide, rest: entryRest, body: body(['return', target, ref(output)], [['loop', all]]) })
        assertEq(invocationRootOf(wideFn), all)
        const value = graph(wideFn)
        assert(value instanceof Array && value[0] === '=>')
        assertEq(value[1], 16)
        assertStructurallySame(assertOk(evaluate(wideFn, Array.from({ length: 18 }, (_, index) => index))), [16, 17])
        assertEq(invocationRootOf({ ...restRoot(loop), body: body(['return', target, ref(output)], [['loop', { ...loop, body: body(['break', loopTarget, [ref(entryRest)]]) }]]) }), null)
    },
    restRootsRequireTheExactFreshTransitionRecipe: () => {
        const recipe = _restTransition(2, [ref(x), ref(y), ['...', ref(currentRest)]], loopTarget)
        const loop = restLoopOf(recipe)
        assertEq(invocationRootOf(restRoot(loop)), loop)
        for (const region of /** @type {readonly Block[]} */ ([
            body(['continue', loopTarget, [ref(x), ref(y), ref(currentRest)]]),
            body(['continue', { ...loopTarget }, [ref(x), ref(y), ref(currentRest)]]),
            body(['break', { ...loopTarget }, [1]]),
            body(['yield', []]),
            { ...recipe, exit: ['continue', loopTarget, [ref(x), ref(y), ['array', []]]] },
        ])) {
            const candidate = restRoot(restLoopOf(region))
            assertEq(invocationRootOf(candidate), region.exit[0] === 'yield' ? candidate.body.statements[0][1] : null)
        }
        const unreachable = restLoopOf(body(['continue', loopTarget, [0]], [['block', [], body(['throw', 7])]]))
        assertEq(invocationRootOf(restRoot(unreachable)), unreachable)
        const normal = restLoopOf(body(['break', loopTarget, [7]], [
            ['block', [], body(['yield', []])],
            ['if', [], ref(x), body(['yield', []]), body(['yield', []])],
        ]))
        assertEq(invocationRootOf(restRoot(normal)), normal)
        const stopped = restLoopOf(body(['break', loopTarget, [7]], [['if', [], ref(x), body(['return', target, 1]), body(['throw', 2])]]))
        assertEq(invocationRootOf(restRoot(stopped)), stopped)
        // An arbitrary FAST loop may borrow an existing array as rest state.
        // Replacing that transition by a call would incorrectly copy it.
        const borrowed = restLoopOf(body(['yield', []], [['if', [], ['>', ref(x), 0],
            body(['continue', loopTarget, [['-', ref(x), 1], ref(y), ref(y)]]),
            body(['break', loopTarget, [['===', ref(currentRest), ref(y)]]])]]))
        assertEq(invocationRootOf(restRoot(borrowed)), null)
        assertEq(assertOk(evaluate(restRoot(borrowed), [1, ['array', [7, 8]]])), true)
    },
    hiddenRestTransitionsUseTheHelperFallback: () => {
        const transfer = /** @type {Value} */ (['block', body(['continue', loopTarget, [ref(x), ref(y), ref(currentRest)]])])
        const local = id(0)
        const inner = /** @type {Loop} */ ({ ...loopOf(body(['continue', loopTarget, [ref(x), ref(y), ref(currentRest)]])), target: { ...loopTarget }, initial: [ref(x), ref(y)] })
        for (const statement of /** @type {readonly Statement[]} */ ([
            ['define', local, transfer, 'required'],
            ['define', local, ['array', [transfer]], 'required'],
            ['define', local, ['if', ref(x), body(['yield', [transfer]]), body(['yield', [0]])], 'required'],
            ['define', local, capturedValue(transfer), 'required'],
            ['if', [], transfer, body(['yield', []]), body(['yield', []])],
            ['loop', inner],
        ])) { assertEq(invocationRootOf(restRoot(restLoopOf(body(['break', loopTarget, [7]], [statement])))), null) }
        assertEq(invocationRootOf(restRoot(restLoopOf(body(['break', loopTarget, [transfer]])))), null)
        const ownLoop = /** @type {Loop} */ ({ ...inner, body: body(['break', inner.target, [1]]) })
        const ordinary = restLoopOf(body(['break', loopTarget, [7]], [
            ['loop', ownLoop], ['define', local, capturedValue(ref(currentRest)), 'required'],
            ['define', id(100), ['block', body(['yield', [1]], [
                ['define', local, ref(currentRest), 'required'], ['block', [], body(['yield', []])],
                ['if', [], ref(x), body(['yield', []]), body(['yield', []])], ['loop', ownLoop],
            ])], 'required'],
        ]))
        assertEq(invocationRootOf(restRoot(ordinary)), ordinary)
    },
    transferPayloadReturn: () => {
        const loop = loopOf(body(['break', loopTarget, [['block', body(['return', target, 4])]]]))
        const fn = root(loop)
        const value = graph(fn)
        assert(value instanceof Array && value[0] === '=>')
        assertEq(value[1], 2)
        assertEq(assertOk(evaluate(fn, [1, 2])), 4)
    },
    layout: () => {
        const loop = loopOf(body(['break', loopTarget, [ref(x)]]))
        const fn = root(loop)
        assertEq(invocationRootOf(fn), loop)
        assertEq(invocationRootOf(fixedRoot(17)), null)
        const aliased = { ...loop, initial: [ref(alias), ref(b)] }
        assertEq(invocationRootOf({ ...fn, body: body(['return', target, ref(output)], [['define', alias, ref(a), 'lazy'], ['loop', aliased]]) }), aliased)
        const zero = { ...loop, parameters: [], initial: [] }
        assertEq(invocationRootOf({ ...root(zero), parameters: [] }), zero)
        assertEq(invocationRootOf({ ...fn, rest: alias }), null)
        assertEq(invocationRootOf({ ...fn, body: body(['yield', [ref(output)]], [['loop', loop]]) }), null)
        assertEq(invocationRootOf({ ...fn, body: body(['return', { ...target }, ref(output)], [['loop', loop]]) }), null)
        assertEq(invocationRootOf({ ...fn, body: body(['return', target, ref(output)]) }), null)
        assertEq(invocationRootOf({ ...fn, body: body(['return', target, ref(output)], [['define', output, 1, 'required']]) }), null)
        for (const changed of [
            { ...loop, parameters: [x] }, { ...loop, initial: [ref(a)] },
            { ...loop, results: [] }, { ...loop, results: [output, alias] },
            { ...loop, initial: [ref(b), ref(a)] }, { ...loop, initial: [ref({ ...a }), ref(b)] },
        ]) { assertEq(invocationRootOf(root(changed)), null) }
        for (const statement of /** @type {readonly Statement[]} */ ([
            ['block', [], body(['yield', []])], ['define', alias, ['array', []], 'required'], ['define', alias, ref(x), 'lazy'],
        ])) { assertEq(invocationRootOf({ ...fn, body: body(['return', target, ref(output)], [statement, ['loop', loop]]) }), null) }
        assertEq(invocationRootOf({ ...fn, body: body(['return', target, 3], [['loop', loop]]) }), null)
    },
    directTailAndOpaqueResult: () => {
        const loop = loopOf(body(['continue', loopTarget, [ref(x), ref(y)]], [
            ['if', [], ['<', ref(x), 3], body(['continue', loopTarget, [['+', ref(x), 1], ['-', ref(y), 1]]]), body(['break', loopTarget, [['array', [ref(x), ref(y)]]]])],
        ]))
        const fn = root(loop)
        const arg0 = /** @type {Exp} */ (['arg', 0]), arg1 = /** @type {Exp} */ (['arg', 1])
        const expected = /** @type {Exp} */ (['=>', 2, [], ['?:', ['<', arg0, 3], ['()', ['self'], [['+', arg0, 1], ['-', arg1, 1]]], ['[]', [arg0, arg1]]]])
        const initial = graph(fn)
        assertStructurallySame(assertOk(identityAnalysis(initial)), assertOk(identityAnalysis(expected)))
        const one = fromFast(assertOk(toFast(initial)))
        const two = fromFast(assertOk(toFast(one)))
        const three = fromFast(assertOk(toFast(two)))
        for (const value of [one, two, three]) { assertStructurallySame(assertOk(identityAnalysis(value)), assertOk(identityAnalysis(expected))) }
        assertStructurallySame(assertOk(evaluate(fn, [0, 10])), [3, 7])
        const retained = { ...fn, self }
        const normalized = directInvocationRoot(retained, loop)
        assertEq(normalized.self, self)
        assertEq(normalized.parameters, fn.parameters)
        assertEq(normalized.captures, fn.captures)
        assertStructurallySame(assertOk(identityAnalysis(graph(retained))), assertOk(identityAnalysis(expected)))
    },
    statementResultsAndRequiredValues: () => {
        const local = id(10), first = id(11), second = id(12), marker = id(13)
        const loop = loopOf(body(['break', loopTarget, [['array', [ref(first), ref(second), ref(local)]]]], [
            ['define', local, ['array', []], 'required'],
            ['block', [first, second], body(['yield', [ref(local), 8]])],
            ['if', [marker], ref(x), body(['yield', [1]]), body(['yield', [2]])],
        ]))
        const result = assertOk(evaluate(root(loop), [0, 0]))
        assert(result instanceof Array)
        assertEq(result[0], result[2])
        assertEq(result[1], 8)
        const unused = loopOf(body(['break', loopTarget, [7]], [['block', [first], body(['yield', [['.', null, 'x']]])]]))
        assertError(evaluate(root(unused), [0, 0]))
        const thrown = loopOf(body(['break', loopTarget, [0]], [['if', [], ref(x), body(['throw', 'error']), body(['return', target, 9])]]))
        assertEq(assertOk(evaluate(root(thrown), [false, 0])), 9)
        assertEq(assertError(evaluate(root(thrown), [true, 0])), 'error')
    },
    zeroAndSingleInput: () => {
        const zero = loopOf(body(['break', loopTarget, [['array', [1, 2]]]]), [])
        const fn = { ...root(zero), parameters: [] }
        assertStructurallySame(assertOk(evaluate(fn, [])), [1, 2])
        const single = { ...loopOf(body(['return', target, ['array', [ref(x)]]])), parameters: [x], initial: [ref(a)] }
        assertStructurallySame(assertOk(evaluate({ ...root(single), parameters: [a] }, [4])), [4])
        const repeat = { ...zero, body: body(['continue', loopTarget, []]) }
        assertStructurallySame(graph({ ...root(repeat), parameters: [] }), ['=>', 0, [], ['()', ['self'], []]])
    },
    aliasFrameAndWideInvocation: () => {
        const capture = id(40)
        const loop = loopOf(body(['break', loopTarget, [['array', [ref(capture), ref(capture), ['===', ref(self), ref(self)]]]]]))
        const fn = { ...root(loop), self, captures: [{ binding: capture, value: /** @type {Value} */ (['array', [11]]) }], body: body(['return', target, ref(output)], [['define', alias, ref(a), 'required'], ['loop', { ...loop, initial: [ref(alias), ref(b)] }]]) }
        const result = assertOk(evaluate(fn, [0, 0]))
        assert(result instanceof Array)
        assertEq(result[0], result[1])
        assertEq(result[2], true)
        const expected = /** @type {Exp} */ (['=>', 2, [['[]', [11]]], ['[]', [['frame', 0], ['frame', 0], ['===', ['self'], ['self']]]]])
        // One canonical node represents each frame/self read in the exact domain.
        const frame = /** @type {Exp} */ (['frame', 0]), selfRead = /** @type {Exp} */ (['self'])
        const canonical = /** @type {Exp} */ (['=>', 2, [['[]', [11]]], ['[]', [frame, frame, ['===', selfRead, selfRead]]]])
        assertStructurallySame(graph(fn), expected)
        assertStructurallySame(assertOk(identityAnalysis(graph(fn))), assertOk(identityAnalysis(canonical)))
        const parameters = Array.from({ length: 16 }, () => id(0))
        const states = Array.from({ length: 16 }, () => id(0))
        const wide = { ...loop, parameters: states, initial: parameters.map(ref), body: body(['break', loopTarget, [['array', states.map(ref)]]]) }
        const wideFn = { ...root(wide), parameters }
        assertEq(invocationRootOf(wideFn), wide)
        assertOk(checked(assertOk(identityAnalysis(graph(wideFn)))))
        assertStructurallySame(assertOk(evaluate(wideFn, Array.from({ length: 16 }, (_, i) => i))), Array.from({ length: 16 }, (_, i) => i))
    },
    establishedPrefixAliases: () => {
        // Debug indices deliberately collide; source identity and parameter
        // position alone determine which aliases can initialize loop inputs.
        const capture = id(0), captured = id(0), again = id(0), retainedSelf = id(0), second = id(0), hidden = id(0), external = id(0)
        const loop = loopOf(body(['break', loopTarget, [['array', [ref(captured), ref(again), ['===', ref(retainedSelf), ref(self)], ref(x), ref(y)]]]]))
        /** @type {readonly Statement[]} */
        const prefix = [
            ['define', alias, ref(a), 'lazy'], ['define', second, ref(b), 'required'],
            ['define', captured, ref(capture), 'lazy'], ['define', again, ref(captured), 'required'],
            ['define', retainedSelf, ref(self), 'lazy'],
        ]
        const entered = { ...loop, initial: [ref(alias), ref(second)] }
        /** @type {FastFunction} */
        const fn = { ...root(entered), self, captures: [{ binding: capture, value: ['array', [11]] }], body: body(['return', target, ref(output)], [...prefix, ['loop', entered]]) }
        assertEq(invocationRootOf(fn), entered)
        const result = assertOk(evaluate(fn, [2, 3]))
        assert(result instanceof Array)
        assertEq(result[0], result[1])
        assertStructurallySame(result, [[11], [11], true, 2, 3])
        const frame = /** @type {Exp} */ (['frame', 0])
        const selfRead = /** @type {Exp} */ (['self'])
        const expected = /** @type {Exp} */ (['=>', 2, [['[]', [11]]], ['[]', [frame, frame, ['===', selfRead, selfRead], ['arg', 0], ['arg', 1]]]])
        const first = graph(fn)
        const next = fromFast(assertOk(toFast(first)))
        const last = fromFast(assertOk(toFast(next)))
        for (const graph of [first, next, last]) { assertStructurallySame(assertOk(identityAnalysis(graph)), assertOk(identityAnalysis(expected))) }
        for (const initial of [[ref(captured), ref(second)], [ref(retainedSelf), ref(second)], [ref(second), ref(alias)], [ref(id(0)), ref(second)]]) {
            const changed = { ...entered, initial }
            assertEq(invocationRootOf({ ...fn, body: body(['return', target, ref(output)], [...prefix, ['loop', changed]]) }), null)
        }
        for (const value of /** @type {readonly Value[]} */ ([ref(external), ['array', []], ['+', ref(a), 1], ['.', ref(capture), 0]])) {
            assertEq(invocationRootOf({ ...fn, body: body(['return', target, ref(output)], [...prefix, ['define', hidden, value, 'lazy'], ['loop', entered]]) }), null)
        }
        const zero = { ...entered, parameters: [], initial: [], body: body(['break', loopTarget, [['array', [ref(captured), ref(again)]]]]) }
        const noArguments = { ...fn, parameters: [], body: body(['return', target, ref(output)], [...prefix.slice(2), ['loop', zero]]) }
        assertEq(invocationRootOf(noArguments), zero)
        assertStructurallySame(assertOk(evaluate(noArguments, [])), [[11], [11]])
    },
    retainedEntryParameters: () => {
        for (const [value, prefix] of /** @type {readonly (readonly [Value, readonly Statement[]])[]} */ ([[ref(a), []], [ref(again), entryAliases]])) {
            for (const use of /** @type {readonly Value[]} */ ([value, ['block', body(['yield', [value]])], ['if', ref(x), body(['yield', [value]]), body(['yield', [0]])], ['()', capturedValue(value), []]])) {
                assertEq(invocationRootOf(retainedEntryRoot(use, prefix)), null)
            }
        }
        const local = id(0)
        const withLocal = retainedEntryRoot(ref(local))
        const loop = /** @type {Extract<Statement, readonly ['loop', ...unknown[]]>} */ (withLocal.body.statements[0])[1]
        assertEq(invocationRootOf({ ...withLocal, body: body(['return', target, ref(output)], [['loop', { ...loop, body: { ...loop.body, statements: [['define', local, ref(a), 'lazy'], ...loop.body.statements] } }]]) }), null)
        const single = { ...loopOf(body(['break', loopTarget, [ref(a)]])), parameters: [x], initial: [ref(a)] }
        const singleFn = { ...root(single), parameters: [a] }
        assertEq(rootLoopOf(singleFn), null)
        assertEq(invocationRootOf(singleFn), null)
    },
    retainedEntryHelperFallback: () => {
        for (const fn of [
            retainedEntryRoot(ref(a)),
            retainedEntryRoot(ref(again), entryAliases),
            retainedEntryRoot(['block', body(['yield', [ref(a)]])]),
            retainedEntryRoot(['()', capturedValue(ref(again)), []], entryAliases),
        ]) {
            assertEq(assertOk(evaluate(fn, [0, 9])), 0)
            assertEq(assertOk(evaluate(fn, [1, 9])), 1)
        }
        const loop = /** @type {Loop} */ ({ ...loopOf(body(['break', loopTarget, [ref(a)]])), parameters: [x], initial: [ref(a)] })
        assertEq(assertOk(evaluate({ ...root(loop), parameters: [a] }, [7])), 7)
    },
    scalarRetainedEntryFallback: () => {
        for (const [value, prefix] of /** @type {readonly (readonly [Value, readonly Statement[]])[]} */ ([[ref(a), []], [ref(again), entryAliases]])) {
            const loop = { ...loopOf(body(['continue', loopTarget, [ref(x)]], [
                ['if', [], ['<', ref(x), 5], body(['continue', loopTarget, [['+', ['+', ref(x), value], 1]]]), body(['break', loopTarget, [ref(x)]])],
            ])), parameters: [x], initial: [ref(a)] }
            const fn = { ...root(loop), parameters: [a], body: body(['return', target, ref(output)], [...prefix, ['loop', loop]]) }
            assertEq(rootLoopOf(fn), null)
            assertEq(invocationRootOf(fn), null)
            assertEq(assertOk(evaluate(fn, [1])), 5)
            const condition = { ...loop, body: body(['continue', loopTarget, [ref(x)]], [
                ['if', [], ['if', ['<', ref(x), 3], body(['yield', [['===', value, 0]]]), body(['yield', [false]])], body(['continue', loopTarget, [['+', ref(x), 1]]]), body(['break', loopTarget, [ref(x)]])],
            ]) }
            const guarded = { ...fn, body: body(['return', target, ref(output)], [...prefix, ['loop', condition]]) }
            assertEq(rootLoopOf(guarded), null)
            assertEq(invocationRootOf(guarded), null)
            assertEq(assertOk(evaluate(guarded, [0])), 3)
        }
    },
    nestedIterationBindings: () => {
        const local = id(0), parameter = id(0), ownLocal = id(0)
        const nested = /** @type {const} */ ({ kind: 'function', index: 0 })
        const own = /** @type {Value} */ (['function', { target: nested, parameters: [parameter], rest: null, self: null, captures: [],
            body: body(['return', nested, ref(ownLocal)], [['define', ownLocal, ref(parameter), 'required']]) }])
        const loop = loopOf(body(['continue', loopTarget, [ref(x), ref(y)]], [
            ['define', local, ref(x), 'required'],
            ['if', [], ['<', ref(x), 2], body(['continue', loopTarget, [['+', ref(x), 1], capturedValue(ref(x))]]),
                body(['break', loopTarget, [['array', [ref(local), ['()', ref(y), []], ['()', own, [9]]]]]])],
        ]))
        assertEq(invocationRootOf(root(loop)), loop)
        assertStructurallySame(assertOk(evaluate(root(loop), [0, null])), [2, 1, 9])
    },
    nestedNormalLoops: () => {
        const state = id(0), result = id(0), selected = id(0)
        const innerTarget = /** @type {const} */ ({ kind: 'loop', index: loopTarget.index })
        const inner = /** @type {Loop} */ ({
            target: innerTarget, parameters: [state], initial: [ref(x)], results: [result],
            body: body(['break', innerTarget, [['+', ref(state), ref(y)]]]),
        })
        const statement = /** @type {Statement} */ (['loop', inner])
        const outer = loopOf(body(['break', loopTarget, [['array', [ref(result), ref(x), ref(y)]]]], [statement]))
        const fn = root(outer)
        assertEq(invocationRootOf(fn), outer)
        const normalized = directInvocationRoot(fn, outer)
        assertEq(normalized.body.statements[2], statement)
        assertStructurallySame(assertOk(evaluate(fn, [2, 3])), [5, 2, 3])
        const conditional = loopOf(body(['break', loopTarget, [ref(selected)]], [
            ['if', [selected], ref(x), body(['yield', [ref(result)]], [statement]), body(['yield', [9]])],
        ]))
        assertEq(assertOk(evaluate(root(conditional), [2, 3])), 5)
        assertEq(assertOk(evaluate(root(conditional), [0, 3])), 9)
    },
    partialAbruptRegions: () => {
        const value = id(30)
        const partial = body(['yield', [3]], [['if', [], ref(y), body(['return', target, 7]), body(['yield', []])]])
        const loop = loopOf(body(['break', loopTarget, [ref(value)]], [['if', [value], ref(x), partial, body(['yield', [4]])]]))
        assertEq(assertOk(evaluate(root(loop), [true, false])), 3)
        assertEq(assertOk(evaluate(root(loop), [true, true])), 7)
        assertEq(assertOk(evaluate(root(loop), [false, true])), 4)
    },
    unreachableRootExits: () => {
        const endings = /** @type {readonly Exit[]} */ ([
            ['yield', []],
            ['continue', { ...loopTarget }, []],
            ['break', loopTarget, []],
            ['return', { ...target }, 0],
        ])
        for (const exit of endings) {
            const loop = loopOf(body(exit, [
                ['block', [], body(['break', loopTarget, [6]])],
                ['block', [alias], body(['yield', []])],
            ]))
            const normalized = directInvocationRoot(root(loop), loop)
            assertEq(normalized.body.statements.length, 3)
            assertEq(normalized.body.exit, exit)
            assertEq(assertOk(evaluate(root(loop), [0, 0])), 6)
        }
    },
    throwOnlyRegions: () => {
        const direct = loopOf(body(['continue', loopTarget, [ref(x), ref(y)]], [
            ['block', [], body(['throw', 'block'])],
        ]))
        assertEq(assertError(evaluate(root(direct), [0, 0])), 'block')
        const selected = loopOf(body(['yield', []], [
            ['if', [], ref(x), body(['throw', 'then']), body(['throw', 'otherwise'])],
        ]))
        assertEq(assertError(evaluate(root(selected), [true, 0])), 'then')
        assertEq(assertError(evaluate(root(selected), [false, 0])), 'otherwise')
        const required = id(0)
        const prefix = loopOf(body(['break', loopTarget, [ref(required)]], [
            ['define', required, ['block', body(['throw', 'prefix'])], 'required'],
            ['block', [], body(['throw', 'block'])],
        ]))
        assertEq(assertError(evaluate(root(prefix), [0, 0])), 'prefix')
    },
    deepPrefixChain: () => {
        const bindings = Array.from({ length: 20_000 }, (_, index) => id(index + 100))
        const allocation = /** @type {Value} */ (['array', []])
        const definitions = bindings.map((binding, index) => /** @type {Statement} */ (['define', binding,
            index === 0 ? allocation : ref(bindings[index - 1]), index % 2 === 0 ? 'required' : 'lazy']))
        const value = /** @type {Value} */ (['array', [ref(bindings[0]), ref(bindings[bindings.length - 1])]])
        let nested = body(['break', loopTarget, [value]])
        for (let index = definitions.length - 1; index >= 0; index -= 1) {
            nested = body(['yield', []], [definitions[index], ['block', [], nested]])
        }
        const loop = loopOf(nested)
        // Isolate prefix construction from the separate free-binding inventory.
        const normalized = directInvocationRoot(root(loop), loop)
        const { statements } = normalized.body
        assertEq(statements.length, 4)
        assertStructurallySame(statements.slice(0, 2), [['define', x, ref(a), 'lazy'], ['define', y, ref(b), 'lazy']])
        /** @type {Block} */
        let region = { ...normalized.body, statements: statements.slice(2) }
        for (const definition of definitions) {
            assertEq(region.statements[0], definition)
            const statement = region.statements[1]
            assert(statement[0] === 'block')
            region = statement[2]
        }
        assertEq(region.statements.length, 0)
        const { exit } = region
        assert(exit[0] === 'return')
        assertEq(exit[1], target)
        assertEq(exit[2], value)
    },
    prefixRegions: () => {
        const first = id(40), second = id(41), allocation = id(42), alias = id(43)
        const inner = body(['break', loopTarget, [['array', [ref(second), ref(alias), ref(allocation)]]]], [['define', alias, ref(allocation), 'lazy']])
        const middle = body(['yield', []], [['define', second, ['*', ref(first), 2], 'lazy'], ['define', allocation, ['array', [ref(first)]], 'required'], ['block', [], inner]])
        const loop = loopOf(body(['continue', loopTarget, [ref(x), ref(y)]], [['define', first, ['+', ref(x), 1], 'required'], ['block', [], middle]]))
        const result = assertOk(evaluate(root(loop), [3, 0]))
        assert(result instanceof Array)
        assertEq(result[0], 8)
        assertEq(result[1], result[2])
        assertStructurallySame(result[1], [4])
        const fail = id(44), unused = id(45)
        const branches = loopOf(body(['continue', loopTarget, [ref(x), ref(y)]], [['if', [], ref(y),
            body(['throw', 'body'], [['define', fail, ['block', body(['throw', 'prefix'])], 'required']]),
            body(['break', loopTarget, [7]], [['define', unused, ['block', body(['throw', 'lazy'])], 'lazy']]),
        ]]))
        assertEq(assertOk(evaluate(root(branches), [0, false])), 7)
        assertEq(assertError(evaluate(root(branches), [0, true])), 'prefix')
    },
    normalStatementGrowthAndDeepControl: () => {
        /** @type {readonly Statement[]} */
        let statements = []
        let last = x
        for (let depth = 0; depth < 24; depth += 1) {
            const next = id(depth + 20)
            statements = [...statements, ['if', [next], ref(y), body(['yield', [['+', ref(last), 1]]]), body(['yield', [['-', ref(last), 1]]])]]
            last = next
        }
        const loop = loopOf(body(['break', loopTarget, [ref(last)]], statements))
        const analysis = assertOk(identityAnalysis(graph(root(loop))))
        assert(analysis.nodes.length < 100)
        assertEq(assertOk(evaluate(root(loop), [0, true])), 24)
        /** @type {Block} */
        let nested = body(['break', loopTarget, [ref(x)]])
        for (let depth = 0; depth < 20_000; depth += 1) { nested = body(['yield', []], [['block', [], nested]]) }
        const deep = loopOf(nested)
        assertStructurallySame(graph(root(deep)), ['=>', 2, [], ['arg', 0]])
        nested = body(['break', loopTarget, [ref(x)]])
        for (let depth = 0; depth < 20_000; depth += 1) {
            nested = body(['continue', loopTarget, [ref(x), ref(y)]], [['if', [], ref(y), nested, body(['break', loopTarget, [0]])]])
        }
        let conditional = graph(root(loopOf(nested)))
        assert(conditional instanceof Array && conditional[0] === '=>')
        conditional = conditional[3]
        for (let depth = 0; depth < 20_000; depth += 1) {
            assert(conditional instanceof Array && conditional[0] === '?:')
            assertEq(conditional[3], 0)
            conditional = conditional[2]
        }
        assertStructurallySame(conditional, ['arg', 0])
    },
    throw: {
        restTransitionRecipe: () => {
            const loop = restLoopOf(body(['continue', loopTarget, [ref(x), ref(y), ref(currentRest)]]))
            directInvocationRoot(restRoot(loop), loop)
        },
        fixedArityLimit: () => { graph(fixedRoot(17)) },
        loopBodyYieldZero: () => { const loop = { ...loopOf(body(['yield', []])), parameters: [], initial: [] }; graph({ ...root(loop), parameters: [] }) },
        loopBodyYieldOne: () => { const loop = { ...loopOf(body(['yield', [3]])), parameters: [], initial: [] }; graph({ ...root(loop), parameters: [] }) },
        loopBodyYieldAfterNormalRegion: () => {
            const loop = loopOf(body(['yield', []], [['block', [], body(['yield', []])]]))
            directInvocationRoot(root(loop), loop)
        },
        resultArity: () => { const loop = loopOf(body(['break', loopTarget, []])); directInvocationRoot(root(loop), loop) },
        transitionArity: () => { const loop = loopOf(body(['continue', loopTarget, [0]])); directInvocationRoot(root(loop), loop) },
        regionArity: () => { const loop = loopOf(body(['break', loopTarget, [0]], [['block', [alias], body(['yield', []], [['if', [], true, body(['return', target, 0]), body(['yield', []])]])]])); directInvocationRoot(root(loop), loop) },
        returnOwner: () => { const loop = loopOf(body(['return', { ...target }, 0])); directInvocationRoot(root(loop), loop) },
        loopOwner: () => { const loop = loopOf(body(['continue', { ...loopTarget }, [0, 0]])); directInvocationRoot(root(loop), loop) },
    },
}
