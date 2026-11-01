/**
 * Public immutable-join output is parsed as FJS before native module execution.
 * Host callbacks expose reached work and allocation identity across invocations.
 * A second serialization checks source-readback semantics, without requiring
 * graph identity or identical generated text.
 *
 * @import { Function as FastFunction } from '../../../js/ast/types.ts'
 * @import { Exp } from '../../../edag/types.ts'
 * @import { JsToken } from '../../../ebnf/lib/js/types.ts'
 */

import { throws } from 'node:assert/strict'

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { _controlFlowFunctions } from '../../../edag/from_fast/control_flow.proof.f.mjs'
import { fromFast } from '../../../edag/from_fast/module.f.mjs'
import { _defaultExport, unresolved } from '../../edag/module.f.mjs'
import { parse } from '../../source/module.f.mjs'
import { tryStringify } from '../module.f.mjs'
import { tokenize } from '../../../js/tokenizer/module.f.mjs'
import { stringToCodePointList } from '../../../text/utf16/module.f.mjs'
import { toArray } from '../../../types/list/alt/module.f.js'

/** @type {(source: string) => Exp} */
const sourceGraph = source => _defaultExport(unresolved(assertOk(parse('/immutable-source-join.f.mjs')(source))).edag)
/** @type {(fn: FastFunction) => Exp} */
const graphOf = fn => fromFast({ statements: [], exit: ['yield', [['function', fn]]] })

/** Both generations must cross the current FJS source parser.
 * @type {(graph: Exp) => readonly string[]}
 */
const generations = graph => {
    const first = assertOk(tryStringify(graph))
    const second = assertOk(tryStringify(sourceGraph(first)))
    sourceGraph(second)
    return [first, second]
}

/** @type {(source: string) => Promise<any>} */
const load = async source => (await import(`data:text/javascript,${encodeURIComponent(source)}`)).default

/** @type {(source: string) => readonly JsToken['kind'][]} */
const tokenKinds = source => {
    const tokens = toArray(tokenize(stringToCodePointList(source))(''))
    assert(tokens.every(({ token }) => token.kind !== 'error'), source)
    return tokens.map(({ token }) => token.kind)
}

/** Only the recovered non-loop joins require immutable source output.
 * @type {(source: string) => void}
 */
const immutable = source => {
    const kinds = tokenKinds(source)
    assert(!kinds.includes('let'), source)
    assert(!kinds.includes('while'), source)
}

/** @type {(value: unknown) => unknown} */
const identity = value => value
/** @type {() => never} */
const failed = () => { throw 'selected required work' }

const paths = /** @type {const} */ ([[false, false], [false, true], [true, false], [true, true]])

export const proof = /** @type {const} */ ({
    parameterizedSourceJoinsKeepOwningReturnsAndSharedFreshValues: async () => {
        for (const source of generations(graphOf(_controlFlowFunctions.parameterizedJoin))) {
            immutable(source)
            const apply = await load(source)
            assertEq(apply.length, 3)
            for (const [selected, stop] of paths) {
                let calls = 0
                const actual = apply(selected, stop, /** @param {number} value */ value => { calls += 1; return value })
                assertEq(actual, selected && stop ? 42 : selected ? 8 : 5)
                assertEq(calls, selected && stop ? 0 : 1)
            }
            assertEq(apply(true, true, failed), 42)
            throws(() => apply(false, false, failed))
            throws(() => apply(true, false, failed))

            let calls = 0
            /** @param {number} value */
            const allocate = value => {
                calls += 1
                const item = /** @type {const} */ ([value])
                return /** @type {const} */ ([item, item, () => item])
            }
            const first = apply(false, false, allocate)
            const second = apply(true, false, allocate)
            assertEq(first[0], first[1])
            assertEq(second[0], second[1])
            assertEq(first[2](), first[0])
            assertEq(second[2](), second[0])
            assert(first[0] !== second[0])
            assertStructurallySame(first.slice(0, 2), [[5], [5]])
            assertStructurallySame(second.slice(0, 2), [[8], [8]])
            assertEq(calls, 2)
        }
    },
    nestedSourceJoinsKeepRequiredFactoriesAndTheirReturnOwner: async () => {
        for (const source of generations(graphOf(_controlFlowFunctions.nested))) {
            immutable(source)
            const apply = await load(source)
            assertEq(apply.length, 4)
            for (const [selected, stop] of paths) {
                const incoming = /** @type {const} */ ([4])
                /** @type {unknown} */
                let produced = undefined
                /** @type {unknown} */
                let early = undefined
                let factories = 0
                let continuations = 0
                const actual = apply(selected, incoming, () => {
                    factories += 1
                    const allocation = /** @type {const} */ ([8])
                    const stopped = /** @type {const} */ ([42])
                    produced = allocation
                    early = stopped
                    return { a: allocation, b: stop, c: stopped }
                }, /** @param {unknown} value */ value => {
                    continuations += 1
                    return /** @type {const} */ ([value, value])
                })
                if (selected && stop) { assertEq(actual, early) }
                else {
                    assertEq(actual[0], actual[1])
                    assertEq(actual[0], selected ? produced : incoming)
                }
                assertEq(factories, selected ? 1 : 0)
                assertEq(continuations, selected && stop ? 0 : 1)
            }
            assertEq(apply(false, 9, failed, identity), 9)
            assertEq(apply(true, 9, () => ({ a: 3, b: true, c: 7 }), failed), 7)
            throws(() => apply(true, 9, failed, identity))
            throws(() => apply(true, 9, () => ({ a: 3, b: false, c: 7 }), failed))
        }
    },
    genuineSourceLoopsAndSelfTailCallsKeepTheirWhileLowering: async () => {
        /** @type {Exp} */
        const countdown = ['=>', 1, [], ['?:', ['>', ['arg', 0], 0],
            ['()', ['self'], [['-', ['arg', 0], 1]]], 0,
        ]]
        for (const source of generations(countdown)) {
            assert(tokenKinds(source).includes('while'), source)
            const apply = await load(source)
            assertEq(apply.length, 1)
            assertEq(apply(0), 0)
            assertEq(apply(100_001), 0)
        }
        const graph = sourceGraph('export default c=>{let a=0;while(c(a)){a+=1;}return a;};')
        for (const source of generations(graph)) {
            assert(tokenKinds(source).includes('while'), source)
            const apply = await load(source)
            assertEq(apply.length, 1)
            assertEq(apply(/** @param {number} value */ value => value < 100_001), 100_001)
        }
    },
})
