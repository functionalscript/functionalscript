/**
 * Ordinary normal conditional admission, independently of target reconstruction.
 * Names and source scopes are checked before immutable joins are constructed.
 */

import { assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { identityAnalysis } from '../../edag/analysis/module.f.mjs'
import { memo } from '../../edag/memo/module.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'
import { unresolved } from '../edag/module.f.mjs'
import { parse } from '../source/module.f.mjs'

const path = /** @type {const} */ ('/normal-if.f.js')

/** @type {(source: string) => unknown} */
const evaluated = source => {
    const graph = unresolved(assertOk(parse(path)(source))).edag
    return assertOk(toData(assertOk(memo(assertOk(identityAnalysis(graph)))({ args: [] }))))
}

/** @type {(source: string, message: string) => void} */
const refused = (source, message) => { assertEq(assertError(parse(path)(source)).message, message) }

export const proof = /** @type {const} */ ({
    missingElseJoinsTheIncomingVersion: () => {
        assertStructurallySame(evaluated(`
            const f=b=>{let a=0;if(b){a+=2;}return a;};
            export default [f(false),f(true)];
        `), { default: [0, 2] })
    },
    alternateArmsAndFollowingWorkUseOneSelectedVersion: () => {
        assertStructurallySame(evaluated(`
            const f=b=>{let a=1;if(b){a+=2;}else{a+=4;}a*=3;return a;};
            export default [f(false),f(true)];
        `), { default: [15, 9] })
        assertStructurallySame(evaluated(`
            const f=(a,b)=>{let x=0;if(a){x=1;}else if(b){x=2;}else{x=3;}return x;};
            export default [f(true,false),f(false,true),f(false,false)];
        `), { default: [1, 2, 3] })
    },
    emptyArmsAndArmLocalWritesHaveNoOuterResult: () => {
        assertStructurallySame(evaluated(`
            const f=b=>{
                let x=7;
                if(b){let x=1;x+=2;}else{let x=4;x+=5;}
                if(b){}else{}
                return x;
            };
            export default [f(false),f(true)];
        `), { default: [7, 7] })
    },
    nestedNormalArmsKeepTheirOwnScopes: () => {
        assertStructurallySame(evaluated(`
            const f=(a,b)=>{
                let x=0;
                if(a){const local=2;if(b){x=local;}else{x=local+1;}}else{x=5;}
                return x;
            };
            export default [f(false,false),f(true,false),f(true,true)];
        `), { default: [5, 3, 2] })
        refused('export default b=>{if(b){const x=1;}return x;};', 'const not found')
        refused('export default b=>{if(b){const x=1;}else{const y=x;}return 0;};', 'const not found')
        refused('export default b=>{if(b){const x=1;const x=2;}return 0;};', 'duplicate id')
    },
    conditionWritesPrecedeTheArmJoin: () => {
        assertStructurallySame(evaluated(`
            const f=b=>{
                let n=0;
                let a=0;
                if((()=>{n+=1;return b;})()){a+=2;}else{a+=3;}
                return [n,a];
            };
            export default [f(false),f(true)];
        `), { default: [[1, 3], [1, 2]] })
    },
    immediatelyCalledArmFunctionsMayExportOneWrite: () => {
        assertStructurallySame(evaluated(`
            const f=b=>{
                let n=0;
                if(b){const ignored=(()=>{n+=1;return 7;})();}else{n=3;}
                return n;
            };
            export default [f(false),f(true)];
        `), { default: [3, 1] })
    },
    nestedOrdinaryReturnsKeepTheirInvocation: () => {
        assertStructurallySame(evaluated(`
            const f=b=>{let n=0;if(b){const g=()=>{return 7;};n=g();}return n;};
            export default [f(false),f(true)];
        `), { default: [0, 7] })
    },
    lexicalAndCaptureChecksStillInspectSkippedArms: () => {
        refused('export default ()=>{const x=0;if(false){x=1;}return x;};', 'assignment to const')
        refused('export default ()=>{let x=0;if(false){x=missing;}return x;};', 'const not found')
        refused('export default ()=>{let x=0;const g=()=>x;if(false){x=1;}return g();};', 'reassigned variable captured')
        refused('export default ()=>{let x=0;if(false){x=1;}const g=()=>x;return g();};', 'reassigned variable captured')
        refused('export default b=>{let x=0;if(b){const g=()=>{x=1;return 0;};}return x;};', 'reassigned variable captured')
    },
    atMostOneEstablishedBindingCrossesTheNormalJoin: () => {
        for (const source of [
            'export default b=>{let x=0;let y=0;if(b){x=1;y=2;}return x+y;};',
            'export default b=>{let x=0;let y=0;if(b){x=1;}else{y=2;}return x+y;};',
            'export default (a,b)=>{let x=0;let y=0;if(a){x=1;}else if(b){y=2;}return x+y;};',
            'export default b=>{let x=0;let y=0;if(b){const ignored=(()=>{x=1;y=2;return 0;})();}return x+y;};',
        ]) { refused(source, 'ordinary conditional joins at most one outer binding') }
    },
    explicitThrowsRetainTheirAdmissionBoundary: () => {
        for (const source of [
            'export default b=>{if(b){while(b){throw 1;}}return 2;};',
            'export default b=>{let n=0;if(b){n=1;}else{throw 2;}return n;};',
        ]) { refused(source, 'ordinary conditional arms do not admit explicit throw') }
    },
    finalArmLoopsRetainTheirNormalAndTerminalMeanings: () => {
        assertStructurallySame(evaluated(`
            const f=b=>{
                let n=0;
                if(b){while(n<3){n+=1;}}
                if(b){for(let i=0;i<2;i+=1){n+=2;}}
                if(b){while(true){n+=1;break;}}
                if(b){for(;;){n+=1;break;}}
                return n;
            };
            export default [f(false),f(true)];
        `), { default: [0, 9] })
        assertStructurallySame(evaluated(`
            const f=b=>{if(b){while(true){return 7;}}return 3;};
            const g=b=>{if(b){for(;;){return 8;}}return 4;};
            export default [f(false),f(true),g(false),g(true)];
        `), { default: [3, 7, 4, 8] })
    },
    normalArmLoopsKeepTheirLocalTransfersAndSwitchOwners: () => {
        assertStructurallySame(evaluated(`
            const f=b=>{
                let n=0;
                if(b){while(n<3){n+=1;if(n===1){continue;}switch(n){case 2:{break;}default:{break;}}break;}}
                return n;
            };
            export default [f(false),f(true)];
        `), { default: [0, 2] })
    },
    armBoundariesPreserveSemicolonInsertion: () => {
        assertStructurallySame(evaluated(`
            const f=b=>{let n=0;if(b){n+=1
            }else{n+=2
            }return n;};
            export default [f(false),f(true)];
        `), { default: [2, 1] })
        assertError(parse(path)('export default b=>{let n=0 if(b){n=1;}return n;};'))
        assertError(parse(path)('export default b=>{let n=0;if(b){n=1 n=2;}return n;};'))
    },
})
