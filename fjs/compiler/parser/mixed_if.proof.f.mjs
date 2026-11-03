/** Mixed arms retain function returns while normal paths reach one continuation. */

import { assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { identityAnalysis } from '../../edag/analysis/module.f.mjs'
import { memo } from '../../edag/memo/module.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'
import { unresolved } from '../edag/module.f.mjs'
import { parse } from '../source/module.f.mjs'

const path = /** @type {const} */ ('/mixed-if.f.js')

/** @type {(source: string) => unknown} */
const evaluated = source => {
    const graph = unresolved(assertOk(parse(path)(source))).edag
    return assertOk(toData(assertOk(memo(assertOk(identityAnalysis(graph)))({ args: [] }))))
}

/** @type {(source: string, message: string) => void} */
const refused = (source, message) => { assertEq(assertError(parse(path)(source)).message, message) }

export const proof = /** @type {const} */ ({
    case4NormalArmsReachTheFollowingReturn: () => {
        assertStructurallySame(evaluated(`
            const f=(a,b)=>{
                if(a){const x={a:()=>b,b:()=>11};if(x.a()){return x.b();}}
                return 3;
            };
            export default [f(false,false),f(true,false),f(true,true)];
        `), { default: [3, 3, 11] })
    },
    case7OnlyNormalArmsSupplyTheJoinedVersion: () => {
        assertStructurallySame(evaluated(`
            const f=(a,b)=>{
                let z=0;
                if(a){const x={a:()=>b,b:()=>11,c:()=>2};if(x.a()){return x.b();}z+=x.c();}
                return z+5;
            };
            export default [f(false,false),f(true,false),f(true,true)];
        `), { default: [5, 7, 11] })
    },
    nestedMReturnsKeepTheSelectedWriteAndOwningFunction: () => {
        assertStructurallySame(evaluated(`
            const f=(a,b)=>{
                let m=1;
                if(a){const x={a:2,b,c:7};m=x.a;if(x.b){return x.c;}}
                return m+3;
            };
            export default [f(false,false),f(true,false),f(true,true)];
        `), { default: [4, 5, 7] })
    },
    eitherArmMayReturnBeforeFollowingWork: () => {
        assertStructurallySame(evaluated(`
            const f=(a,b)=>{
                let n=0;
                if(a){n=1;if(b){return 7;}}else if(b){return 8;}else{n=3;}
                return n+10;
            };
            const g=a=>{if(a){return 1;}else{return 2;}return 3;};
            export default [f(false,false),f(false,true),f(true,false),f(true,true),g(false),g(true)];
        `), { default: [13, 8, 11, 7, 2, 1] })
    },
    nestedLoopsKeepBreakContinueAndFunctionReturnOwners: () => {
        assertStructurallySame(evaluated(`
            const f=(a,b)=>{
                let n=0;
                if(a){while(n<3){n+=1;if(n===1){continue;}if(b){return n+10;}break;}}
                return n;
            };
            export default [f(false,false),f(true,false),f(true,true)];
        `), { default: [0, 2, 12] })
    },
    switchCaseReturnsKeepTheirFunctionOwner: () => {
        assertStructurallySame(evaluated(`
            const f=(a,b,c)=>{
                let n=0;
                if(a){switch(b){case 1:{if(c){return 7;}return 8;}default:{return 9;}}}else{n=3;}
                return n+10;
            };
            export default [f(false,1,false),f(true,1,false),f(true,1,true),f(true,2,false)];
        `), { default: [13, 8, 7, 9] })
    },
    switchNoMatchResumesTheNormalBranch: () => {
        assertStructurallySame(evaluated(`
            const f=(a,b)=>{
                let n=0;
                if(a){switch(b){case 1:{return 7;}}while(n<2){n+=1;}}else{n=3;}
                return n+10;
            };
            export default [f(false,1),f(true,1),f(true,2)];
        `), { default: [13, 7, 12] })
    },
    statefulSwitchReturnsKeepReachedDiscriminantAndLabelWrites: () => {
        assertStructurallySame(evaluated(`
            const f=(a,b)=>{
                let n=0;
                if(a){switch((()=>{n+=1;return b;})()){case 1:{return n+7;}default:{return n+8;}}}else{n=3;}
                return n+10;
            };
            const g=(a,b)=>{
                let n=0;
                if(a){switch(b){case (()=>{n+=1;return 1;})():{return n+7;}default:{return n+8;}}}else{n=3;}
                return n+10;
            };
            export default [f(false,1),f(true,1),f(true,2),g(false,1),g(true,1),g(true,2)];
        `), { default: [13, 8, 9, 13, 8, 9] })
    },
    terminalSwitchCasesStillCannotFallThrough: () => {
        for (const loop of ['while(false){}', 'while(true){break;}', 'for(;false;){}', 'for(;;){break;}']) {
            assertError(parse(path)(`export default (a,b)=>{if(a){switch(b){case 1:{${loop}}default:{return 7;}}}else{}return 3;};`))
        }
    },
    returnedFunctionValuesAndImmediateCallsKeepSeparateOwners: () => {
        assertStructurallySame(evaluated(`
            const f=(a,b)=>{
                let n=0;
                if(a){const g=()=>{if(b){if(a){return 7;}}return 8;};n=g();if(b){return n+10;}}
                return n+20;
            };
            const g=(a,b)=>(()=>{if(a){if(b){return 3;}}return 4;})();
            export default [f(false,false),f(true,false),f(true,true),g(false,false),g(true,false),g(true,true)];
        `), { default: [20, 28, 17, 4, 4, 3] })
    },
    retainedImmediateInvocationsCannotWriteTheirEnclosingScope: () => {
        for (const body of [
            'if(a){if(b){return 7;}}n=2;return 3;',
            'if(a){switch(b){case 1:{return 7;}default:{return 8;}}}else{}n=2;return 3;',
        ]) {
            refused(`export default (a,b)=>{let n=0;const value=(()=>{${body}})();return [n,value];};`, 'reassigned variable captured')
        }
    },
    returningPathsStillKeepSourceLegalityAndWriteBounds: () => {
        refused('export default (a,b)=>{const n=0;if(a){if(b){return 7;}n=2;}return n;};', 'assignment to const')
        refused('export default (a,b)=>{let n=0;if(a){if(b){return 7;}n=missing;}return n;};', 'const not found')
        refused('export default (a,b)=>{let n=0;const g=()=>n;if(a){if(b){return 7;}n=2;}return g();};', 'reassigned variable captured')
        refused('export default (a,b)=>{let n=0;let m=0;if(a){n=1;if(b){return 7;}}else{m=2;}return n+m;};', 'ordinary conditional joins at most one outer binding')
        refused('export default (a,b)=>{let n=0;if(a){while(b){return 7;n=missing;}}return n;};', 'const not found')
        refused('export default (a,b)=>{if(a){const x=1;if(b){return x;}}return x;};', 'const not found')
    },
    explicitThrowRemainsOutsideTheNewArmProfile: () => {
        for (const body of [
            'if(a){if(b){return 7;}throw 2;}else{}',
            'if(a){switch(b){case 1:{throw 2;}default:{return 7;}}}else{}',
            'if(a){while(true){throw 2;}}else{}',
            'if(a){while(b){throw 2;}}',
        ]) {
            refused(`export default (a,b)=>{${body}return 3;};`, 'ordinary conditional arms do not admit explicit throw')
        }
    },
    explicitFunctionEndAndReturnLineRulesRemainRequired: () => {
        assertError(parse(path)('export default (a,b)=>{if(a){if(b){return 7;}}};'))
        assertError(parse(path)('export default a=>{if(a){return 7;}else{return 8;}};'))
        assertError(parse(path)('export default (a,b)=>{if(a){if(b){return\n7;}}return 3;};'))
    },
    selectedReturnsSkipFailingContinuationWork: () => {
        assertStructurallySame(evaluated(`
            const f=(a,b)=>{if(a){const x=1;if(b){return x+6;}const ignored=1n+1;}return 3;};
            export default f(true,true);
        `), { default: 7 })
    },
    throw: {
        workBeforeAnOwningReturnRemainsRequired: () => {
            evaluated('const f=(a,b)=>{if(a){const ignored=1n+1;if(b){return 7;}}return 3;};export default f(true,true);')
        },
        aReachedContinuationFailureStillFails: () => {
            evaluated('const f=(a,b)=>{if(a){if(b){return 7;}const ignored=1n+1;}return 3;};export default f(true,false);')
        },
    },
})
