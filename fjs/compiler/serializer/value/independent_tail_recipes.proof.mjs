/**
 * Independent shared tail recipes cross all three JavaScript output boundaries.
 * Native execution establishes bounded stack use, argument snapshots and escaped
 * allocation identity. Public FJS selectors and immutable invocation snapshots
 * also cross source readback without requiring exact graph identity.
 * @import { Exp } from '../../../edag/types.ts'
 */

import { throws } from 'node:assert/strict'

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { identityAnalysis } from '../../../edag/analysis/module.f.mjs'
import { memo } from '../../../edag/memo/module.f.mjs'
import { fromAnalysis } from '../../../edag/to_fast/module.f.mjs'
import { _independentTailRecipes } from '../../../edag/to_fast/tail/fixtures.f.js'
import { prepare } from '../../../js/ast/prepare/module.f.mjs'
import { stringify as javascript } from '../../../js/ast/serializer/module.f.mjs'
import { tokenize } from '../../../js/tokenizer/module.f.mjs'
import { stringToCodePointList } from '../../../text/utf16/module.f.mjs'
import { toArray } from '../../../types/list/alt/module.f.js'
import { tryFunctionText, tryMarked, tryStringify } from '../module.f.mjs'
import { toText } from '../../../text/marked/module.f.mjs'
import { stringify as valueStringify } from './module.f.mjs'
import { _defaultExport, unresolved } from '../../edag/module.f.mjs'
import { parse } from '../../source/module.f.mjs'

/** @type {(source: string) => Promise<any>} */
const load = async source => (await import(`data:text/javascript,${encodeURIComponent(source)}`)).default

/** Every supported output must contain a real loop token.
 * @type {(source: string) => void}
 */
const hasWhile = source => {
    const tokens = toArray(tokenize(stringToCodePointList(source))(''))
    assert(tokens.every(({ token }) => token.kind !== 'error'), source)
    assert(tokens.some(({ token }) => token.kind === 'while'), source)
}

/** These closed functions need no supplied function-text capture slots.
 * @type {(graph: Exp) => Promise<readonly ((...args: readonly unknown[]) => any)[]>}
 */
const outputs = async graph => {
    const table = assertOk(identityAnalysis(graph))
    const code = javascript(prepare(fromAnalysis(table)), 'module', true)
    const value = valueStringify(assertOk(memo(table)({ args: [] })))
    const fn = assertOk(tryFunctionText(graph))
    for (const text of [code, value, fn]) { hasWhile(text) }
    return [await load(code), await load(value), Function(`"use strict";return (${fn});`)()]
}

/** @type {(source: string) => Exp} */
const sourceGraph = source => _defaultExport(unresolved(assertOk(parse('/independent-source-tail.f.mjs')(source))).edag)

/** Both source generations must parse under the unchanged FJS grammar.
 * @type {(graph: Exp) => readonly string[]}
 */
const sourceGenerations = graph => {
    const first = assertOk(tryStringify(graph))
    assertEq(toText(assertOk(tryMarked(graph))), first)
    const next = sourceGraph(first)
    const second = assertOk(tryStringify(next))
    assertEq(toText(assertOk(tryMarked(next))), second)
    sourceGraph(second)
    return [first, second]
}

/** Shared allocations and readers keep their creating invocation across calls.
 * @type {(apply: (...args: readonly unknown[]) => any) => void}
 */
const snapshotLifetimes = apply => {
    assertEq(apply.length, 3)
    const results = [false, true].flatMap(flag => [1, 2, 100_001].map(n => apply(n, flag, null)))
    for (const [index, result] of results.entries()) {
        assertEq(result[0], result[1])
        assertEq(result[2].length, 0)
        assertEq(result[2](), result[0])
        assertStructurallySame(result[0], [0])
        assertStructurallySame(result[3], [1])
        assert(result[0] !== result[3])
        for (const earlier of results.slice(0, index)) {
            assert(result !== earlier)
            assert(result[0] !== earlier[0])
            assert(result[2] !== earlier[2])
            assert(result[3] !== earlier[3])
        }
    }
    const previous = /** @type {const} */ ([-1])
    for (const flag of [false, true]) {
        let reads = 0
        const base = apply(0, flag, () => { reads += 1; return previous })
        assertEq(reads, 1)
        assertEq(base[3], previous)
        assertEq(base[0], base[1])
        assertEq(base[2](), base[0])
        for (const result of results) { assert(base[0] !== result[0]) }
    }
    for (const result of results) { assertEq(result[2](), result[0]) }
}

export const proof = /** @type {const} */ ({
    independentTerminalCallsUseDeepLoopsInEveryJavaScriptWriter: async () => {
        for (const apply of await outputs(_independentTailRecipes().scalar)) {
            assertEq(apply.length, 2)
            for (const flag of /** @type {const} */ ([false, true])) {
                assertEq(apply(0, flag), 0)
                assertEq(apply(2, flag), 0)
                assertEq(apply(100_001, flag), 0)
            }
        }
    },
    differentRecipesKeepTheirDistinctSimultaneousArgumentVectors: async () => {
        const left = /** @type {const} */ ([1])
        const right = /** @type {const} */ ([2])
        for (const apply of await outputs(_independentTailRecipes().vectors)) {
            assertEq(apply.length, 4)
            const unchanged = apply(2, false, left, right)
            assertEq(unchanged[0], left)
            assertEq(unchanged[1], right)
            const swapped = apply(2, true, left, right)
            assertEq(swapped[0], right)
            assertEq(swapped[1], left)
            const again = apply(2, false, left, right)
            assert(unchanged !== again)
            for (const flag of /** @type {const} */ ([false, true])) {
                const deep = apply(100_001, flag, left, right)
                assertEq(deep[0], right)
                assertEq(deep[1], left)
            }
        }
    },
    onlyTheSelectedRecipeEvaluatesItsRequiredExtraArgument: async () => {
        for (const apply of await outputs(_independentTailRecipes().selectedFailure)) {
            assertEq(apply.length, 3)
            assertEq(apply(0, false, true), 0)
            assertEq(apply(0, true, true), 0)
            assertEq(apply(1, false, true), 0)
            throws(() => apply(1, true, true))
            assertEq(apply(100_001, false, false), 0)
            assertEq(apply(100_001, true, false), 0)
        }
    },
    sharedAllocationsAndEscapedReadersKeepTheirCreatingInvocation: async () => {
        for (const apply of await outputs(_independentTailRecipes().snapshots)) {
            snapshotLifetimes(apply)
        }
    },
    independentSourceSelectorsKeepDeepLoopsAcrossReadback: async () => {
        for (const source of sourceGenerations(_independentTailRecipes().scalar)) {
            hasWhile(source)
            const apply = await load(source)
            assertEq(apply.length, 2)
            for (const flag of /** @type {const} */ ([false, true])) {
                assertEq(apply(0, flag), 0)
                assertEq(apply(2, flag), 0)
                assertEq(apply(100_001, flag), 0)
            }
        }
    },
    sourceRecipeVectorsKeepOpaqueInputsAndFreshResultsAcrossReadback: async () => {
        const left = /** @type {const} */ ([1])
        const right = /** @type {const} */ ([2])
        const readLeft = () => left
        const readRight = () => right
        for (const source of sourceGenerations(_independentTailRecipes().vectors)) {
            hasWhile(source)
            const apply = await load(source)
            assertEq(apply.length, 4)
            const unchanged = apply(2, false, left, right)
            const swapped = apply(2, true, left, right)
            assertEq(unchanged[0], left)
            assertEq(unchanged[1], right)
            assertEq(swapped[0], right)
            assertEq(swapped[1], left)
            assert(unchanged !== apply(2, false, left, right))
            for (const flag of /** @type {const} */ ([false, true])) {
                const deep = apply(100_001, flag, readLeft, readRight)
                assertEq(deep[0], readRight)
                assertEq(deep[1], readLeft)
                assertEq(deep[0](), right)
                assertEq(deep[1](), left)
            }
        }
    },
    sourceSelectorsKeepRequiredArgumentFailuresOnTheirChosenPath: async () => {
        for (const source of sourceGenerations(_independentTailRecipes().selectedFailure)) {
            hasWhile(source)
            const apply = await load(source)
            assertEq(apply.length, 3)
            assertEq(apply(0, false, true), 0)
            assertEq(apply(0, true, true), 0)
            assertEq(apply(1, false, true), 0)
            throws(() => apply(1, true, true))
            assertEq(apply(100_001, false, false), 0)
            assertEq(apply(100_001, true, false), 0)
        }
    },
    sourceSnapshotsKeepCreatingInvocationAcrossReadback: async () => {
        for (const source of sourceGenerations(_independentTailRecipes().snapshots)) {
            hasWhile(source)
            snapshotLifetimes(await load(source))
        }
    },
    skippedThrowingDependenciesStayLazyAcrossDeepTailInvocations: async () => {
        const bad = /** @type {const} */ (['()', ['=>', 0, [], ['throw', 7]], []])
        const box = /** @type {const} */ (['[]', [bad]])
        const inner = /** @type {const} */ (['?:', ['arg', 1], ['[]', [box, box]], ['?:', ['arg', 2], box, 0]])
        const n = /** @type {const} */ (['arg', 3])
        const graph = /** @type {const} */ (['=>', 4, [], ['?:', ['>', n, 0],
            ['()', ['self'], [['arg', 0], ['arg', 1], ['arg', 2], ['-', n, 1]]],
            ['?:', ['arg', 0], inner, bad],
        ]])
        assertError(tryStringify(graph))
        assertError(tryMarked(graph))
        for (const apply of await outputs(graph)) {
            assertEq(apply.length, 4)
            for (const count of [0, 1, 100_001]) {
                assertEq(apply(true, false, false, count), 0)
                throws(() => apply(false, false, false, count), value => value === 7)
                throws(() => apply(true, true, false, count), value => value === 7)
                throws(() => apply(true, false, true, count), value => value === 7)
            }
        }
    },
})
