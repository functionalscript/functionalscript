/**
 * Plain loops use admitted source while statements; other tail loops retain
 * recursive spelling. Both paths preserve execution and stable round trips.
 *
 * @import { Block, Function as FastFunction, Loop, Value } from '../../../../js/ast/types.ts'
 * @import { Exp } from '../../../types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../../asserts/module.f.js'
import { parse } from '../../../../compiler/transpiler/module.f.mjs'
import { _defaultExport, unresolved } from '../../../../compiler/edag/module.f.mjs'
import { tryStringify } from '../../../../compiler/serializer/module.f.mjs'
import { fromAnalysis, toFast } from '../../module.f.mjs'
import { fromFast } from '../../../from_fast/module.f.mjs'
import { identityAnalysis } from '../../../analysis/module.f.mjs'
import { evaluate, failure } from '../../../from_fast/member_returns/proof.f.mjs'
import { _tailFunction } from '../../tail_calls/proof.f.mjs'
import { _sourceLoops } from './module.f.mjs'

/** @type {(source: string) => Exp} */
const graph = source => _defaultExport(unresolved(assertOk(parse('/tail.f.js')(source))).edag)

/** @type {(value: Value) => Block} */
const yielded = value => ({ statements: [], exit: ['yield', [value]] })

const counter = /** @type {Exp} */ (['=>', 2, [], ['?:', ['>', ['arg', 0], 0], ['()', ['self'], [['-', ['arg', 0], 1], ['+', ['arg', 1], 1]]], ['arg', 1]]])

export const proof = /** @type {const} */ ({
    nestedSourceLoopsRetainResultsAndStableSpelling: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['export default (()=>{let i=0;let sum=0;while(i<3){let j=0;while(j<2){sum=sum+i+j;j=j+1;}i=i+1;}return [i,sum];})();', [3, 9]],
            ['export default (()=>{let i=0;let sum=0;while(i<3){let j=0;while(j<2){if(j===0){sum=sum+i;}else{sum=sum+10;}j=j+1;}i=i+1;}return [i,sum];})();', [3, 33]],
            ['export default (()=>{let i=0;let sum=0;while(i<3){let j=0;while(j<1){i=i+1;j=j+1;}sum=sum+i;}return [i,sum];})();', [3, 6]],
            ['export default (()=>{let i=0;let sum=0;while(i<3){if(i<1){let j=0;while(j<2){sum=sum+1;j=j+1;}}else{let j=0;while(j<3){sum=sum+10;j=j+1;}}i=i+1;}return [i,sum];})();', [3, 62]],
            ['export default (()=>{let i=0;let sum=0;while(i<2){let j=0;while(j<2){sum=sum+1;j=j+1;}while(j>0){sum=sum+10;j=j-1;}i=i+1;}return [i,sum];})();', [2, 44]],
            ['export default (()=>{let i=0;let sum=0;while(i<2){let j=0;while(j<2){let k=0;while(k<2){sum=sum+1;k=k+1;}j=j+1;}i=i+1;}return [i,sum];})();', [2, 8]],
            ['export default (()=>{let i=0;let sum=0;while(i<3){let j=0;while(j<2){const i=7;sum=sum+i;j=j+1;}i=i+1;}return [i,sum];})();', [3, 42]],
            ['export default (()=>{let i=0;let saved=null;while(i<2){let j=0;while(j<2){const snapshot=[i,j];saved=()=>snapshot;j=j+1;}i=i+1;}return [saved(),saved()===saved()];})();', [[1, 1], true]],
            ['export default (()=>{let i=0;let old=null;let current=null;while(i<2){let j=0;while(j<1){old=current;current=[i];j=j+1;}i=i+1;}return [old,current,old===current];})();', [[0], [1], false]],
            ['export default (()=>{while(false){while(null.x){const skipped=null.y;}}return 7;})();', 7],
            ['export default (()=>{let i=0;while(i<2){while(false){const skipped=null.x;}i=i+1;}return i;})();', 2],
            ['export default (()=>{let i=0;let sum=0;while(i<3){if(i===0){let j=0;while(j<2){sum=sum+1;j=j+1;}}else if(i===1){let j=0;while(j<3){sum=sum+10;j=j+1;}}else{sum=sum+100;}i=i+1;}return [i,sum];})();', [3, 132]],
        ]
        for (const [source, expected] of cases) {
            const original = graph(source)
            assertStructurallySame(evaluate(original), expected, source)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            assert(!first.includes(':while('), first)
            const normalized = graph(first)
            assertStructurallySame(evaluate(normalized), expected, first)
            const canonical = assertOk(tryStringify(normalized))
            const restored = graph(canonical)
            assertStructurallySame(assertOk(identityAnalysis(restored)), assertOk(identityAnalysis(normalized)), source)
            assertEq(assertOk(tryStringify(restored)), canonical, source)
            assertStructurallySame(evaluate(restored), expected, canonical)
        }
    },
    nestedSourceLoopsKeepRequiredFailuresSelected: () => {
        /** @type {readonly string[]} */
        const sources = [
            'export default (()=>{let i=0;while(i<1){while(null.x){}i=i+1;}return i;})();',
            'export default (()=>{let i=0;while(i<1){while(true){const required=null.x;}i=i+1;}return i;})();',
            'export default (()=>{let i=0;while(i<1){let j=null.x;while(false){j=1;}i=i+1;}return i;})();',
            'export default (()=>{let i=0;while(i<1){let j=0;while(j<1){j=null.x;j=1;}i=i+1;}return i;})();',
            'export default (()=>{let i=0;while(i<1){if(false){}else{while(true){const required=null.x;}}i=i+1;}return i;})();',
        ]
        for (const source of sources) {
            const original = graph(source)
            failure(original)
            const first = assertOk(tryStringify(original))
            failure(graph(first))
            const canonical = assertOk(tryStringify(graph(first)))
            failure(graph(canonical))
            assertEq(assertOk(tryStringify(graph(canonical))), canonical)
        }
    },
    nestedSourceLoopHasAPinnedWhileSpelling: () => {
        const original = graph('export default ()=>{let i=0;while(i<2){let j=0;while(j<2){j=j+1;}i=i+1;}return i;};')
        assertEq(assertOk(tryStringify(original)), 'export default ()=>{const $0=($1)=>{let $2=$1;while((()=>{const $3=$2;const $4=$3[0];return $4<2;})()){const $5=$2;const $6=($7)=>{let $8=$7;while((()=>{const $9=$8;return $9<2;})()){const $10=$8;const $11=$10+1;$8=$11;}return $8;};const $12=$6(0);const $4=$5[0];const $13=[$4+1];$2=$13;}const $14=(()=>{const $15=$2;const $4=$15[0];return [$4];})();return $14;};return $0([0])[0];};')
    },
    nestedSelectedFailuresHaveAStableSourceGraph: () => {
        /** @type {readonly string[]} */
        const guards = [
            'if(i>0&&j===1){const bad=null.x;}',
            'if(i>0?j===1:false){const bad=null.x;}',
            'if(i>0){if(j===1){const bad=null.x;}}',
        ]
        for (const guard of guards) {
            const original = graph(`export default n=>{let i=0;let sum=0;while(i<n){let j=0;while(j<2){${guard}sum=sum+1;j=j+1;}i=i+1;}return [i,sum];};`)
            assertStructurallySame(evaluate(['()', original, [0]]), [0, 0])
            assertStructurallySame(evaluate(['()', original, [1]]), [1, 2])
            failure(['()', original, [2]])
            const first = assertOk(tryStringify(original))
            const normalized = graph(first)
            const canonical = assertOk(tryStringify(normalized))
            const restored = graph(canonical)
            assertStructurallySame(assertOk(identityAnalysis(restored)), assertOk(identityAnalysis(normalized)))
            assertEq(assertOk(tryStringify(restored)), canonical)
            assertStructurallySame(evaluate(['()', restored, [1]]), [1, 2])
            failure(['()', restored, [2]])
        }
    },
    alternativeSourceBodiesRetainValuesAndStableSpelling: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['export default (()=>{let i=0;let sum=0;while(i<4){if(i<2){sum=sum+i;}else{sum=sum+10;}i=i+1;}return [i,sum];})();', [4, 21]],
            ['export default (()=>{let i=0;let a=1;let b=2;while(i<4){if(i<2){a=a+i;}else{b=b+i;}i=i+1;}return [i,a,b];})();', [4, 2, 7]],
            ['export default (()=>{let i=0;let sum=0;while(i<3){let local=1;if(i<2){local=local+2;}else{local=local+4;}sum=sum+local;i=i+1;}return [i,sum];})();', [3, 11]],
            ['export default (()=>{let i=0;let sum=0;while(i<4){if(i===0){sum=sum+1;}else if(i===1){sum=sum+2;}else if(i===2){sum=sum+4;}else{sum=sum+8;}i=i+1;}return [i,sum];})();', [4, 15]],
            ['export default (()=>{let i=0;let sum=0;while(i<4){if(i===0){sum=sum+1;}else if(i===1){sum=sum+2;}i=i+1;}return [i,sum];})();', [4, 3]],
            ['export default (()=>{let i=0;let sum=0;while(i<2){if(i<2){sum=sum+1;}else if(null.x){sum=99;}else{sum=100;}i=i+1;}return [i,sum];})();', [2, 2]],
            ['export default (()=>{let i=0;let sum=0;while(i<3){if(false){const skipped=null.x;}else if(i<2){sum=sum+i;}else{sum=sum+10;}i=i+1;}return [i,sum];})();', [3, 11]],
            ['export default (()=>{let i=0;let sum=0;while(i<3){if(i<2){if(i===0){sum=sum+1;}else{sum=sum+2;}}else{if(i===2){sum=sum+4;}else{const skipped=null.x;}}i=i+1;}return [i,sum];})();', [3, 7]],
            ['export default (()=>{let i=0;let sum=0;while(i<3){if(i<2){const local=i+1;sum=sum+local;}else{let local=i+10;local=local+1;sum=sum+local;}i=i+1;}return [i,sum];})();', [3, 16]],
            ['export default (()=>{let i=0;let a=null;let b=null;while(i<2){if(i<1){const shared=[i];a=shared;b=shared;}else{const shared=[i+10];a=shared;b=shared;}i=i+1;}return [a===b,a];})();', [true, [11]]],
            ['export default (()=>{let i=0;let saved=null;while(i<2){if(i<1){const snapshot=i;saved=()=>snapshot;}else{const snapshot=i+10;saved=()=>snapshot;}i=i+1;}return saved();})();', 11],
            ['export default (()=>{let i=0;while(i<2){if(false){}else{}i=i+1;}return i;})();', 2],
            ['export default (()=>{while(false){if(null.x){}else if(null.y){}else{const skipped=null.z;}}return 7;})();', 7],
        ]
        for (const [source, expected] of cases) {
            const original = graph(source)
            assertStructurallySame(evaluate(original), expected, source)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            assert(!first.includes(':while('), first)
            const normalized = graph(first)
            assertStructurallySame(evaluate(normalized), expected, first)
            const canonical = assertOk(tryStringify(normalized))
            const restored = graph(canonical)
            assertStructurallySame(assertOk(identityAnalysis(restored)), assertOk(identityAnalysis(normalized)), source)
            assertEq(assertOk(tryStringify(restored)), canonical, source)
            assertStructurallySame(evaluate(restored), expected, canonical)
        }
    },
    alternativeSourceBodiesKeepRequiredFailuresSelected: () => {
        /** @type {readonly string[]} */
        const sources = [
            'export default (()=>{let i=0;while(i<1){if(true){const required=null.x;}else{i=10;}i=i+1;}return i;})();',
            'export default (()=>{let i=0;while(i<1){if(false){i=10;}else{const required=null.x;}i=i+1;}return i;})();',
            'export default (()=>{let i=0;while(i<1){if(false){}else if(null.x){i=10;}else{i=20;}i=i+1;}return i;})();',
            'export default (()=>{let i=0;let sum=0;while(i<1){if(false){sum=7;}else{sum=null.x;sum=1;}i=i+1;}return [i,sum];})();',
            'export default (()=>{let i=0;while(i<1){if(false){}else if(true){if(false){}else{const required=null.x;}}else{}i=i+1;}return i;})();',
        ]
        for (const source of sources) {
            const original = graph(source)
            failure(original)
            const first = assertOk(tryStringify(original))
            failure(graph(first))
            const canonical = assertOk(tryStringify(graph(first)))
            failure(graph(canonical))
            assertEq(assertOk(tryStringify(graph(canonical))), canonical)
        }
    },
    alternativeSourceBodyHasAPinnedWhileSpelling: () => {
        const original = graph('export default ()=>{let i=0;while(i<4){if(i<2){i=i+1;}else{i=i+2;}}return i;};')
        assertEq(assertOk(tryStringify(original)), 'export default ()=>{const $0=($1)=>{let $2=$1;while((()=>{const $3=$2;const $4=$3[0];return $4<4;})()){const $5=$2;const $4=$5[0];const $6=[$4<2?$4+1:$4+2];$2=$6;}const $7=(()=>{const $8=$2;const $4=$8[0];return [$4];})();return $7;};return $0([0])[0];};')
    },
    conditionalSourceBodiesRetainValuesAndStableSpelling: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['export default (()=>{let i=0;let sum=0;while(i<7){if(i>3){sum=sum+i;}i=i+1;}return [i,sum];})();', [7, 15]],
            ['export default (()=>{let i=0;let sum=0;while(i<3){if(i<2){sum=sum+i;}if(sum>0){sum=sum+10;}i=i+1;}return [i,sum];})();', [3, 21]],
            ['export default (()=>{let i=0;let sum=0;while(i<3){let local=1;if(i>0){local=local+2;}sum=sum+local;i=i+1;}return [i,sum];})();', [3, 7]],
            ['export default (()=>{let i=0;let sum=0;while(i<4){if(i>0){if(i<3){sum=sum+i;}}i=i+1;}return [i,sum];})();', [4, 3]],
            ['export default (()=>{let i=0;let sum=0;while(i<3){if(i<2){let sum=10;sum=sum+1;const own=sum;}sum=sum+1;i=i+1;}return [i,sum];})();', [3, 3]],
            ['export default (()=>{let i=0;let a=1;let b=2;while(i<3){if(i<2){const old=a;a=b;b=old;}i=i+1;}return [i,a,b];})();', [3, 1, 2]],
            ['export default (()=>{let i=0;let saved=null;while(i<3){if(i>0){const snapshot=i;saved=()=>snapshot;}i=i+1;}return saved();})();', 2],
            ['export default (()=>{let i=0;let a=null;let b=null;while(i<2){if(i<2){const shared=[i];a=shared;b=shared;}i=i+1;}return [a===b,a];})();', [true, [1]]],
            ['export default (()=>{let i=0;let sum=0;while(i<3){if((()=>{const pair=[i];return pair===pair?i<2:false;})()){sum=sum+i;}i=i+1;}return [i,sum];})();', [3, 1]],
            ['export default (()=>{let i=0;while(i<2){if(false){const skipped=null.x;}i=i+1;}return i;})();', 2],
            ['export default (()=>{while(false){if(true){const skipped=null.x;}}return 7;})();', 7],
        ]
        for (const [source, expected] of cases) {
            const original = graph(source)
            assertStructurallySame(evaluate(original), expected, source)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            assert(!first.includes(':while('), first)
            const normalized = graph(first)
            assertStructurallySame(evaluate(normalized), expected, first)
            const canonical = assertOk(tryStringify(normalized))
            const restored = graph(canonical)
            assertStructurallySame(assertOk(identityAnalysis(restored)), assertOk(identityAnalysis(normalized)), source)
            assertEq(assertOk(tryStringify(restored)), canonical, source)
            assertStructurallySame(evaluate(restored), expected, canonical)
        }
    },
    conditionalSourceBodiesKeepRequiredFailuresSelected: () => {
        /** @type {readonly string[]} */
        const sources = [
            'export default (()=>{let i=0;while(i<1){if(null.x){i=1;}i=i+1;}return i;})();',
            'export default (()=>{let i=0;while(i<1){if(true){const required=null.x;}i=i+1;}return i;})();',
            'export default (()=>{let i=0;let sum=0;while(i<1){if(true){sum=null.x;sum=1;}i=i+1;}return [i,sum];})();',
            'export default (()=>{let i=0;while(i<1){if(true){if(true){const required=null.x;}}i=i+1;}return i;})();',
        ]
        for (const source of sources) {
            const original = graph(source)
            failure(original)
            const first = assertOk(tryStringify(original))
            failure(graph(first))
            const canonical = assertOk(tryStringify(graph(first)))
            failure(graph(canonical))
            assertEq(assertOk(tryStringify(graph(canonical))), canonical)
        }
    },
    conditionalSourceBodyHasAPinnedWhileSpelling: () => {
        const original = graph('export default ()=>{let i=0;while(i<4){if(i<2){i=i+1;}i=i+1;}return i;};')
        // The next-state array demands the update directly, so no separate
        // arithmetic anchor or temporary is required after the conditional.
        assertEq(assertOk(tryStringify(original)), 'export default ()=>{const $0=($1)=>{let $2=$1;while((()=>{const $3=$2;const $4=$3[0];return $4<4;})()){const $5=$2;const $4=$5[0];const $6=$4<2?$4+1:$4;const $7=[$6+1];$2=$7;}const $8=(()=>{const $9=$2;const $4=$9[0];return [$4];})();return $8;};return $0([0])[0];};')
    },
    aggregateSourceWhileHasAStableNormalForm: () => {
        for (const source of /** @type {const} */ ([
            'export default (n=>{let i=0;let sum=0;while(i<n){sum=sum+i;i=i+1;}return [i,sum];})(5);',
            'export default (()=>{let i=0;let a=1;let b=2;while(i<3){const old=a;a=b;b=old;i=i+1;}return [i,a,b];})();',
            'export default (()=>{while(false){const skipped=null.x;}return 7;})();',
            'export default (()=>{let i=0;let sum=0;while(i<2){sum=sum+i;i=i+1;}while(sum<4){i=i+1;sum=sum+2;}return [i,sum];})();',
            'export default (()=>{let i=0;let saved=null;while(i<3){const snapshot=i;saved=()=>snapshot;i=i+1;}return saved();})();',
            'export default (()=>{let i=0;let sum=0;while(i<3&&(false?null.x:true)){sum=sum+i;i=i+1;}return [i,sum];})();',
            'export default (()=>{let i=0;let sum=0;while((()=>{const pair=[i,sum];return pair===pair?pair[0]<3:false;})()){sum=sum+i;i=i+1;}return [i,sum];})();',
        ])) {
            const original = graph(source)
            const first = assertOk(tryStringify(original))
            assert(first.includes('while('), first)
            assert(!first.includes(':while('), first)
            const normalized = graph(first)
            assertStructurallySame(evaluate(normalized), evaluate(original))
            const canonical = assertOk(tryStringify(normalized))
            assert(canonical.includes('while('), canonical)
            const restored = graph(canonical)
            assertStructurallySame(assertOk(identityAnalysis(restored)), assertOk(identityAnalysis(normalized)))
            assertEq(assertOk(tryStringify(restored)), canonical)
        }
    },
    plainSourceLoopsPreserveRequiredFailuresAndFinalCaptures: () => {
        for (const source of /** @type {const} */ ([
            'export default (()=>{while(null.x){}return 7;})();',
            'export default (()=>{while(true){const required=null.x;}return 7;})();',
            'export default (()=>{let i=0;let sum=0;while(i<1){sum=null.x;sum=1;i=i+1;}return [i,sum];})();',
            'export default (()=>{let limit=null.x;limit=limit;let i=0;while(i<0){const unused=limit;i=i+1;}return i;})();',
        ])) {
            const original = graph(source)
            const written = assertOk(tryStringify(original))
            failure(original)
            failure(graph(written))
        }
        const original = graph('const f=n=>n>0?f(n-1):()=>n;export default f(2)();')
        const written = assertOk(tryStringify(original))
        assert(written.includes('while('), written)
        assertEq(evaluate(graph(written)), 0)
        const canonical = assertOk(tryStringify(graph(written)))
        assertEq(assertOk(tryStringify(graph(canonical))), canonical)
    },
    recursiveSourceRoundTrips: () => {
        const sources = /** @type {const} */ ([
            'const f=(n,a)=>n===0?a:f(n-1,a+n);export default f(4,0);',
            'const f=n=>n===0?({done:true}):f(n-1);export default f(3);',
            'const f=(n,a,b)=>n===0?[a,b]:f(n-1,b,a);export default f(3,1,2);',
            'const f=(n,saved)=>n===0?saved:f(n-1,()=>n);export default f(2,null)();',
            'const f=(n,a)=>n>0?(n%2===0?f(n-2,a+2):f(n-1,a+1)):a;export default f(7,0);',
            'const f=(n,a)=>{const x=[n];return n===0?[a,x]:f(n-1,a+1)};export default f(3,0);',
            'const f=(n,a)=>n===0?a:f(n-1);export default f(3,9);',
            'const f=(n,a,b)=>n===0?[a,b]:f(n-1,b,a,[n]);export default f(3,1,2);',
            'const f=(n,saved)=>n===0?saved:f(n-1,()=>n,7);export default f(2,null)();',
            'const f=(n,a)=>n===0?a:f(...[n-1,a+1]);export default f(3,0);',
            'const f=(n,a,b)=>n===0?[a,b]:f(n-1,...[b],...[],a);export default f(3,1,2);',
            'const f=(n,saved)=>n===0?saved:f(...[n-1,()=>n]);export default f(2,null)();',
            'const f=(n,a,b)=>n===0?[a,b]:f(0,..."A𝄞",99);export default f(1);',
            'const f=(n,previous,...xs)=>n===0?[previous===xs,xs===xs,xs]:f(n-1,xs,...xs);export default f(3,null,7,8);',
            'const f=(n,saved,...xs)=>n===0?saved:f(n-1,()=>xs,n);export default f(3,null,9)();',
            'const f=(...xs)=>xs[0]===0?xs:f(xs[0]-1,xs[1]+1);export default f(3,0);',
            'const f=(n,previous,value=[])=>n===0?[previous===value,value===value]:f(n-1,value);export default f(3,null);',
            'const f=(n,{value}={value:0})=>n===0?value:f(n-1,{value:value+1});export default f(3);',
        ])
        for (const source of sources) {
            const original = graph(source)
            const first = assertOk(tryStringify(original))
            const restored = graph(first)
            assertStructurallySame(evaluate(restored), evaluate(original))
            const second = assertOk(tryStringify(restored))
            assertEq(assertOk(tryStringify(graph(second))), second)
            assert(!first.includes(':while(true)'), first)
        }
    },
    invocationSourceSetupHasAStableCanonicalSpelling: () => {
        for (const source of /** @type {const} */ ([
            'const f=n=>n>0?f(n-1,null.x):7;export default f;',
            'const f=n=>n>0?f(0,...null):7;export default f;',
            'const f=n=>n>0?f(...[0,null.x]):7;export default f;',
            'const f=(n,value=null.x)=>n>0?f(n-1):7;export default f;',
        ])) {
            const original = graph(source)
            const first = assertOk(tryStringify(original))
            const restored = graph(first)
            assertEq(evaluate(['()', original, [0, 9]]), 7)
            assertEq(evaluate(['()', restored, [0, 9]]), 7)
            failure(['()', original, [1, 9]])
            failure(['()', restored, [1, 9]])
            const canonical = assertOk(tryStringify(restored))
            // Physical while output separates its normal result from the loop.
            // Parsing that first spelling establishes the source normal form.
            const converted = assertOk(tryStringify(fromFast(assertOk(toFast(original)))))
            assertEq(assertOk(tryStringify(graph(converted))), canonical)
            assertEq(assertOk(tryStringify(graph(canonical))), canonical)
        }
    },
    commonPlacementAndScalarSpellingStayIntact: () => {
        const ordinary = /** @type {Block} */ (yielded(['+', 1, 2]))
        assertEq(_sourceLoops(ordinary), ordinary)
        const scalar = /** @type {Exp} */ (['=>', 1, [], ['?:', ['<', ['arg', 0], 3], ['()', ['self'], [['+', ['arg', 0], 1]]], ['arg', 0]]])
        const placed = fromAnalysis(assertOk(identityAnalysis(scalar)))
        assertEq(_sourceLoops(placed), placed)
        assert(assertOk(tryStringify(['()', scalar, [0]])).includes('while('))
        const binding = /** @type {const} */ ({ index: 0 })
        const plain = /** @type {Block} */ ({ statements: [['block', [], yielded(1)], ['define', binding, 1, 'required']],
            exit: ['yield', [['if', true, yielded(1), yielded(2)]]] })
        assertEq(_sourceLoops(plain), plain)
    },
    emptyAndThrowingInvocationRoots: () => {
        const empty = _tailFunction(['=>', 0, [], ['()', ['self'], []]])
        assert(_sourceLoops(yielded(['function', empty])).exit[0] === 'yield')
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const output = /** @type {const} */ ({ index: 0 })
        const throwing = /** @type {FastFunction} */ ({ ...empty, body: {
            statements: [['loop', { target, parameters: [], initial: [], results: [output], body: { statements: [], exit: ['throw', 'stopped'] } }]],
            exit: ['return', empty.target, ['ref', output]],
        } })
        const converted = _sourceLoops(yielded(['function', throwing]))
        assert(converted.exit[0] === 'yield')
        const value = converted.exit[1][0]
        assert(value instanceof Array && value[0] === 'function')
        assertEq(value[1].body.exit[0], 'throw')
        const original = graph('const f=n=>n>0?f(n-1):(()=>{throw 1})();export default f(3);')
        const written = assertOk(tryStringify(original))
        failure(original)
        failure(graph(written))
        const extra = graph('const f=n=>n===0?0:f(n-1,(()=>{throw 7})());export default f(1);')
        failure(extra)
        failure(graph(assertOk(tryStringify(extra))))
        const prefixed = /** @type {Exp} */ (['=>', 0, [], [',', [['throw', 1], 0]]])
        const restored = graph(assertOk(tryStringify(prefixed)))
        failure(['()', prefixed, []])
        failure(['()', restored, []])
    },
    nestedSourceValuesRetainTheirExecutionRegions: () => {
        const fn = _tailFunction(counter)
        const inner = /** @type {Value} */ (['function', fn])
        const binding = /** @type {const} */ ({ index: 0 })
        const parameter = /** @type {const} */ ({ index: 0 })
        const output = /** @type {const} */ ({ index: 0 })
        const target = /** @type {const} */ ({ kind: 'loop', index: 0 })
        const owner = /** @type {const} */ ({ kind: 'function', index: 0 })
        const own = /** @type {FastFunction} */ ({ ...fn, target: owner, parameters: [], self: null,
            body: { statements: [], exit: ['return', owner, inner] }, captures: [{ binding, value: inner }] })
        const loop = /** @type {Loop} */ ({ target, parameters: [parameter], initial: [inner], results: [output], body: { statements: [], exit: ['break', target, [inner]] } })
        const statements = /** @type {Block['statements']} */ ([
            ['define', binding, inner, 'required'], ['block', [], yielded(inner)],
            ['if', [], inner, yielded(inner), yielded(inner)], ['loop', loop],
        ])
        const values = /** @type {readonly Value[]} */ ([
            inner, ['block', yielded(inner)], ['if', inner, yielded(inner), yielded(inner)], ['function', own], ['array', [inner]],
        ])
        for (const value of values) {
            const source = /** @type {Block} */ ({ statements, exit: ['yield', [value]] })
            assert(_sourceLoops(source) !== source)
        }
        for (const exit of /** @type {readonly Block['exit'][]} */ ([['throw', inner], ['continue', target, [inner]], ['return', fn.target, inner]])) {
            const source = /** @type {Block} */ ({ statements: [], exit })
            assert(_sourceLoops(source) !== source)
        }
    },
    deepValuesRetainIdentity: () => {
        /** @type {Value} */
        let value = 1
        for (let depth = 0; depth < 20_000; ++depth) { value = ['~', value] }
        const source = yielded(value)
        assertEq(_sourceLoops(source), source)
    },
})
