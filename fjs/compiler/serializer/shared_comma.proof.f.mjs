/**
 * Shared sequence operands use the common FAST placement before source output.
 * These graphs need one evaluated value, rather than a particular raw graph
 * shape after parsing. The public writer's text must remain FunctionalScript,
 * preserve successful allocation sharing and retain selected required work.
 *
 * @import { Exp } from '../../edag/types.ts'
 * @import { ValueResult } from '../../edag/value/control/types.ts'
 * @import { Values } from '../../edag/value/types.ts'
 */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { identityAnalysis } from '../../edag/analysis/module.f.mjs'
import { invoke, memo } from '../../edag/memo/module.f.mjs'
import { call } from '../../edag/value/call/module.f.mjs'
import { read } from '../../edag/value/property/module.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'
import { ok } from '../../types/result/module.f.js'
import { _defaultExport, unresolved } from '../edag/module.f.mjs'
import { parse } from '../source/module.f.mjs'
import { tryModuleStringify, tryStringify } from './module.f.mjs'

/** One public source spelling, read by the real front end. @type {(root: Exp) => Exp} */
const reread = root => {
    const text = assertOk(tryStringify(root))
    const module = unresolved(assertOk(parse('/shared-comma.f.mjs')(text)))
    assertEq(module.imports.length, 0)
    return _defaultExport(module.edag)
}

/** The input and its emitted source have the same semantic obligations. @type {(root: Exp) => readonly Exp[]} */
const versions = root => [root, reread(root)]

/** @type {(root: Exp) => ValueResult} */
const evaluate = root => memo(assertOk(identityAnalysis(root)))({ args: [] })

/** @type {(root: Exp, args: Values) => ValueResult} */
const invokeGraph = (root, args) => call(evaluate(root), args.map(value => () => ok(value)), invoke)

export const proof = /** @type {const} */ ({
    sharedLiteralPrefixesAreSourceValues: () => {
        const operand = /** @type {const} */ ([',', [1, 2]])
        for (const root of versions(['[]', [operand, operand]])) {
            assertStructurallySame(assertOk(toData(assertOk(evaluate(root)))), [2, 2])
        }
        for (const root of versions(['=>', 0, [], ['[]', [operand, operand]]])) {
            assertStructurallySame(assertOk(toData(assertOk(invokeGraph(root, [])))), [2, 2])
        }
    },
    sharedAndDistinctSequencesKeepTheirAllocationIdentity: () => {
        const shared = /** @type {const} */ ([',', [1, ['[]', []]]])
        const distinct = /** @type {const} */ ([',', [1, ['[]', []]]])
        for (const root of versions(['[]', [shared, shared, distinct]])) {
            const result = evaluate(root)
            const first = assertOk(read(result, '0'))
            assertEq(first, assertOk(read(result, '1')))
            assert(first !== assertOk(read(result, '2')))
            assertStructurallySame(assertOk(toData(assertOk(result))), [[], [], []])
        }
    },
    sharedSequenceClosuresKeepTheirEstablishedCapture: () => {
        const captured = /** @type {const} */ (['[]', []])
        const sequence = /** @type {const} */ ([',', [captured, ['=>', 0, [captured], ['frame', 0]]]])
        for (const root of versions(['[]', [sequence, sequence]])) {
            const result = evaluate(root)
            const first = read(result, '0')
            const second = read(result, '1')
            assertEq(assertOk(first), assertOk(second))
            const left = assertOk(call(first, [], invoke))
            const right = assertOk(call(second, [], invoke))
            assertEq(left, right)
            assertStructurallySame(assertOk(toData(left)), [])
        }
    },
    sequenceCapturesCanNormalizeToPrimitiveValues: () => {
        const sequence = /** @type {const} */ ([',', [['[]', []], ['undefined']]])
        for (const root of versions(['[]', [sequence, ['=>', 0, [sequence], ['frame', 0]]]])) {
            const result = evaluate(root)
            assertEq(assertOk(toData(assertOk(read(result, '0')))), undefined)
            const captured = call(read(result, '1'), [], invoke)
            assertEq(assertOk(toData(assertOk(captured))), undefined)
        }
    },
    selectedPrefixesRetainRequiredFailureAndSkipUnselectedWork: () => {
        const sequence = /** @type {const} */ ([',', [['+', ['arg', 1], 1], ['[]', []]]])
        /** @type {Exp} */
        const fn = ['=>', 2, [], ['?:', ['arg', 0], ['[]', [sequence, sequence]], 4]]
        for (const root of versions(fn)) {
            assertEq(assertOk(invokeGraph(root, [false, 1n])), 4)
            const selected = invokeGraph(root, [true, 2])
            assertEq(assertOk(read(selected, '0')), assertOk(read(selected, '1')))
            assertStructurallySame(assertOk(toData(assertOk(selected))), [[], []])
            assertError(invokeGraph(root, [true, 1n]))
        }
    },
    discardedSharedPrefixesStillRunRequiredWork: () => {
        const sequence = /** @type {const} */ ([',', [['+', ['arg', 0], 1], 0]])
        for (const root of versions(['=>', 1, [], ['[]', [sequence, sequence]]])) {
            assertStructurallySame(assertOk(toData(assertOk(invokeGraph(root, [2])))), [0, 0])
            assertError(invokeGraph(root, [1n]))
        }
    },
    crossLazySequenceSharingStillRequiresUnsupportedMemoStorage: () => {
        const sequence = /** @type {const} */ ([',', [['()', ['arg', 1], []], ['[]', []]]])
        /** @type {Exp} */
        const fn = ['=>', 2, [], ['[]', [['?:', ['arg', 0], sequence, 0], sequence]]]
        const refusal = /** @type {const} */ ('a shared node reached from outside the lazy operand that establishes it')
        assertEq(assertError(tryStringify(fn)), refusal)
        assertEq(assertError(tryModuleStringify(['{}', [[':', 'default', fn]]])), refusal)
    },
})
