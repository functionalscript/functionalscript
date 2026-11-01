/**
 * Independent shared tail recipes cross all three JavaScript output boundaries.
 * Native execution establishes bounded stack use, argument snapshots and escaped
 * allocation identity; public FJS source retains its explicit admission limit.
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
import { tryFunctionText, tryStringify } from '../module.f.mjs'
import { stringify as valueStringify } from './module.f.mjs'

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
    assertError(tryStringify(graph))
    const table = assertOk(identityAnalysis(graph))
    const code = javascript(prepare(fromAnalysis(table)), 'module', true)
    const value = valueStringify(assertOk(memo(table)({ args: [] })))
    const fn = assertOk(tryFunctionText(graph))
    for (const text of [code, value, fn]) { hasWhile(text) }
    return [await load(code), await load(value), Function(`"use strict";return (${fn});`)()]
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
            assertEq(apply.length, 3)
            const first = apply(100_001, false, null)
            const second = apply(2, true, null)
            for (const result of [first, second]) {
                assertEq(result[0], result[1])
                assertEq(result[2].length, 0)
                assertEq(result[2](), result[0])
                assertStructurallySame(result[0], [0])
                assertStructurallySame(result[3], [1])
                assert(result[0] !== result[3])
            }
            assert(first[0] !== second[0])
            assert(first[3] !== second[3])
            assertEq(first[2](), first[0])
            const previous = /** @type {const} */ ([-1])
            const base = apply(0, false, () => previous)
            assertEq(base[3], previous)
            assertEq(base[0], base[1])
            assertEq(base[2](), base[0])
            assert(base[0] !== first[0])
        }
    },
})
