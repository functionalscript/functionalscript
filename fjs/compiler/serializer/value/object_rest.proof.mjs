/**
 * Object rest crosses both generated-JavaScript writers with native callers.
 * Host execution observes allocation identity, callback order and thrown work
 * that an interpreted value or a source-text assertion cannot establish.
 * @import { Exp } from '../../../edag/types.ts'
 */

import { Buffer } from 'node:buffer'
import { throws } from 'node:assert/strict'

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { identityAnalysis } from '../../../edag/analysis/module.f.mjs'
import { fromAnalysis } from '../../../edag/to_fast/module.f.mjs'
import { prepare } from '../../../js/ast/prepare/module.f.mjs'
import { stringify as javascript } from '../../../js/ast/serializer/module.f.mjs'
import { _defaultExport, unresolved } from '../../edag/module.f.mjs'
import { parse } from '../../source/module.f.mjs'
import { tryStringify } from '../module.f.mjs'

/** Both writers consume the source graph without interpreting its calls.
 * @type {(source: string) => readonly string[]}
 */
const outputs = source => {
    /** @type {Exp} */
    const graph = _defaultExport(unresolved(assertOk(parse('/object-rest.f.mjs')(source))).edag)
    const text = assertOk(tryStringify(graph))
    assertOk(parse('/emitted-object-rest.f.mjs')(text))
    return [javascript(prepare(fromAnalysis(assertOk(identityAnalysis(graph)))), 'module', true), text]
}

/** @type {(source: string) => Promise<any>} */
const load = async source => (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).default

export const proof = /** @type {const} */ ({
    aliasesExcludeSourceKeysAndKeepOrderedUndefinedEntriesAndSharing: async () => {
        const shared = /** @type {const} */ ({ value: 17 })
        const member = () => 23
        const input = /** @type {const} */ ({ '10': 10, '2': 2, 1: 1, drop: shared,
            alias: member, missing: undefined, ['__proto__']: shared })
        for (const text of outputs('export default source=>{const {drop:alias,1:first,drop:again,...rest}=source;return [alias,first,again,rest];};')) {
            const apply = await load(text)
            const first = apply(input)
            const second = apply(input)
            assertEq(first[0], shared)
            assertEq(first[1], 1)
            assertEq(first[2], shared)
            assert(first[3] !== input)
            assert(first[3] !== second[3])
            assertStructurallySame(Object.keys(first[3]), ['2', '10', 'alias', 'missing', '__proto__'])
            assertEq(first[3].alias, member)
            assertEq(first[3].missing, undefined)
            assertEq(first[3].__proto__, shared)
        }
    },
    parameterCapturesKeepOneCopyAndEachInvocationAllocatesEvenWhenEmpty: async () => {
        const shared = /** @type {const} */ ([7])
        const input = /** @type {const} */ ({ drop: 1, kept: shared })
        const empty = /** @type {const} */ ({ drop: 1 })
        for (const text of outputs('export default ({drop,...rest})=>()=>rest;')) {
            const capture = await load(text)
            assertEq(capture.length, 1)
            const first = capture(input)
            const second = capture(input)
            assertEq(first(), first())
            assert(first() !== second())
            assertEq(first().kept, shared)
            const firstEmpty = capture(empty)
            const secondEmpty = capture(empty)
            assertEq(firstEmpty(), firstEmpty())
            assert(firstEmpty() !== secondEmpty())
            assertStructurallySame(Object.entries(firstEmpty()), [])
        }
    },
    defaultsRunInOrderAndRestCopiesTheOriginalSingleSourceSnapshot: async () => {
        const shared = /** @type {const} */ ([3])
        const changed = /** @type {const} */ ([5])
        const original = /** @type {const} */ ({ a: undefined, b: undefined, kept: shared })
        const replacement = /** @type {const} */ ({ b: 44, kept: changed, added: 9 })
        for (const text of outputs('export default (get,replace,after)=>{let source=get();const {a=(()=>{source=replace();return source;})(),b=after(),...rest}=source;return [a,b,rest,source];};')) {
            const apply = await load(text)
            /** @type {string[]} */
            const calls = []
            const result = apply(
                () => { calls.push('get'); return original },
                () => { calls.push('replace'); return replacement },
                () => { calls.push('after'); return 13 },
            )
            assertStructurallySame(calls, ['get', 'replace', 'after'])
            assertEq(result[0], replacement)
            assertEq(result[1], 13)
            assertEq(result[3], replacement)
            assertEq(result[2].kept, shared)
            assertStructurallySame(Object.keys(result[2]), ['kept'])
        }
    },
    restOnlyUsesCodeUnitEntriesAndKeepsUnusedNullishAndDefaultFailures: async () => {
        for (const text of outputs('export default source=>{const {...rest}=source;return rest;};')) {
            const copy = await load(text)
            assertStructurallySame(Object.entries(copy('😀a')), [['0', '\ud83d'], ['1', '\ude00'], ['2', 'a']])
            assertStructurallySame(Object.entries(copy([undefined, 7])), [['0', undefined], ['1', 7]])
            for (const input of [3, false, 9n]) {
                assertStructurallySame(Object.entries(copy(input)), [])
                assert(copy(input) !== copy(input))
            }
        }
        for (const source of [
            'export default source=>{const {...unused}=source;return 7;};',
            'export default ({...unused})=>7;',
        ]) {
            for (const text of outputs(source)) {
                const ignore = await load(text)
                assertEq(ignore({}), 7)
                throws(() => ignore(null))
                throws(() => ignore(undefined))
            }
        }
        for (const text of outputs('export default (source,fail)=>{const {head=fail(),...unused}=source;return 7;};')) {
            const ignore = await load(text)
            const fail = () => { throw 'required object default' }
            assertEq(ignore({ head: null }, fail), 7)
            throws(() => ignore({ head: undefined }, fail))
        }
    },
})
