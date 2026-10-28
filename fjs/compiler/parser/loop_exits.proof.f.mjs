/** Source jumps retain lexical targets, complete source facts and reached work. */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { analysis } from '../../edag/analysis/module.f.mjs'
import { memo } from '../../edag/memo/module.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'
import { unresolved } from '../edag/module.f.mjs'
import { parseFromTokens } from './module.f.mjs'
import { _evaluate, tokenizeString } from './proof.f.mjs'

export const proof = /** @type {const} */ ({
    targetsRemainLexicalAndComplete: () => {
        const module = assertOk(parseFromTokens(tokenizeString('let i=0;while(i<3){if(i===0){i=i+1;continue;}else{if(i===2){break;}}let j=0;while(j<2){j=j+1;continue;break;}break;continue;i=i+1;}export default i;')))
        const outer = module.body.statements[1]
        assert(outer[0] === 'while')
        assertStructurallySame(outer[1].target, { kind: 'loop', index: 2 })
        const statements = outer[1].body.statements
        assertStructurallySame(statements.map(statement => statement[0]), ['if', 'initialize', 'while', 'break', 'continue', 'write'])
        const branch = statements[0]
        assert(branch[0] === 'if')
        const continued = branch[2].statements[1]
        assert(continued[0] === 'continue')
        assertEq(continued[1], outer[1].target)
        const nestedBranch = branch[3].statements[0]
        assert(nestedBranch[0] === 'if')
        const broken = nestedBranch[2].statements[0]
        assert(broken[0] === 'break')
        assertEq(broken[1], outer[1].target)
        const inner = statements[2]
        assert(inner[0] === 'while')
        assert(inner[1].target !== outer[1].target)
        for (const statement of inner[1].body.statements.slice(1)) {
            assert(statement[0] === 'break' || statement[0] === 'continue')
            assertEq(statement[1], inner[1].target)
        }
        for (const statement of statements.slice(3, 5)) {
            assert(statement[0] === 'break' || statement[0] === 'continue')
            assertEq(statement[1], outer[1].target)
        }
        assert(outer[1].events.some(event => event[0] === 'region' && event[1].some(event => event[0] === 'write')))
        assertStructurallySame(outer[1].body.exit, ['yield', undefined])
        const plain = assertOk(parseFromTokens(tokenizeString('while(false){}export default 0;'))).body.statements[0]
        assert(plain[0] === 'while')
        assertStructurallySame(plain[1].target, { kind: 'loop', index: 1 })
    },
    functionsOwnTheirLoopTargets: () => {
        const module = assertOk(parseFromTokens(tokenizeString('while(false){const local=()=>{let j=0;while(j<1){j=j+1;break;}return j;};break;}export default 0;')))
        const outer = module.body.statements[0]
        assert(outer[0] === 'while')
        const declaration = outer[1].body.statements[0]
        assert(declaration[0] === 'initialize')
        const value = declaration[2]
        assert(value instanceof Array && value[0] === 'function')
        const inner = value[1].body.statements[1]
        assert(inner[0] === 'while')
        assert(inner[1].target !== outer[1].target)
        const jump = inner[1].body.statements[1]
        assert(jump[0] === 'break')
        assertEq(jump[1], inner[1].target)
    },
    transfersPreserveCurrentStateAndContinuation: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['let i=0;while(true){i=i+1;break;i=99;}export default i;', { default: 1 }],
            ['let i=0;while(i<5){i=i+1;continue;i=99;}export default i;', { default: 5 }],
            ['let i=0;let sum=0;while(i<6){i=i+1;if(i<3){continue;}sum=sum+i;}export default [i,sum];', { default: [6, 18] }],
            ['let i=0;let sum=0;while(i<6){i=i+1;if(i===2){continue;}else if(i===4){break;}else{sum=sum+i;}}export default [i,sum];', { default: [4, 4] }],
            ['let i=0;let sum=0;while(i<5){i=i+1;if(i<3){continue;}else{break;}sum=999;}sum=sum+10;export default [i,sum];', { default: [3, 10] }],
            ['let i=0;let sum=0;while(i<3){i=i+1;let j=0;while(j<5){j=j+1;if(j===2){continue;}if(j===4){break;}sum=sum+1;}sum=sum+10;}export default [i,sum];', { default: [3, 36] }],
            ['let i=0;while(i<2){i=i+1;break;}while(i<4){i=i+1;continue;}export default i;', { default: 4 }],
            ['while(true){break;const skipped=null.x;}export default 7;', { default: 7 }],
            ['let i=0;while(i<1){i=i+1;continue;const skipped=null.x;}export default i;', { default: 1 }],
            ['let i=0;while(i<1?true:null.x){i=i+1;break;}export default i;', { default: 1 }],
            ['let i=0;export const before=i;while(i<5){i=i+1;if(i===2){break;}}export const after=i;export default [before,after];', { before: 0, after: 2, default: [0, 2] }],
            ['const f=n=>{let i=0;let sum=0;while(i<n){i=i+1;if(i===2){continue;}sum=sum+i;if(i===4){break;}}return [i,sum];};export default [f(0),f(6)];', { default: [[0, 0], [4, 8]] }],
            ['let i=0;let saved=()=>-1;while(i<4){i=i+1;const snapshot=i;saved=()=>snapshot;if(i===2){continue;}if(i===3){break;}}export default [i,saved()];', { default: [3, 3] }],
            ['const fields={break:1,continue:2};export default [fields.break,fields.continue];', { default: [1, 2] }],
        ]
        for (const [source, expected] of cases) {
            assertStructurallySame(assertOk(toData(_evaluate(assertOk(parseFromTokens(tokenizeString(source)))))), expected, source)
        }
    },
    conditionRetestsAndEarlierWorkRemainRequired: () => {
        /** @type {readonly string[]} */
        const cases = [
            'let i=0;while(i<1?true:null.x){i=i+1;continue;}export default i;',
            'while(true){const required=null.x;break;}export default 0;',
            'let i=0;while(i<1){i=null.x;i=1;continue;}export default i;',
            'let i=0;while(i<1){i=i+1;if(i===1){const required=null.x;break;}}export default i;',
        ]
        for (const source of cases) {
            const module = assertOk(parseFromTokens(tokenizeString(source)))
            assertError(memo(assertOk(analysis(unresolved(module).edag)))({ args: [] }))
        }
    },
    unreachableStatementsStillSupplySourceFacts: () => {
        /** @type {readonly (readonly [string, string])[]} */
        const cases = [
            ['while(false){break;const unused=missing;}export default 0;', 'const not found'],
            ['while(false){continue;const unused=unused;}export default 0;', 'const not found'],
            ['while(false){break;const duplicate=1;const duplicate=2;}export default 0;', 'duplicate id'],
            ['const fixed=0;while(false){continue;fixed=1;}export default fixed;', 'assignment to const'],
            ['let state=0;const held=()=>state;while(false){break;state=1;}export default held;', 'reassigned variable captured'],
            ['let state=0;while(false){const held=()=>state;continue;state=1;}export default state;', 'reassigned variable captured'],
            ['while(false){break;const value=1;}export default value;', 'const not found'],
            ['let i=0;while(false){if(true){break;}else{continue;}i=missing;}export default i;', 'const not found'],
            ['while(true){break continue;}export default 0;', 'unexpected token'],
            ['while(true){break const value=0;}export default 0;', 'unexpected token'],
            ['const break=1;export default 0;', 'reserved word'],
            ['const continue=1;export default 0;', 'reserved word'],
        ]
        for (const [source, expected] of cases) {
            const result = parseFromTokens(tokenizeString(source))
            assert(result[0] === 'error', source)
            assertEq(result[1].message, expected, source)
        }
        const module = assertOk(parseFromTokens(tokenizeString('let state=0;while(false){break;state=1;}export default state;')))
        assertEq(module.bindings.filter(binding => binding.isMutable).length, 1)
        const loop = module.body.statements[1]
        assert(loop[0] === 'while')
        assert(loop[1].events.some(event => event[0] === 'region' && event[1].some(event => event[0] === 'write')))
    },
    insertedSemicolonsAndExplicitStacks: () => {
        for (const source of [
            'while(true){break\nconst skipped=null.x;}export default 7;',
            'while(true){break\n}export default 7;',
            'let i=0;while(i<1){i=i+1\ncontinue\nconst skipped=null.x;}export default 7;',
        ]) {
            assertStructurallySame(assertOk(toData(_evaluate(assertOk(parseFromTokens(tokenizeString(source)))))), { default: 7 })
        }
        const jumps = assertOk(parseFromTokens(tokenizeString(`while(false){${'break;continue;'.repeat(4096)}}export default 0;`))).body.statements[0]
        assert(jumps[0] === 'while')
        assertEq(jumps[1].body.statements.length, 8192)
        const depth = 2048
        assertOk(parseFromTokens(tokenizeString(`while(false){${'if(true){'.repeat(depth)}break;${'}'.repeat(depth)}}export default 0;`)))
    },
})
