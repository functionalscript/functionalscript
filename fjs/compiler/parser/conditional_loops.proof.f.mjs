/** Normal conditionals retain loop fallthrough and lexical source evidence. */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { analysis } from '../../edag/analysis/module.f.mjs'
import { memo } from '../../edag/memo/module.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'
import { unresolved } from '../edag/module.f.mjs'
import { parseFromTokens } from './module.f.mjs'
import { _evaluate, tokenizeString } from './proof.f.mjs'

export const proof = {
    requiredConditionalComputations: () => {
        /** @type {readonly string[]} */
        const cases = [
            'let i=0;while(i<1){if(null.x){i=1;}i=i+1;}export default i;',
            'let i=0;while(i<1){if(true){const required=null.x;}i=i+1;}export default i;',
            'let i=0;while(i<1){if(true){i=null.x;i=1;}i=i+1;}export default i;',
        ]
        for (const source of cases) {
            const module = assertOk(parseFromTokens(tokenizeString(source)))
            assertError(memo(assertOk(analysis(unresolved(module).edag)))({ args: [] }))
        }
    },
    conditionalLexicalRegions: () => {
        const module = assertOk(parseFromTokens(tokenizeString('let state=0;while(state<2){if(state===0){let local=1;state=state+local;}state=state+1;}export default state;')))
        const loop = module.body.statements[1]
        assert(loop[0] === 'while')
        assertStructurallySame(loop[1].body.statements.map(statement => statement[0]), ['if', 'write'])
        const branch = loop[1].body.statements[0]
        assert(branch[0] === 'if')
        assertStructurallySame(branch[2].statements.map(statement => statement[0]), ['initialize', 'write'])
        assertStructurallySame(branch[2].exit, ['yield', undefined])
        assert(loop[1].events.some(event => event[0] === 'region'))
        assertEq(module.bindings.filter(binding => binding.isMutable).length, 1)
        assertStructurallySame(assertOk(toData(_evaluate(module))), { default: 2 })
    },
    conditionalFallthrough: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['let i=0;let sum=0;while(i<6){if(i%2===0){sum=sum+i;}i=i+1;}export default [i,sum];', { default: [6, 6] }],
            ['let i=0;let sum=0;while(i<3){let local=1;if(i!==1){local=local+2;}sum=sum+local;i=i+1;}export default sum;', { default: 7 }],
            ['let i=0;let sum=0;while(i<4){if(i<3){if(i>0){sum=sum+i;}}i=i+1;}export default sum;', { default: 3 }],
            ['let i=0;while(i<3){if(i===0){i=i+1;}if(i===1){i=i+2;}i=i+1;}export default i;', { default: 4 }],
            ['let i=0;let sum=0;while(i<2){if(true){const i=7;sum=sum+i;}i=i+1;}export default [i,sum];', { default: [2, 14] }],
            ['let i=0;while(i<2){if(false){const unused=null.x;}i=i+1;}export default i;', { default: 2 }],
            ['let i=0;let saved=()=>-1;while(i<3){if(i===1){const snapshot=i;saved=()=>snapshot;}i=i+1;}export default saved();', { default: 1 }],
            ['let i=0;let value=[0];const initial=value;while(i<3){if(i===1){value=[1];}if(false){value=[2];}i=i+1;}export default [initial===value,initial[0],value[0]];', { default: [false, 0, 1] }],
            ['let i=0\nwhile(i<2){if(i===0){i=i+1}i=i+1}export default i', { default: 2 }],
            ['while(false){if(true){const unused=null.x;}}export default 7;', { default: 7 }],
        ]
        for (const [source, expected] of cases) {
            assertStructurallySame(assertOk(toData(_evaluate(assertOk(parseFromTokens(tokenizeString(source)))))), expected, source)
        }
    },
    conditionalRefusals: () => {
        /** @type {readonly (readonly [string, string])[]} */
        const cases = [
            ['const fixed=0;while(false){if(false){fixed=1;}}export default fixed;', 'assignment to const'],
            ['let state=0;const held=()=>state;while(false){if(false){state=1;}}export default held;', 'reassigned variable captured'],
            ['let state=0;while(false){if(false){const held=()=>state;}state=1;}export default state;', 'reassigned variable captured'],
            ['let state=0;while(false){if(true){const unused=(()=>{state=1;return 0;})();}}export default state;', 'reassigned variable captured'],
            ['while(false){if(true){const hidden=1;}const read=hidden;}export default 0;', 'const not found'],
            ['while(false){if(true){const duplicate=1;const duplicate=2;}}export default 0;', 'duplicate id'],
            ['let state=0;while(false){if(true){const state=state;}}export default state;', 'capture shadowed'],
            ['let state=0;while(false){state=1 if(true){}}export default state;', 'unexpected token'],
            ['while(false){if(true){const local=1 const next=2;}}export default 0;', 'unexpected token'],
            ['while(false){if(missing){}}export default 0;', 'const not found'],
        ]
        for (const [source, expected] of cases) {
            const result = parseFromTokens(tokenizeString(source))
            assert(result[0] === 'error', source)
            assertEq(result[1].message, expected, source)
        }
    },
}
