/**
 * Direct FAST retains deferred owning returns absent from the current source
 * subset. These host proofs import both emitted JavaScript profiles and invoke
 * them deeply; pure represented evaluation cannot establish bounded native stack
 * use. Admitted public source output is reparsed before execution; dependent
 * recipes also cross a second source generation. The remaining wider memo
 * profile retains its current source admission limit.
 *
 * @import { BindingId, Block, Function as FastFunction, Value } from '../../../js/ast/types.ts'
 * @import { Exp } from '../../../edag/types.ts'
 */

import { Buffer } from 'node:buffer'
import { throws } from 'node:assert/strict'

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { identityAnalysis } from '../../../edag/analysis/module.f.mjs'
import { fromFast } from '../../../edag/from_fast/module.f.mjs'
import { _fixtures } from '../../../edag/from_fast/deferred_tail_calls/fixtures.f.mjs'
import { fromAnalysis } from '../../../edag/to_fast/module.f.mjs'
import { prepare } from '../../../js/ast/prepare/module.f.mjs'
import { stringify as javascript } from '../../../js/ast/serializer/module.f.mjs'
import { tokenize } from '../../../js/tokenizer/module.f.mjs'
import { stringToCodePointList } from '../../../text/utf16/module.f.mjs'
import { toArray } from '../../../types/list/alt/module.f.js'
import { toText } from '../../../text/marked/module.f.mjs'
import { _defaultExport, unresolved } from '../../edag/module.f.mjs'
import { parse } from '../../source/module.f.mjs'
import { tryMarked, tryStringify } from '../module.f.mjs'

/** @type {(fn: FastFunction) => Exp} */
const graphOf = fn => fromFast({ statements: [], exit: ['yield', [['function', fn]]] })

/** @type {(graph: Exp) => string} */
const codeOnly = graph => javascript(prepare(fromAnalysis(assertOk(identityAnalysis(graph)))), 'module', true)

/** Neither conversion evaluates the callable's deferred body. @type {(fn: FastFunction) => readonly string[]} */
const outputs = fn => {
    const graph = graphOf(fn)
    const text = assertOk(tryStringify(graph))
    assertOk(parse('/emitted-deferred-tail.f.mjs')(text))
    return [codeOnly(graph), text]
}

/** This wider memo profile exceeds current public source admission.
 * @type {(fn: FastFunction) => string}
 */
const codeOnlyWithSourceRefusal = fn => {
    const graph = graphOf(fn)
    assertError(tryStringify(graph))
    return codeOnly(graph)
}

/** @type {(source: string) => Exp} */
const sourceGraph = source => _defaultExport(unresolved(assertOk(parse('/emitted-dependent-tail.f.mjs')(source))).edag)

/** Each generation parses under the unchanged grammar and shares marked text.
 * @type {(fn: FastFunction) => readonly string[]}
 */
const sourceGenerations = fn => {
    const graph = graphOf(fn)
    const first = assertOk(tryStringify(graph))
    assertEq(toText(assertOk(tryMarked(graph))), first)
    const next = sourceGraph(first)
    const second = assertOk(tryStringify(next))
    assertEq(toText(assertOk(tryMarked(next))), second)
    sourceGraph(second)
    return [first, second]
}

/** @type {(source: string) => void} */
const hasWhile = source => {
    const tokens = toArray(tokenize(stringToCodePointList(source))(''))
    assert(tokens.every(({ token }) => token.kind !== 'error'), source)
    assert(tokens.some(({ token }) => token.kind === 'while'), source)
}

/** @type {(source: string) => Promise<any>} */
const load = async source => (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).default

export const proof = /** @type {const} */ ({
    owningTailsSurviveDirectNestedAndAliasedDeferredRecipes: async () => {
        const fixtures = _fixtures()
        const names = /** @type {const} */ (['terminal', 'ordinary', 'insideAlias', 'outsideAlias'])
        for (const name of names) {
            for (const text of outputs(fixtures[name])) {
                const apply = await load(text)
                assertEq(apply.length, 1)
                assertEq(apply(0), 7)
                assertEq(apply(100_001), 7)
            }
        }
        const nested = await load(codeOnly(graphOf(fixtures.nestedRecipe)))
        assertEq(nested(0), 7)
        assertEq(nested(100_001), 7)
    },
    dependentRecipesKeepOwningReturnsAcrossSourceGenerations: async () => {
        for (const source of sourceGenerations(_fixtures().nestedRecipe)) {
            hasWhile(source)
            const apply = await load(source)
            assertEq(apply.length, 1)
            for (const count of [0, 1, 3, 100_001]) { assertEq(apply(count), 7) }
        }
    },
    conditionalFirstDemandsKeepSkippedCallsSharedValuesAndOwningReturns: async () => {
        const target = /** @type {const} */ ({ kind: 'function', index: 0 })
        const ready = { index: 0 }, callback = { index: 0 }, previous = { index: 0 }
        const shared = { index: 0 }, chosen = { index: 0 }
        /** @type {(binding: BindingId) => Value} */
        const ref = binding => ['ref', binding]
        /** @type {(value: Value) => Block} */
        const yielded = value => ({ statements: [], exit: ['yield', [value]] })
        const empty = /** @type {const} */ ({ statements: [], exit: ['yield', []] })
        /** @type {FastFunction} */
        const fn = { target, parameters: [ready, callback, previous], self: null, rest: null, captures: [], body: {
            statements: [
                ['define', shared, ['()', ref(callback), []], 'lazy'],
                ['if', [], ref(ready), empty, { statements: [
                    ['if', [], ['.', ref(shared), 0], { statements: [], exit: ['return', target, 'early'] }, empty],
                ], exit: ['yield', []] }],
                ['define', chosen, ['if', ref(ready), yielded(ref(previous)), yielded(ref(shared))], 'required'],
            ], exit: ['return', target, ['array', [ref(chosen), ref(chosen)]]],
        } }
        for (const text of [codeOnly(graphOf(fn)), ...sourceGenerations(fn)]) {
            const apply = await load(text)
            assertEq(apply.length, 3)
            const old = /** @type {const} */ (['old'])
            const skipped = apply(true, () => { throw 7 }, old)
            assertEq(skipped[0], old)
            assertEq(skipped[0], skipped[1])
            let calls = 0
            const fresh = () => { calls += 1; return [false, {}] }
            const first = apply(false, fresh, old)
            assertEq(calls, 1)
            assertEq(first[0], first[1])
            const second = apply(false, fresh, old)
            assertEq(calls, 2)
            assertEq(second[0], second[1])
            assert(first !== second)
            assert(first[0] !== second[0])
            assertEq(apply(false, () => [true], old), 'early')
            throws(() => apply(false, () => { throw 7 }, old), value => value === 7)
        }
    },
    selectedTailValuesKeepBlocksCommasSpreadsAndArgumentSnapshots: async () => {
        for (const text of outputs(_fixtures().tailValues)) {
            const apply = await load(text)
            assertEq(apply.length, 3)
            assertStructurallySame(apply(0, 1, 2), [1, 2])
            assertStructurallySame(apply(100_001, 1, 2), [2, 1])
        }
    },
    loopLocalCellsAndStateRestartForEachOwningInvocation: async () => {
        for (const text of outputs(_fixtures().localReset)) {
            const apply = await load(text)
            assertEq(apply.length, 2)
            assertEq(apply(0, 0), 2)
            assertEq(apply(100_001, 0), 200_004)
        }
    },
    recipeLocalCapturesRetainTheirCreatingInvocation: async () => {
        for (const text of outputs(_fixtures().captures)) {
            const apply = await load(text)
            const first = apply(100_001, null)
            const second = apply(2, null)
            assertStructurallySame(first, [[0], [1]])
            assertStructurallySame(second, [[0], [1]])
            assert(first[0] !== first[1])
            assert(first[0] !== second[0])
            assert(first[1] !== second[1])
        }
    },
    skippedDemandsAndReachedArgumentFailuresKeepTheirRegions: async () => {
        for (const text of outputs(_fixtures().extraArguments)) {
            const apply = await load(text)
            assertEq(apply(-1, true), 9)
            assertEq(apply(0, true), 7)
            throws(() => apply(1, true))
            assertEq(apply(100_001, false), 7)
        }
        for (const text of outputs(_fixtures().failedSpread)) {
            const apply = await load(text)
            assertEq(apply(0), 7)
            throws(() => apply(1))
        }
    },
    restArgumentsStayFreshSharedAndCapturedAcrossDeferredTails: async () => {
        const element = /** @type {const} */ ([9])
        for (const text of outputs(_fixtures().rest)) {
            const apply = await load(text)
            assertEq(apply.length, 2)
            const first = apply(100_001, null, element)
            const second = apply(2, null, element)
            assert(first[0] !== first[1])
            assertEq(first[1], first[2])
            assertEq(first[3](), first[1])
            assertEq(first[0][0], element)
            assertEq(first[1][0], element)
            assert(first[1] !== second[1])
            const empty = apply(2, null)
            assertStructurallySame(empty.slice(0, 3), [[], [], []])
            assert(empty[0] !== empty[1])
            assertEq(empty[1], empty[2])
            assertEq(empty[3](), empty[1])
        }
        for (const text of outputs(_fixtures().restOnly)) {
            const apply = await load(text)
            assertEq(apply.length, 0)
            assertEq(apply(100_001, 0), 100_001)
        }
    },
    normalMemoValuesResemblingPacketsRemainSharedOpaqueData: async () => {
        const apply = await load(codeOnlyWithSourceRefusal(_fixtures().normalPayload))
        for (const tag of ['tail', 'return', 'normal']) {
            const reached = apply(3, true, tag)
            const normal = apply(3, false, tag)
            assertStructurallySame(reached, [[tag, [0]], [tag, [0]]])
            assertStructurallySame(normal, [[tag, [3]], [tag, [3]]])
            assertEq(reached[0], reached[1])
            assertEq(normal[0], normal[1])
            assert(reached[0] !== normal[0])
        }
        const deep = apply(100_001, true, 'tail')
        assertStructurallySame(deep, [['tail', [0]], ['tail', [0]]])
        assertEq(deep[0], deep[1])
    },
    nonTailSelfCallsRetainTheirFollowingComputation: async () => {
        for (const text of outputs(_fixtures().nonTail)) {
            const apply = await load(text)
            assertEq(apply(0), 0)
            assertEq(apply(3), 3)
        }
    },
})
