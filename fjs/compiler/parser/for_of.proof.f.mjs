/** Declared array/string iteration preserves state, lexical exits and reached work. */

import { assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { identityAnalysis } from '../../edag/analysis/module.f.mjs'
import { memo } from '../../edag/memo/module.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'
import { stringToList } from '../../text/utf16/module.f.mjs'
import { unresolved } from '../edag/module.f.mjs'
import { parse } from '../source/module.f.mjs'
import { tokenize } from '../tokenizer/module.f.mjs'
import { parseSyntax } from './syntax/module.f.mjs'

const path = /** @type {const} */ ('/for-of.f.js')

/** @type {(source: string) => ReturnType<typeof parseSyntax>} */
const syntax = source => parseSyntax(tokenize(stringToList(source))(path))

/** @type {(source: string) => ReturnType<ReturnType<typeof memo>>} */
const outcome = source => {
    const graph = unresolved(assertOk(parse(path)(source))).edag
    return memo(assertOk(identityAnalysis(graph)))({ args: [] })
}

/** @type {(source: string) => unknown} */
const evaluated = source => assertOk(toData(assertOk(outcome(source))))

export const proof = /** @type {const} */ ({
    declaredLoopsRunInModuleFunctionAndBranchContexts: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['let sum=0;for(const item of [1,2,3]){sum+=item;}export default sum;', 6],
            ['export default (()=>{let sum=0;for(let item of [1,2]){item+=2;sum+=item;}return sum;})();', 7],
            ['export default (()=>{let sum=0;if(true){for(const item of [1,2]){sum+=item;}}return sum;})();', 3],
            ['export default (()=>{let sum=0;if(false){}else{for(const item of [1,2]){sum+=item;}sum+=4;}return sum;})();', 7],
            ['export default (()=>{let sum=0;switch(1){case 1:{for(const item of [1,2]){sum+=item;}return sum;}default:{return 0;}}})();', 3],
            ['let sum=0;while(sum<1){for(const item of [1,2]){sum+=item;}}export default sum;', 3],
            ['let sum=0;for(let i=0;i<2;i+=1){for(const item of [1,2]){sum+=item;}}export default sum;', 6],
        ]
        for (const [source, expected] of cases) {
            assertOk(syntax(source))
            assertStructurallySame(evaluated(source), { default: expected }, source)
        }
        assertStructurallySame(evaluated('let sum=0;export const before=sum;for(const item of [1,2]){sum+=item;}export const after=sum;export default [before,after];'), { before: 0, after: 3, default: [0, 3] })
    },
    aggregateStateAndLoopTransfersRetainCurrentValues: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['let sum=0;let count=0;for(const item of [1,2,3,4]){count+=1;if(item===2){continue;}sum+=item;if(item===3){break;}sum+=10;}export default [sum,count];', [14, 3]],
            ['let sum=0;for(const item of [1,2]){for(const inner of [1,2,3]){if(inner===2){continue;}sum+=item*10+inner;if(inner===3){break;}}sum+=100;}export default sum;', 268],
            ['let sum=0;for(const item of [1,2,3]){switch(item){case 1:{sum+=1;break;}case 2:{continue;}default:{sum+=3;break;}}sum+=10;}export default sum;', 24],
            ['let sum=0;for(const item of [1,2]){let i=0;while(i<2){i+=1;if(i===1){continue;}sum+=item;}}export default sum;', 3],
            ['for(const item of [1,2]){const snapshot=item;}export default 7;', 7],
            ['for(const item of []){const skipped=null.x;}export default 7;', 7],
        ]
        for (const [source, expected] of cases) {
            assertStructurallySame(evaluated(source), { default: expected }, source)
        }
        const names = Array.from({ length: 18 }, (_, index) => `state${index}`)
        const source = `${names.map(name => `let ${name}=0;`).join('')}for(const item of [1,2]){${names.map((name, index) => `${name}+=item+${index};`).join('')}}export default [${names.join(',')}];`
        assertStructurallySame(evaluated(source), { default: names.map((_, index) => 3 + 2 * index) })
    },
    sourceFunctionReturnsBypassTheNormalContinuation: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['const f=xs=>{for(const item of xs){if(item<0){return 1;}}return 2;};export default [f([]),f([0]),f([-1])];', [2, 2, 1]],
            ['export default (()=>{for(const item of [1,2,3]){if(item===2){return [true,item];}}throw 9;})();', [true, 2]],
            ['export default (()=>{while(true){for(const item of [1,2]){if(item===2){return item+5;}}throw 9;}})();', 7],
            ['export default (()=>{for(const item of [1,2]){for(const inner of [3,4]){if(inner===4){return item+inner;}}}return 0;})();', 5],
            ['export default (()=>{let sum=0;for(const item of [1,2]){const local=()=>{for(const inner of [3]){return inner;}return 0;};sum+=item+local();}return sum;})();', 9],
            ['export default (()=>{let sum=0;for(const item of [1,2]){sum+=item;break;const skipped=null.x;}return sum;})();', 1],
        ]
        for (const [source, expected] of cases) {
            assertStructurallySame(evaluated(source), { default: expected }, source)
        }
    },
    sourceEntryRunsOnceBeforeInitialStateAndDestructuring: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['let state=0;for(const item of (()=>{state+=1;return [];})()){state+=100;}export default state;', 1],
            ['let state=0;for(const item of (()=>{state+=1;return [2,3];})()){state+=item;}export default state;', 6],
            ['let sum=0;for(const [left,right] of [[1,2],[3,4]]){sum+=left+right;}export default sum;', 10],
            ['let sum=0;for(let {value:item} of [{value:1},{value:2}]){item+=2;sum+=item;}export default sum;', 7],
            ['let state=0;for(const [item=state] of [[],[]]){state+=item+1;}export default state;', 3],
            ['for(const [item=null.x] of []){}export default 7;', 7],
        ]
        for (const [source, expected] of cases) {
            assertStructurallySame(evaluated(source), { default: expected }, source)
        }
    },
    stringsUseCodePointsAndArrayItemsKeepTheirIdentity: () => {
        assertStructurallySame(evaluated('let items=[];for(const item of "a😀𝄞b"){items=[...items,item];}export default items;'), { default: ['a', '😀', '𝄞', 'b'] })
        assertStructurallySame(evaluated('let items=[];for(const item of "\\ud800x\\udc00"){items=[...items,item];}export default items;'), { default: ['\ud800', 'x', '\udc00'] })
        assertStructurallySame(evaluated('let count=0;for(const item of ""){count+=1;}export default count;'), { default: 0 })
        assertStructurallySame(evaluated('const item={};let same=false;for(const value of [item]){same=value===item;}export default same;'), { default: true })
    },
    iterationBindingsAreFreshAndRetainOrdinaryCaptureRules: () => {
        assertStructurallySame(evaluated('let reads=[];for(const item of [1,2,3]){reads=[...reads,()=>item];}export default [reads[0](),reads[1](),reads[2]()];'), { default: [1, 2, 3] })
        assertStructurallySame(evaluated('let reads=[];for(let item of [1,2]){reads=[...reads,()=>item];}export default [reads[0](),reads[1]()];'), { default: [1, 2] })
        assertStructurallySame(evaluated('let reads=[];for(let item of [1,2]){const snapshot=item;item+=10;reads=[...reads,()=>snapshot];}export default [reads[0](),reads[1]()];'), { default: [1, 2] })
        assertStructurallySame(evaluated('let item=9;let sum=0;for(const item of [1,2]){const item=7;sum+=item;}for(const item of [3]){sum+=item;}export default [item,sum];'), { default: [9, 17] })
        for (const source of [
            'for(const item of []){}export default item;',
            'const items=[1];for(const items of items){}export default 0;',
            'for(let item of [1]){const held=()=>item;item+=1;}export default 0;',
            'let state=0;for(const item of []){const held=()=>state;continue;state=1;}export default state;',
            'for(const item of []){break;const unused=missing;}export default 0;',
            'for(const item of []){continue;const duplicate=1;const duplicate=2;}export default 0;',
            'for(const item of [1]){item=2;}export default 0;',
            'for(const [item,item] of []){}export default 0;',
        ]) { assertError(parse(path)(source)) }
    },
    invalidInputsAndReachedFailuresCannotBeSkipped: () => {
        for (const operand of ['undefined', 'null', 'false', '0', '1n', '{}', '{length:1}', '(()=>0)']) {
            const source = `const f=source=>{for(const item of source){return 1;}return 2;};export default f(${operand});`
            assertOk(parse(path)(source))
            assertError(outcome(source))
        }
        for (const source of [
            'for(const item of null.x){}export default 0;',
            'for(const item of [1]){const required=null.x;break;}export default 0;',
            'let state=0;for(const item of [1]){state=null.x;state=1;continue;}export default state;',
            'for(const [item=null.x] of [[]]){}export default 0;',
            'for(const item of [1]){throw 7;}export default 0;',
            'export default (()=>{for(const item of [1]){if(item){throw 7;}}return 0;})();',
            'export default (()=>{while(true){for(const item of [1]){throw 7;}return 0;}})();',
        ]) { assertError(outcome(source)) }
        assertEq(assertError(outcome('const fail=()=>{throw 7;};for(const item of fail()){throw 8;}throw 9;')), 7)
        assertStructurallySame(evaluated('for(const item of [1]){continue;const skipped=null.x;}export default 7;'), { default: 7 })
    },
    unsupportedHeadersAndModuleReturnsRemainRefused: () => {
        for (const source of [
            'let item=0;for(item of [1]){}export default item;',
            'let item=0;for([item] of [[1]]){}export default item;',
            'let item=0;for({item} of [{item:1}]){}export default item;',
            'for(const item in {}){}export default 0;',
            'for await(const item of []){}export default 0;',
            'for(const item of [1])item;export default 0;',
            'for(const item=1 of []){}export default 0;',
            'for(const item of [1]){return item;}export default 0;',
            'export default ()=>{for(const item of []){return item;}};',
        ]) { assertError(parse(path)(source)) }
    },
    contextualOfRemainsAnOrdinaryBindingAndValue: () => {
        assertStructurallySame(evaluated(`
            const of=x=>x+1;
            const f=of=>{of+=2;return of;};
            const g=(of=3)=>of+1;
            const h=()=>{const {of}={of:7};return of;};
            export default [of(2),f(3),g(),h(),{of:9}.of];
        `), { default: [3, 5, 4, 7, 9] })
        for (const source of [
            'import {of} from "./value.f.js";export default of;',
            'import {value as of} from "./value.f.js";export default of;',
            'import {of as value} from "./value.f.js";export default value;',
            'export const of=1;',
        ]) { assertOk(parse(path)(source)) }
    },
    classicForStillAdmitsOfNamesAndItsExistingTransfers: () => {
        assertStructurallySame(evaluated(`
            const f=()=>{
                let n=0;
                for(let of=0;of<4;of+=1){if(of===1){continue;}n+=of;if(of===2){break;}}
                return n;
            };
            let of=0;
            for(;of<2;of+=1){}
            export default [f(),of];
        `), { default: [2, 2] })
        assertOk(parse(path)('export default ()=>{for(;;){return 7;}};'))
    },
})
