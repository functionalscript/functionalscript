/** Classic for headers lower to the existing loops without changing lexical exits. */

import { assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { analysis } from '../../edag/analysis/module.f.mjs'
import { memo } from '../../edag/memo/module.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'
import { unresolved } from '../edag/module.f.mjs'
import { parse } from '../source/module.f.mjs'

/** @param {string} source */
const evaluated = source => memo(assertOk(analysis(unresolved(assertOk(parse('')(source))).edag)))({ args: [] })

/** @param {string} source */
const result = source => assertOk(toData(assertOk(evaluated(source))))

export const proof = {
    initializationTestsAndNormalUpdates: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['let sum=0;for(let i=0;i<4;i+=1){sum+=i;}export default sum;', 6],
            ['let i=9;let sum=0;for(i=0;i<3;i=i+1){sum+=i;}export default [i,sum];', [3, 3]],
            ['let i=0;for(;i<3;i+=1){}export default i;', 3],
            ['let i=0;for(;i<3;){i+=1;}export default i;', 3],
            ['let i=0;for(;;i+=1){if(i===3){break;}}export default i;', 3],
            ['let i=0;for(;;){i+=1;if(i===3){break;}}export default i;', 3],
            ['let sum=0;for(const i=7;true;){sum=i;break;}export default sum;', 7],
            ['let sum=0;for(let [i]=[0];i<3;i+=1){sum+=i;}export default sum;', 3],
            ['for(let i=0;false;i=null.x){const skipped=null.x;}export default 7;', 7],
            ['let count=0;for(let i=(()=>{count+=1;return 0;})();i<3;i+=1){count+=10;}export default count;', 31],
            ['let tests=0;let i=0;for(;(()=>{tests+=1;return i<3;})();i+=1){}export default [i,tests];', [3, 4]],
            ['let count=0;let i=0;for(;i<3;i=(()=>{count+=10;return i+1;})()){count+=1;continue;}export default [i,count];', [3, 33]],
            ['const input=[0,0x12,0x34,0x56];const first=1;const count=3;let word=0;for(let i=0;i<count;i+=1){word|=input[Number(first+i)]<<8*i;}export default word;', 0x56_3412],
        ]
        for (const [source, expected] of cases) {
            assertStructurallySame(result(source), { default: expected }, source)
        }
        assertStructurallySame(result('let i=0;export const before=i;for(;i<3;i+=1){}export const after=i;export default [before,after];'), { before: 0, after: 3, default: [0, 3] })
    },
    headerBindingsHaveTheirOwnScope: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['let i=9;let sum=0;for(let i=0;i<3;i+=1){sum+=i;}export default [i,sum];', [9, 3]],
            ['let sum=0;for(let i=0;i<3;i+=1){const i=9;sum+=i;}export default sum;', 27],
            ['let rounds=0;for(let i=0;i<3;i+=1){const i=9;rounds+=1;if(rounds>4){break;}continue;}export default rounds;', 3],
            ['let sum=0;for(let i=0;i<2;i+=1){sum+=i;}for(let i=0;i<3;i+=1){sum+=i;}const i=7;export default [i,sum];', [7, 4]],
            ['let sum=0;for(let i=0;i<3;i+=1){const snapshot=i;const read=()=>snapshot;sum+=read();}export default sum;', 3],
            ['let sum=0;for(let i=1;i<2;){const read=()=>i;sum=read();break;}export default sum;', 1],
        ]
        for (const [source, expected] of cases) {
            assertStructurallySame(result(source), { default: expected }, source)
        }
        for (const source of [
            'for(let i=0;i<1;i+=1){}export default i;',
            'for(let i=0;i<1;i=next){const next=1;}export default 0;',
            'for(let i=0;i<1;i+=1){const held=()=>i;}export default 0;',
            'for(let i=0;false;i+=1){continue;const held=()=>i;}export default 0;',
            'let i=0;const held=()=>i;for(i=1;false;){}export default held;',
            'let i=0;const held=()=>i;for(;false;i+=1){}export default held;',
        ]) { assertError(parse('')(source)) }
    },
    continueRunsUpdateAndBreakSkipsIt: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['let i=0;let rounds=0;for(;i<4;i+=1){rounds+=1;if(rounds>5){break;}if(i<3){continue;}}export default [i,rounds];', [4, 4]],
            ['let i=0;let rounds=0;let sum=0;for(;i<4;i+=1){rounds+=1;if(rounds>5){break;}if(i===1){continue;}else{sum+=i;}}export default [i,sum];', [4, 5]],
            ['let i=0;for(;i<4;i=null.x){i=7;break;}export default i;', 7],
            ['let i=0;let rounds=0;let sum=0;for(;i<4;i+=1){rounds+=1;if(rounds>5){break;}switch(i){case 1:{continue;}default:{sum+=i;break;}}sum+=10;}export default [i,sum];', [4, 35]],
            ['let sum=0;for(let i=0;i<3;i+=1){for(let j=0;j<3;j+=1){if(j===1){continue;}sum+=10*i+j;}sum+=100;}export default sum;', 366],
            ['let sum=0;for(let i=0;i<3;i+=1){let j=0;while(j<2){j+=1;if(j===1){continue;}sum+=i;}}export default sum;', 3],
            ['let i=0;let sum=0;while(i<2){i+=1;for(let j=0;j<3;j+=1){if(j===1){continue;}sum+=j;}}export default sum;', 4],
        ]
        for (const [source, expected] of cases) {
            assertStructurallySame(result(source), { default: expected }, source)
        }
    },
    functionExitsAndTerminalLoopsRetainTheirOwners: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['export default (()=>{for(let i=0;i<3;i=null.x){return i+7;}return 0;})();', 7],
            ['export default (i=>{for(i=0;i<3;i+=1){}return i;})(9);', 3],
            ['export default (()=>{for(;;){return 7;}})();', 7],
            ['export default (()=>{for(let i=0;;i+=1){if(i===3){return i;}}})();', 3],
            ['export default (()=>{for(let i=0;true;i+=1){if(i<3){continue;}return i;}})();', 3],
            ['export default (()=>{for(;;){for(;;){break;}return 3;}})();', 3],
            ['export default (()=>{if(true){for(;;){return 7;}}return 0;})();', 7],
            ['export default (()=>{switch(1){case 1:{for(;;){return 7;}}default:{return 0;}}})();', 7],
            ['export default (()=>{for(let i=0;i<1;i+=1){const inner=()=>{for(;;){return 5;}};return inner()+i;}return 0;})();', 5],
        ]
        for (const [source, expected] of cases) {
            assertStructurallySame(result(source), { default: expected }, source)
        }
        for (const source of [
            'export default ()=>{for(;;){}};',
            'export default ()=>{for(;;){continue;}};',
            'export default ()=>{for(let i=0;true;i+=1){}};',
        ]) { assertOk(parse('')(source)) }
        for (const source of [
            'export default ()=>{for(;;){break;}};',
            'export default ()=>{for(;;){return 1;break;}};',
            'export default ()=>{for(;false;){}};',
            'export default ()=>{for(;1;){}};',
            'export default ()=>{for(;;){const inner=()=>{break;};}};',
        ]) { assertError(parse('')(source)) }
    },
    callsRequiredWorkAndSkippedUpdates: () => {
        assertStructurallySame(result('const fail=()=>{throw 7;};for(;true;fail()){break;}export default 3;'), { default: 3 })
        assertStructurallySame(result('const fail=()=>{throw 7;};for(;false;fail()){}export default 3;'), { default: 3 })
        assertStructurallySame(result('const noop=()=>0;let i=0;for(noop();i<2;i+=1){}export default i;'), { default: 2 })
        assertStructurallySame(result('const noop=()=>0;let i=0;for(;i<2;noop()){i+=1;}export default i;'), { default: 2 })
        for (const source of [
            'for(let i=null.x;false;){}export default 0;',
            'for(;null.x;){}export default 0;',
            'let i=0;for(;i<1;i=null.x){}export default i;',
            'let i=0;for(;i<1;i=null.x){continue;}export default i;',
            'const fail=()=>{throw 7;};for(fail();false;){}export default 0;',
            'const fail=()=>{throw 7;};for(;true;fail()){}export default 0;',
            'for(;true;){throw 7;}export default 0;',
            'export default (()=>{for(;;){throw 7;}})();',
        ]) { assertError(evaluated(source)) }
    },
    allHeaderAndUnreachableSourceChecksStillApply: () => {
        for (const [source, expected] of /** @type {const} */ ([
            ['for(let i=0;false;i=missing){break;}export default 0;', 'const not found'],
            ['for(let i=0;false;i+=1){continue;const unused=missing;}export default 0;', 'const not found'],
            ['for(let i=0;false;i+=1){break;const duplicate=1;const duplicate=2;}export default 0;', 'duplicate id'],
            ['for(const i=0;false;i+=1){}export default 0;', 'assignment to const'],
        ])) { assertEq(assertError(parse('')(source)).message, expected, source) }
        for (const source of [
            'for(let i=0 i<3;i+=1){}export default 0;',
            'for(let i=0;i<3 i+=1){}export default 0;',
            'for(let i=0;i<3;i+=1;){}export default 0;',
            'for(let i=0;i<3;i+=1)i+=1;export default 0;',
            'for(const i=0;i<3;i++){}export default 0;',
            'for(const i of [0]){}export default 0;',
            'for(const i in {}){}export default 0;',
            'for(let i;false;){}export default 0;',
            'for(;;){return 1;}export default 0;',
            'for(;;){break label;}export default 0;',
            'for(;;){};export default 0;',
        ]) { assertError(parse('')(source)) }
    },
}
