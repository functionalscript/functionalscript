/** Terminal unconditional loops preserve source exits without an implicit result. */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { analysis } from '../../edag/analysis/module.f.mjs'
import { memo } from '../../edag/memo/module.f.mjs'
import { parse } from '../transpiler/module.f.mjs'
import { apply, compile, execute, value } from './proof.f.mjs'

/** @type {(source: string) => unknown} */
const run = source => execute(compile(source).edag)

export const proof = {
    returningPathsAndContinue: () => {
        const counted = value(compile('export default n=>{let i=0;while(true){i=i+1;if(i===n){return i*2;}continue;}};').edag)
        assertEq(apply(counted, [1]), 2)
        assertEq(apply(counted, [4]), 8)
        assertEq(run('export default (()=>{while((true)){return 7;}})();'), 7)
        assertStructurallySame(run('export default (()=>{let i=0;let sum=0;while(true){i=i+1;if(i<3){continue;}sum=sum+i;if(i===5){return [i,sum];}}})();'), [5, 12])
    },
    nestedBreaksHaveTheirOwnTargets: () => {
        assertEq(run('export default (()=>{while(true){let j=0;while(j<3){j=j+1;break;}return j;}})();'), 1)
        assertEq(run('export default (()=>{let i=0;while(true){i=i+1;switch(i){case 1:{break;}default:{return i;}}}})();'), 2)
        assertEq(run('export default (()=>{while(true){switch(1){case 1:{while(true){break;}break;}default:{return 9;}}return 3;}})();'), 3)
    },
    terminalGuardAndCaseBlocks: () => {
        const guarded = value(compile('export default n=>{if(n>0){while(true){return n;}}return 0;};').edag)
        assertEq(apply(guarded, [3]), 3)
        assertEq(apply(guarded, [-1]), 0)
        const switched = value(compile('export default n=>{switch(n){case 0:{while(true){return 7;}}default:{return 8;}}};').edag)
        assertEq(apply(switched, [0]), 7)
        assertEq(apply(switched, [1]), 8)
    },
    nestedFunctionsOwnTheirReturns: () => {
        assertEq(run('export default (()=>{let i=0;while(true){const inner=()=>{while(true){return 5;}};const x=inner();i=i+1;if(i===2){return x+i;}}})();'), 7)
        assertEq(run('export default (()=>{while(true){const inner=()=>{while(true){break;}return 6;};return inner();}})();'), 6)
    },
    throwsAndRequiredComputationsRemainReached: () => {
        for (const source of [
            'export default (()=>{while(true){throw "failure";}})();',
            'export default (()=>{let i=0;while(true){i=i+1;if(i===3){throw "third round";}}})();',
            'export default (()=>{while(true){const required=null.x;return 1;}})();',
        ]) {
            assertError(memo(assertOk(analysis(compile(source).edag)))({ args: [] }))
        }
        assertEq(run('export default (flag=>{if(flag){while(true){throw "unreached";}}return 17;})(false);'), 17)
    },
    ordinaryLoopContinuationsRemainUnchanged: () => {
        assertEq(run('export default (()=>{let i=0;while(i<3){i=i+1;}return i;})();'), 3)
        assertEq(run('export default (()=>{let i=0;while(true){i=i+1;if(i===3){break;}}return i;})();'), 3)
        assertEq(run('export default (()=>{while(false){}return 4;})();'), 4)
        assertEq(run('let i=0;while(i<2){i=i+1;}export default i;'), 2)
    },
    divergentBodiesAreAdmittedWithoutExecution: () => {
        for (const source of [
            'export default ()=>{while(true){}};',
            'export default ()=>{while(true){continue;}};',
            'export default ()=>{while((true)){while(true){break;}}};',
        ]) {
            assertOk(parse('')(source))
            const closure = value(compile(source).edag)
            assert(closure instanceof Array && closure[0] === '=>')
            assertEq(closure[1], 0)
        }
    },
    sourceAdmissionRemainsConservative: () => {
        for (const source of [
            'export default ()=>{while(true){break;}};',
            'export default ()=>{while(true){if(false){break;}}};',
            'export default ()=>{while(true){return 1;break;}};',
            'export default ()=>{while(true){throw 1;break;}};',
            'export default ()=>{while(false){}};',
            'export default ()=>{while(1){}};',
            'export default ()=>{while(!false){}};',
            'export default ()=>{const yes=true;while(yes){}};',
            'export default ()=>{while(true||false){}};',
            'export default ()=>{};',
            'export default ()=>{const value=1;};',
            'export default ()=>{while(true){}const value=1;};',
            'export default ()=>{while(true){if(false){const unused=missing;}}};',
            'export default ()=>{while(true){return 1;const unused=missing;}};',
            'export default ()=>{let value=0;while(true){const held=()=>value;value=value+1;if(false){return held;}}};',
            'while(true){}',
        ]) {
            assertError(parse('')(source))
        }
    },
}
