/** Nested loops preserve lexical state, normal continuation and source facts. */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { analysis } from '../../edag/analysis/module.f.mjs'
import { memo } from '../../edag/memo/module.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'
import { unresolved } from '../edag/module.f.mjs'
import { parseFromTokens } from './module.f.mjs'
import { _evaluate, tokenizeString } from './proof.f.mjs'

export const proof = /** @type {const} */ ({
    nestedRegionsAndContinuations: () => {
        const module = assertOk(parseFromTokens(tokenizeString('let i=0;let sum=0;while(i<2){let j=0;while(j<2){sum=sum+j;j=j+1;}sum=sum+10;i=i+1;}export default [i,sum];')))
        const outer = module.body.statements[2]
        assert(outer[0] === 'while')
        assertStructurallySame(outer[1].body.statements.map(statement => statement[0]), ['initialize', 'while', 'write', 'write'])
        const inner = outer[1].body.statements[1]
        assert(inner[0] === 'while')
        assert(outer[1].target !== inner[1].target)
        assertStructurallySame(inner[1].body.exit, ['yield', undefined])
        assert(inner[1].events.some(event => event[0] === 'region'))
        assert(outer[1].events.some(event => event[0] === 'region'))
        assertEq(module.bindings.filter(binding => binding.isMutable).length, 3)
        assertStructurallySame(assertOk(toData(_evaluate(module))), { default: [2, 22] })
    },
    normalCompletionUpdatesEnclosingState: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['let i=0;let sum=0;while(i<3){let j=0;while(j<2){sum=sum+i+j;j=j+1;}sum=sum+10;i=i+1;}export default [i,sum];', { default: [3, 39] }],
            ['let i=0;let sum=0;while(i<4){let j=0;while(j<i){sum=sum+j;j=j+1;}i=i+1;}export default [i,sum];', { default: [4, 4] }],
            ['let i=0;let sum=0;while(i<3){if(i<2){let j=0;while(j<2){sum=sum+1;j=j+1;}}else{let j=0;while(j<3){sum=sum+2;j=j+1;}}i=i+1;}export default [i,sum];', { default: [3, 10] }],
            ['let i=0;let sum=0;while(i<2){let j=0;while(j<2){sum=sum+1;j=j+1;}while(j>0){sum=sum+j;j=j-1;}i=i+1;}export default [i,sum];', { default: [2, 10] }],
            ['let i=0;let sum=0;while(i<2){let j=0;while(j<2){let k=0;while(k<2){sum=sum+1;k=k+1;}j=j+1;}i=i+1;}export default [i,sum];', { default: [2, 8] }],
            ['let i=0;let sum=0;while(i<4){let j=0;while(j<1){i=i+1;j=j+1;sum=sum+1;}i=i+1;}export default [i,sum];', { default: [4, 2] }],
            ['let i=0;let sum=0;while(i<2){let j=0;while(j<1){const i=7;sum=sum+i;j=j+1;}i=i+1;}export default [i,sum];', { default: [2, 14] }],
            ['let i=0;while(i<2){while(false){const skipped=null.x;}i=i+1;}export default i;', { default: 2 }],
            ['let i=0;while(false){while(null.x){i=1;}}export default i;', { default: 0 }],
            ['let i=0;export const before=i;while(i<2){let j=0;while(j<1){i=i+1;j=j+1;}}export const after=i;export default [before,after];', { after: 2, before: 0, default: [0, 2] }],
            ['let i=0;let saved=()=>-1;while(i<3){let j=0;while(j<2){const snapshot=i*10+j;saved=()=>snapshot;j=j+1;}i=i+1;}export default saved();', { default: 21 }],
            ['let i=0;let sum=0;while(i<2){let j=0;while(j<2){sum=sum+(()=>i+j)();j=j+1;}i=i+1;}export default sum;', { default: 4 }],
            ['let i=0\nwhile(i<2){let j=0\nwhile(j<1){j=j+1}\ni=i+1}export default i', { default: 2 }],
        ]
        for (const [source, expected] of cases) {
            assertStructurallySame(assertOk(toData(_evaluate(assertOk(parseFromTokens(tokenizeString(source)))))), expected, source)
        }
    },
    reachedConditionsAndWorkRemainRequired: () => {
        /** @type {readonly string[]} */
        const cases = [
            'let i=0;while(i<1){while(null.x){}i=i+1;}export default i;',
            'let i=0;while(i<1){let j=0;while(j<1){const required=null.x;j=j+1;}i=i+1;}export default i;',
            'let i=0;let state=0;while(i<1){let j=0;while(j<1){state=null.x;state=1;j=j+1;}i=i+1;}export default state;',
            'let i=0;while(i<1){while(false){}const required=null.x;i=i+1;}export default i;',
        ]
        for (const source of cases) {
            const module = assertOk(parseFromTokens(tokenizeString(source)))
            assertError(memo(assertOk(analysis(unresolved(module).edag)))({ args: [] }))
        }
    },
    nestedScopesAndCaptureAdmission: () => {
        /** @type {readonly (readonly [string, string])[]} */
        const cases = [
            ['while(false){while(false){const hidden=1;}const read=hidden;}export default 0;', 'const not found'],
            ['while(false){let local=0;while(false){local=1;}}export default local;', 'const not found'],
            ['const fixed=0;while(false){while(false){fixed=1;}}export default fixed;', 'assignment to const'],
            ['let state=0;const held=()=>state;while(false){while(false){state=1;}}export default held;', 'reassigned variable captured'],
            ['let state=0;while(false){while(false){const held=()=>state;state=1;}}export default state;', 'reassigned variable captured'],
            ['let state=0;while(false){while(false){const state=state;}}export default state;', 'capture shadowed'],
            ['while(false){while(false){const duplicate=1;const duplicate=2;}}export default 0;', 'duplicate id'],
            ['while(false){let local=0 while(false){}}export default 0;', 'unexpected token'],
            ['while(false){while(false){}}export default missing;', 'const not found'],
        ]
        for (const [source, expected] of cases) {
            const result = parseFromTokens(tokenizeString(source))
            assert(result[0] === 'error', source)
            assertEq(result[1].message, expected, source)
        }
    },
    nestingUsesTheExplicitStack: () => {
        /** @type {number} */
        const depth = 2048
        /** @type {string} */
        const source = `${'while(false){'.repeat(depth)}${'}'.repeat(depth)}export default 0;`
        assertOk(parseFromTokens(tokenizeString(source)))
    },
})
