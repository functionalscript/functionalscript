/**
 * Owning self-tail returns inside loops cross the generated-JavaScript execution
 * boundary. Pure FAST proofs cannot import the emitted modules or establish
 * that the native JavaScript stack stays bounded through generated helpers.
 * Both writers execute the admitted source, and public FJS output is reparsed.
 *
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

/** @type {(source: string) => Exp} */
const sourceGraph = source => _defaultExport(unresolved(assertOk(parse('/owning-tail.f.mjs')(source))).edag)

/** Both outputs consume the same source graph, without evaluating it first.
 * @type {(source: string) => readonly string[]}
 */
const outputs = source => {
    const graph = sourceGraph(source)
    const text = assertOk(tryStringify(graph))
    assertOk(parse('/emitted-owning-tail.f.mjs')(text))
    return [javascript(prepare(fromAnalysis(assertOk(identityAnalysis(graph)))), 'module', true), text]
}

/** @type {(source: string) => Promise<any>} */
const load = async source => (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).default

/** A required callback that must stay skipped on the base path. @type {() => never} */
const unselected = () => { throw 'unselected argument' }

/** An ignored extra argument still has a completed evaluation. @type {() => undefined} */
const complete = () => undefined

export const proof = /** @type {const} */ ({
    terminalLoopTailReturnsSwapOneInvocationSnapshot: async () => {
        const source = /** @type {const} */ ('const f=(n,a,b)=>{while(true){if(n===0){return [a,b];}return f(n-1,b,a);}};export default f;')
        for (const text of outputs(source)) {
            assert(text.includes('while('), text)
            const apply = await load(text)
            assertEq(apply.length, 3)
            assertStructurallySame(apply(0, 1, 2), [1, 2])
            assertStructurallySame(apply(100_001, 1, 2), [2, 1])
        }
    },
    ordinaryLoopTailReturnsRestartLocalsAndRetainEscapedSnapshots: async () => {
        const source = /** @type {const} */ ('const f=(n,saved)=>{let i=0;while(i<1){i+=1;const snapshot=[n,i];if(n===0){return [snapshot,saved()];}return f(n-1,()=>snapshot);}return null;};export default f;')
        for (const text of outputs(source)) {
            const apply = await load(text)
            const first = apply(100_001, null)
            const second = apply(2, null)
            assertStructurallySame(first, [[0, 1], [1, 1]])
            assertStructurallySame(second, [[0, 1], [1, 1]])
            assert(first[0] !== first[1])
            assert(first[0] !== second[0])
            assert(first[1] !== second[1])
        }
    },
    nestedLoopsKeepInnerBreakAndContinueTargets: async () => {
        const source = /** @type {const} */ ('const f=n=>{let i=0;while(i<2){i+=1;if(i===1){continue;}if(n===0){break;}while(true){return f(n-1);}}return [n,i];};export default f;')
        for (const text of outputs(source)) {
            const apply = await load(text)
            assertStructurallySame(apply(0), [0, 2])
            assertStructurallySame(apply(100_001), [0, 2])
        }
    },
    immutableSelfAliasesRetainTailOwnershipAcrossLoopHelpers: async () => {
        const sources = /** @type {const} */ ([
            'const f=n=>{while(true){const alias=f;if(n===0){return 7;}return alias(n-1);}};export default f;',
            'const f=n=>{const alias=f;while(n>0){return alias(n-1);}return 7;};export default f;',
        ])
        for (const source of sources) {
            for (const text of outputs(source)) {
                const apply = await load(text)
                assertEq(apply(100_001), 7)
            }
        }
    },
    defaultSetupRunsInsideEachRestartedInvocation: async () => {
        const source = /** @type {const} */ ('const f=(n,saved,x=[n])=>{while(true){if(n===0){return [saved(),x];}return f(n-1,()=>x);}};export default f;')
        const supplied = /** @type {const} */ ([9])
        for (const text of outputs(source)) {
            const apply = await load(text)
            assertEq(apply.length, 2)
            const first = apply(100_001, null)
            assertStructurallySame(first, [[1], [0]])
            assert(first[0] !== first[1])
            const direct = apply(0, complete, supplied)
            assertEq(direct[0], undefined)
            assertEq(direct[1], supplied)
        }
    },
    restTransitionsKeepFreshArraysAndCreatingInvocationCaptures: async () => {
        const source = /** @type {const} */ ('const f=(n,saved,...xs)=>{while(true){if(n===0){return [saved(),xs,xs,()=>xs];}return f(n-1,()=>xs,...xs);}};export default f;')
        const element = /** @type {const} */ ([9])
        for (const text of outputs(source)) {
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
        }
    },
    restOnlyTailReturnsHaveNoFixedInputDependency: async () => {
        const source = /** @type {const} */ ('const f=(...xs)=>{while(true){if(xs[0]===0){return xs[1];}return f(xs[0]-1,xs[1]+1);}};export default f;')
        for (const text of outputs(source)) {
            const apply = await load(text)
            assertEq(apply.length, 0)
            assertEq(apply(100_001, 0), 100_001)
        }
    },
    extraAndSpreadArgumentsFinishBeforeTailTransfer: async () => {
        const extra = /** @type {const} */ ('const f=(n,fail)=>{while(true){if(n===0){return 7;}return f(n-1,fail,fail());}};export default f;')
        for (const text of outputs(extra)) {
            const apply = await load(text)
            assertEq(apply(0, unselected), 7)
            throws(() => apply(1, unselected))
            assertEq(apply(100_001, complete), 7)
        }
        const spread = /** @type {const} */ ('const f=(n,a,b)=>{while(true){if(n===0){return [a,b];}return f(...[n-1,b,a],5);}};export default f;')
        for (const text of outputs(spread)) {
            const apply = await load(text)
            assertStructurallySame(apply(100_001, 1, 2), [2, 1])
        }
        const failedSpread = /** @type {const} */ ('const f=n=>{while(true){if(n===0){return 7;}return f(n-1,...undefined);}};export default f;')
        for (const text of outputs(failedSpread)) {
            const apply = await load(text)
            assertEq(apply(0), 7)
            throws(() => apply(1))
        }
    },
    returnedConditionalIifeAndCommaRegionsRetainTailEvaluation: async () => {
        const iife = /** @type {const} */ ('const f=(n,a,b)=>{while(true){return n===0?[a,b]:(()=>{const pair=[a,b];return f(n-1,pair[1],pair[0]);})();}};export default f;')
        for (const text of outputs(iife)) {
            const apply = await load(text)
            assertStructurallySame(apply(100_001, 1, 2), [2, 1])
        }
        const comma = /** @type {const} */ ('const f=(n,fail)=>{while(true){return n===0?7:(fail(),f(n-1,fail));}};export default f;')
        for (const text of outputs(comma)) {
            const apply = await load(text)
            assertEq(apply(0, unselected), 7)
            throws(() => apply(1, unselected))
            assertEq(apply(100_001, complete), 7)
        }
    },
    nestedFunctionsKeepTheirOwnReturnAndNonTailCallOwners: async () => {
        const sources = /** @type {const} */ ([
            'const f=n=>{while(true){const nested=x=>f(x);if(n===0){return 0;}if(n===1){return nested(0)+1;}return f(n-1);}};export default f;',
            'const f=n=>{while(true){const alias=f;const nested=x=>alias(x);if(n===0){return 0;}if(n===1){return nested(0)+1;}return alias(n-1);}};export default f;',
            'const f=n=>{while(true){if(n===0){return 0;}if(n===1){return f(0)+1;}return f(n-1);}};export default f;',
        ])
        for (const source of sources) {
            for (const text of outputs(source)) {
                const apply = await load(text)
                assertEq(apply(0), 0)
                assertEq(apply(100_001), 1)
            }
        }
        const identity = /** @type {const} */ ('const f=n=>{while(true){if(n===0){return f;}return f(n-1);}};export default f;')
        for (const text of outputs(identity)) {
            const apply = await load(text)
            assertEq(apply(100_001), apply)
        }
    },
})
