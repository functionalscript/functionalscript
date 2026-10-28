/** Loop-body switches preserve lexical transfer owners and forbid case fallthrough. */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { analysis } from '../../edag/analysis/module.f.mjs'
import { memo } from '../../edag/memo/module.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'
import { unresolved } from '../edag/module.f.mjs'
import { parseFromTokens } from './module.f.mjs'
import { _evaluate, tokenizeString } from './proof.f.mjs'

export const proof = /** @type {const} */ ({
    transfersKeepSeparateBreakAndContinueOwners: () => {
        const module = assertOk(parseFromTokens(tokenizeString('const f=n=>{while(n){switch(n){case 1:case 2:{if(n){break;}else{continue;}const after=0;}case 3:{while(n){break;}switch(n){case 4:{break;}default:{break;}}break;}default:{return n;}}break;}return 0;};export default f;')))
        const declaration = module.body.statements[0]
        assert(declaration[0] === 'initialize')
        const value = declaration[2]
        assert(value instanceof Array && value[0] === 'function')
        const outer = value[1].body.statements[0]
        assert(outer[0] === 'while')
        const switched = outer[1].body.statements[0]
        assert(switched[0] === 'switch')
        assert(switched[1].target !== outer[1].target)
        assertStructurallySame(switched[1].cases[0].labels, [1, 2])
        const conditional = switched[1].cases[0].body.statements[0]
        assert(conditional[0] === 'if')
        const broken = conditional[2].statements[0]
        const continued = conditional[3].statements[0]
        assert(broken[0] === 'break' && continued[0] === 'continue')
        assertEq(broken[1], switched[1].target)
        assertEq(continued[1], outer[1].target)
        assertEq(switched[1].cases[0].body.statements[1][0], 'initialize')
        const nested = switched[1].cases[1].body.statements[0]
        assert(nested[0] === 'while')
        const innerBreak = nested[1].body.statements[0]
        assert(innerBreak[0] === 'break')
        assertEq(innerBreak[1], nested[1].target)
        assert(nested[1].target !== switched[1].target)
        const innerSwitch = switched[1].cases[1].body.statements[1]
        assert(innerSwitch[0] === 'switch')
        const switchBreak = innerSwitch[1].cases[0].body.statements[0]
        assert(switchBreak[0] === 'break')
        assertEq(switchBreak[1], innerSwitch[1].target)
        assert(innerSwitch[1].target !== switched[1].target)
        const caseBreak = switched[1].cases[1].body.statements[2]
        assert(caseBreak[0] === 'break')
        assertEq(caseBreak[1], switched[1].target)
        const returned = switched[1].otherwise.statements[0]
        assert(returned[0] === 'return')
        assertEq(returned[1], value[1].target)
        const loopBreak = outer[1].body.statements[1]
        assert(loopBreak[0] === 'break')
        assertEq(loopBreak[1], outer[1].target)
    },
    selectedCasesResumeWithCurrentState: () => {
        const source = 'const f=n=>{let i=0;let sum=0;while(i<n){i=i+1;switch(i){case 1:case 2:{sum=sum+10;break;}case 3:{continue;}case 4:{return [i,sum];}default:{sum=sum+i;break;}}sum=sum+100;}return [i,sum];};export default [f(0),f(1),f(2),f(3),f(5)];'
        assertStructurallySame(assertOk(toData(_evaluate(assertOk(parseFromTokens(tokenizeString(source)))))), { default: [[0, 0], [1, 110], [2, 220], [3, 220], [4, 220]] })
        const noDefault = 'let i=0;let sum=0;while(i<3){i=i+1;switch(i){case 2:{sum=sum+10;break;}}sum=sum+i;}export default [i,sum];'
        assertStructurallySame(assertOk(toData(_evaluate(assertOk(parseFromTokens(tokenizeString(noDefault)))))), { default: [3, 16] })
        const nested = 'let i=0;let sum=0;while(i<2){i=i+1;if(i===1){switch(i){case 1:{switch(i){case 2:{sum=99;break;}default:{sum=sum+3;break;}}sum=sum+4;break;}}}sum=sum+10;}export default sum;'
        assertStructurallySame(assertOk(toData(_evaluate(assertOk(parseFromTokens(tokenizeString(nested)))))), { default: 27 })
    },
    labelsAndDiscriminantsRetainReachedEvaluation: () => {
        for (const source of [
            'let i=0;while(i<1){i=i+1;switch(i){case 1:case null.x:{break;}case null.x:{throw 0;}default:{throw 1;}}}export default i;',
            'const value={};let i=0;while(i<1){i=i+1;switch(value){case value:{break;}case null.x:{throw 0;}}}export default i;',
            'let i=0;while(i<1){i=i+1;switch(i){case 2:{throw 0;}default:{break;const skipped=null.x;}}}export default i;',
        ]) { assertStructurallySame(assertOk(toData(_evaluate(assertOk(parseFromTokens(tokenizeString(source)))))), { default: 1 }) }
        for (const source of [
            'while(true){switch(null.x){case 1:{break;}}break;}export default 0;',
            'while(true){switch(1){case null.x:{break;}default:{break;}}break;}export default 0;',
            'while(true){switch(1){case 1:{const reached=null.x;break;}}break;}export default 0;',
            'while(true){switch(1){case 1:{throw 3;}}break;}export default 0;',
        ]) {
            const module = assertOk(parseFromTokens(tokenizeString(source)))
            assertError(memo(assertOk(analysis(unresolved(module).edag)))({ args: [] }))
        }
    },
    normalCaseFallthroughRemainsRefused: () => {
        for (const body of [
            'case 1:{}',
            'case 1:{const local=1;}',
            'case 1:{if(true){break;}}',
            'case 1:{while(false){break;}}',
            'case 1:{switch(2){case 2:{break;}default:{break;}}}',
            'case 1:{switch(2){case 2:{return 2;}}}',
            'case 1:{break;}default:{}',
        ]) {
            assertEq(assertError(parseFromTokens(tokenizeString(`export default ()=>{while(false){switch(1){${body}}}return 0;};`))).message, 'switch case does not terminate')
        }
        for (const body of [
            'case 1:{if(true){break;}else{continue;}}',
            'case 1:{if(true){}else{}break;}',
            'case 1:{if(true){return 1;}else{throw 2;}}',
            'case 1:{switch(2){case 2:{return 2;}default:{throw 3;}}}',
            'case 1:{switch(2){case 2:{break;}}break;}',
            'case 1:{break;const skipped=2;}',
        ]) { assertOk(parseFromTokens(tokenizeString(`export default ()=>{while(false){switch(1){${body}}}return 0;};`))) }
    },
    casesKeepCompleteSourceChecksAndLexicalNames: () => {
        for (const [body, message] of [
            ['case 1:{break;const after=missing;}', 'const not found'],
            ['case 1:{const local=local;break;}', 'const not found'],
            ['case 1:{break;const local=1;const local=2;}', 'duplicate id'],
            ['case 1:{const fixed=0;break;fixed=1;}', 'assignment to const'],
            ['case 1:{const local=1;break;}case local:{break;}', 'const not found'],
            ['case 1:{const local=1;break;}default:{return local;}', 'const not found'],
            ['case 1:{const held=()=>n;break;n=2;}', 'reassigned variable captured'],
            ['case 1:{const f=()=>{continue;return 0;};break;}', 'unexpected token'],
        ]) {
            assertEq(assertError(parseFromTokens(tokenizeString(`export default n=>{while(false){switch(n){${body}}}return n;};`))).message, message)
        }
        assertOk(parseFromTokens(tokenizeString('export default n=>{while(false){switch(n){case 1:{const local=1;break;}case 2:{const local=2;break;}default:{const local=3;break;}}}return n;};')))
        assertEq(assertError(parseFromTokens(tokenizeString('while(false){switch(1){case 1:{return 2;}}}export default 0;'))).message, 'unexpected token')
    },
    switchScopesKeepLineAndExitBoundaries: () => {
        assertOk(parseFromTokens(tokenizeString('let i=0;while(i<1){i=i+1;switch(i){case 1:{break\nconst after=2;}default:{continue\n}}i=i+1;}export default i;')))
        for (const body of [
            'case 1:{break const after=2;}',
            'case 1:{continue n=2;}',
            'case 1:{return\n1;}',
            'case 1:{throw\n1;}',
        ]) { assertEq(assertError(parseFromTokens(tokenizeString(`export default n=>{while(false){switch(n){${body}}}return n;};`))).message, 'unexpected token') }
    },
    casePathsAndLabelsUseExplicitStacks: () => {
        const labels = Array.from({ length: 2048 }, (_, index) => `case ${index}:`).join('')
        assertOk(parseFromTokens(tokenizeString(`while(false){switch(0){${labels}{break;}}}export default 0;`)))
        const conditions = 'if(true){}else{}'.repeat(512)
        assertOk(parseFromTokens(tokenizeString(`while(false){switch(0){case 0:{${conditions}break;}}}export default 0;`)))
        const depth = 512
        assertOk(parseFromTokens(tokenizeString(`while(false){switch(0){case 0:{${'if(true){'.repeat(depth)}break;${'}else{break;}'.repeat(depth)}}}}export default 0;`)))
    },
})
