/**
 * Shared continuations retain reached work, one selected result and source
 * loop execution without duplicating a graph node.
 *
 * @import { Exp } from '../../../types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../../asserts/module.f.js'
import { tryStringify } from '../../../../compiler/serializer/module.f.mjs'
import { identityAnalysis } from '../../../analysis/module.f.mjs'
import { evaluate } from '../../../from_fast/member_returns/proof.f.mjs'
import { _sourceGraph as graph } from './proof.f.mjs'

export const proof = /** @type {const} */ ({
    factoredInvocationProfilesKeepSelectedWorkAndSharedResults: () => {
        /** @type {Exp} */
        const call = ['()', ['self'], [['-', ['arg', 0], 1], ['+', ['arg', 1], 1]]]
        /** @type {Exp} */
        const prefix = [',', [['[]', [['arg', 0]]], call]]
        /** @type {Exp} */
        const array = ['[]', [1]]
        /** @type {Exp} */
        const restCall = ['()', ['self'], [['-', ['arg', 0], 1], 7]]
        /** @type {readonly { readonly value: Exp; readonly tail: boolean; readonly cases: readonly (readonly [readonly Exp[], unknown])[] }[]} */
        const profiles = [
            { value: ['=>', 2, [], ['?:', ['>', ['arg', 0], 0], ['?:', ['===', ['arg', 1], 0], call, call], ['arg', 1]]],
                tail: true, cases: [[[0, 10], 10], [[3, 10], 13]] },
            { value: ['=>', 2, [], ['?:', ['>', ['arg', 0], 0], ['?:', ['===', ['arg', 1], 0], prefix, prefix], ['arg', 1]]],
                tail: true, cases: [[[0, 10], 10], [[3, 10], 13]] },
            { value: ['=>', 0, [], ['?:', true, array, array]], tail: false, cases: [[[], [1]]] },
            { value: ['=>', 1, [], ['?:', ['>', ['arg', 0], 0], ['?:', ['===', ['%', ['arg', 0], 2], 0], restCall, restCall], ['rest']]],
                tail: true, cases: [[[0, 9, 10], [9, 10]], [[3, 9, 10], [7]]] },
        ]
        for (const { value, tail, cases } of profiles) {
            const output = assertOk(tryStringify(value))
            if (tail) { assert(output.includes('while('), output) }
            const restored = graph(output)
            for (const candidate of [value, restored]) {
                for (const [args, expected] of cases) {
                    /** @type {Exp} */
                    const invocation = ['()', candidate, args]
                    const result = evaluate(['[]', [invocation, invocation]])
                    assertStructurallySame(result, [expected, expected])
                    assert(result instanceof Array)
                    assertEq(result[0], result[1])
                }
            }
        }
    },
    sharedNormalRecipesKeepRequiredCallsAfterTheDecision: () => {
        const prefix = /** @type {const} */ ('const f=x=>{if(x[0]===3){throw 7;}return x[0];};let i=0;let sum=0;')
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['let i=0;let sum=0;while(i<10){i=i+1;if(i===1){sum=sum+10;}else if(i===3){return [i,sum];}else{sum=sum+i;}const result=[i,sum];return result;}return null;', [1, 10]],
            [`${prefix}while(i<10){i=i+1;if(i===1){sum=sum+10;}else if(i===3){return [i,sum];}else{sum=sum+i;}f([i,sum]);}return null;`, [3, 12]],
            [`${prefix}while(i<10){i=i+1;if(i===1){sum=sum+10;}else if(i===3){return [i,sum];}else{sum=sum+i;}f([i,sum]);if(i===2){sum=sum+20;}else if(i===4){return [i,sum];}else{sum=sum+i;}f([i,sum]);}return null;`, [3, 33]],
            [`${prefix}while(i<0){i=i+1;if(i===1){sum=sum+10;}else if(i===3){return [i,sum];}else{sum=sum+i;}f([i,sum]);}return null;`, null],
        ]
        for (const [body, expected] of cases) {
            const original = graph(`export default (()=>{${body}})();`)
            assertStructurallySame(evaluate(original), expected, body)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            const normalized = graph(first)
            const canonical = assertOk(tryStringify(normalized))
            const restored = graph(canonical)
            assertStructurallySame(evaluate(restored), expected, body)
            assertStructurallySame(assertOk(identityAnalysis(restored)), assertOk(identityAnalysis(normalized)), body)
            assertEq(assertOk(tryStringify(restored)), canonical, body)
        }
    },
})
