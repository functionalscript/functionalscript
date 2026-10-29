/**
 * Expression-block writes survive graph construction and source serialization.
 * Every fixture checks the real front end and graph interpreter. Supported
 * source outputs retain values and observable sharing across repeated reads;
 * graph forms outside the source writer profile assert their exact refusal.
 *
 * @import { Exp } from '../../edag/types.ts'
 * @import { ValueResult } from '../../edag/value/control/types.ts'
 * @import { Block as PreparedBlock } from '../../js/ast/prepare/types.ts'
 */

import { assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { identityAnalysis } from '../../edag/analysis/module.f.mjs'
import { invoke, memo } from '../../edag/memo/module.f.mjs'
import { call } from '../../edag/value/call/module.f.mjs'
import { read } from '../../edag/value/property/module.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'
import { stringify } from '../../js/ast/serializer/module.f.mjs'
import { ok } from '../../types/result/module.f.js'
import { unresolved } from '../edag/module.f.mjs'
import { parse } from '../source/module.f.mjs'
import { tryModuleStringify } from './module.f.mjs'

/** @type {(source: string) => Exp} */
const graph = source => unresolved(assertOk(parse('/block-assignments.f.js')(source))).edag

/** @type {(root: Exp) => ValueResult} */
const evaluate = root => memo(assertOk(identityAnalysis(root)))({ args: [] })

/** Supported source spelling stabilizes; other graph forms retain their explicit refusal. @type {(source: string, expected: unknown, refusal?: string, refusalRound?: number) => void} */
const sourceResult = (source, expected, refusal, refusalRound = 0) => {
    let current = graph(source)
    let previous = ''
    for (let round = 0; round < 3; round = round + 1) {
        assertStructurallySame(assertOk(toData(assertOk(evaluate(current)))), { default: expected }, source)
        const written = tryModuleStringify(current)
        if (refusal !== undefined && round === refusalRound) { assertEq(assertError(written), refusal, source); return }
        const text = assertOk(written)
        if (round === 2) { assertEq(text, previous, source) }
        current = graph(text)
        previous = text
    }
    assertStructurallySame(assertOk(toData(assertOk(evaluate(current)))), { default: expected }, previous)
}

export const proof = {
    generatedBlockAssignmentsAreFunctionalScript: () => {
        const outer = { index: 0 }
        /** @type {PreparedBlock} */
        const prepared = {
            statements: [['slot', outer, 0, true]],
            exit: ['yield', [['array', [
                ['ref', outer],
                ['block', {
                    statements: [['write', outer, ['+', ['ref', outer], 1]]],
                    exit: ['yield', [['ref', outer]]],
                }],
                ['ref', outer],
            ]]]],
        }
        const text = stringify(prepared)
        assertEq(text, 'let $0=0;export default [$0,(()=>{$0=$0+1;return $0;})(),$0];')
        sourceResult(text, [0, 1, 1])
    },
    originalParameterAssignment: () => {
        const source = 'export default n => (() => { n = n + 1; return n; })()'
        let current = graph(source)
        let previous = ''
        for (let round = 0; round < 3; round = round + 1) {
            const fn = assertOk(read(evaluate(current), 'default'))
            for (const input of [-2, 0, 4]) {
                assertEq(assertOk(call(ok(fn), [() => ok(input)], invoke)), input + 1)
            }
            // Assigning a result still evaluates it: BigInt plus Number fails.
            assertError(call(ok(fn), [() => ok(1n)], invoke))
            const text = assertOk(tryModuleStringify(current))
            if (round === 2) { assertEq(text, previous) }
            current = graph(text)
            previous = text
        }
    },
    continuationReadsLatestVersions: () => {
        /** @type {readonly (readonly [string, unknown, string?, number?])[]} */
        const cases = [
            ['export default (()=>{let n=0;const r=(()=>{n=n+1;return n;})();return [r,n];})();', [1, 1]],
            ['export default (()=>{let n=0;const r=(()=>{n=n+1;return 7;})();return [r,n];})();', [7, 1]],
            ['export default (()=>{let n=0;const r=(()=>{const first=(()=>{n=n+1;return n;})();n=n+first;return n;})();return [r,n];})();', [2, 2]],
            ['export default (()=>{let x=1;let y=2;const r=(()=>{x=y;y=x+3;return [x,y];})();return [r,x,y];})();', [[2, 5], 2, 5]],
            ['const f=(n=0,x=(()=>{n=n+1;return n;})())=>[n,x];export default f();', [1, 1]],
        ]
        for (const [source, expected, refusal, refusalRound] of cases) { sourceResult(source, expected, refusal, refusalRound) }
    },
    eagerOperandsKeepTheirReadOrder: () => {
        /** @type {readonly (readonly [string, unknown, string?, number?])[]} */
        const cases = [
            ['export default (()=>{let n=0;const r=[n,(()=>{n=n+1;return n;})(),n,(()=>{n=n+1;return n;})(),n];return [r,n];})();', [[0, 1, 1, 2, 2], 2]],
            ['const pair=(a,b)=>[a,b];export default (()=>{let n=0;const r=pair(n,(()=>{n=n+1;return n;})());return [r,n];})();', [[0, 1], 1]],
            ['export default (()=>{let n=2;const r=n+(()=>{n=n+3;return n;})();return [r,n];})();', [7, 5]],
            ['export default (()=>{let n=0;const r=((()=>{n=n+1;return n;})(),(()=>{n=n+1;return n;})());return [r,n];})();', [2, 2]],
            ['const take=(...args)=>args;export default (()=>{let n=0;const r=take(...[n],(()=>{n=n+1;return n;})(),...[n]);return [r,n];})();', [[0, 1, 1], 1], 'a shared node reached from outside the lazy operand that establishes it'],
            ['export default (()=>{let n=1;const r=[...(true?(()=>{n=n+1;return [n];})():[n]),n];return [r,n];})();', [[2, 2], 2], 'a shared node reached from outside the lazy operand that establishes it'],
        ]
        for (const [source, expected, refusal, refusalRound] of cases) { sourceResult(source, expected, refusal, refusalRound) }
    },
    lazyBranchesMergeOnlySelectedWrites: () => {
        /** @type {readonly (readonly [string, unknown, string?, number?])[]} */
        const cases = [
            ['export default (()=>{let n=0;const r=true?(()=>{n=n+1;return n;})():(()=>{n=n+10;return n;})();return [r,n];})();', [1, 1]],
            ['export default (()=>{let n=0;const r=false?(()=>{n=n+1;return n;})():(()=>{n=n+10;return n;})();return [r,n];})();', [10, 10]],
            ['export default (()=>{let n=0;const r=false&&(()=>{n=n+1;return n;})();return [r,n];})();', [false, 0]],
            ['export default (()=>{let n=0;const r=true&&(()=>{n=n+1;return n;})();return [r,n];})();', [1, 1]],
            ['export default (()=>{let n=0;const r=true||(()=>{n=n+1;return n;})();return [r,n];})();', [true, 0]],
            ['export default (()=>{let n=0;const r=false||(()=>{n=n+1;return n;})();return [r,n];})();', [1, 1]],
            ['export default (()=>{let n=0;const r=0??(()=>{n=n+1;return n;})();return [r,n];})();', [0, 0]],
            ['export default (()=>{let n=0;const r=null??(()=>{n=n+1;return n;})();return [r,n];})();', [1, 1]],
            ['export default (()=>{let n=0;const f=null;const r=f?.((()=>{n=n+1;return n;})());return [r===undefined,n];})();', [true, 0]],
            ['export default (()=>{let n=0;const f=x=>x;const r=f?.((()=>{n=n+1;return n;})());return [r,n];})();', [1, 1]],
        ]
        for (const [source, expected, refusal, refusalRound] of cases) { sourceResult(source, expected, refusal, refusalRound) }
    },
    memberCallsKeepTheirReceiverAndLookup: () => {
        /** @type {readonly (readonly [string, unknown, string?, number?])[]} */
        const cases = [
            ['export default (()=>{let xs=[10,20];const r=xs.at((()=>{xs=[30,40];return 1;})());return [r,xs];})();', [20, [30, 40]], 'an internal member-presence query'],
            ['export default (()=>{let n=0;const o={f:x=>x};const r=o.f((()=>{n=n+1;return n;})());return [r,n];})();', [1, 1], 'an internal member-presence query'],
            ['export default (()=>{let n=0;const o=null;const r=o?.[Number((()=>{n=n+1;return n;})())];return [r===undefined,n];})();', [true, 0]],
            ['export default (()=>{let n=0;const o=[10,20];const r=o?.[Number((()=>{n=n+1;return n;})())];return [r,n];})();', [20, 1]],
            ['export default (()=>{let n=0;const o={f:null};const r=o.f?.((()=>{n=n+1;return n;})());return [r===undefined,n];})();', [true, 0], 'an internal member-presence query'],
            ['export default (()=>{let n=0;const o={f:x=>x};const r=o.f?.((()=>{n=n+1;return n;})());return [r,n];})();', [1, 1], 'an internal member-presence query'],
            ['export default (()=>{let n=0;const o=null;const r=o?.f((()=>{n=n+1;return n;})());return [r===undefined,n];})();', [true, 0], 'an internal member-presence query'],
            ['export default (()=>{let n=0;const o={f:x=>x};const r=o?.f((()=>{n=n+1;return n;})());return [r,n];})();', [1, 1], 'an internal member-presence query'],
            ['export default (()=>{let n=1;const a=null;const r=a?.[Number((()=>{n=n+1;return n;})())]?.((()=>{n=n+10;return n;})());return [r===undefined,n];})();', [true, 1], 'an internal member-presence query'],
        ]
        for (const [source, expected, refusal, refusalRound] of cases) { sourceResult(source, expected, refusal, refusalRound) }
    },
    objectKeysAndSpreadsStayInTheirSourceOrder: () => {
        /** @type {readonly (readonly [string, unknown, string?, number?])[]} */
        const cases = [
            ['export default (()=>{let n=0;const r={[(()=>{n=n+1;return n;})()]:(()=>{n=n+1;return n;})(),[n]:n};return [r,n];})();', [{ 1: 2, 2: 2 }, 2]],
            ['export default (()=>{let n=0;const before={a:n};const r={...before,b:(()=>{n=n+1;return n;})(),...{c:n}};return [r,n];})();', [{ a: 0, b: 1, c: 1 }, 1], 'a shared node reached from outside the lazy operand that establishes it', 1],
        ]
        for (const [source, expected, refusal, refusalRound] of cases) { sourceResult(source, expected, refusal, refusalRound) }
    },
    terminalGuardsAndSwitchesUpdateTheirSelectedRegion: () => {
        /** @type {readonly (readonly [string, unknown, string?, number?])[]} */
        const cases = [
            ['const f=flag=>{let n=0;return (()=>{if(flag){n=n+1;return n;}n=n+10;return n;})();};export default [f(true),f(false)];', [1, 10]],
            ['const f=flag=>{let n=0;const r=(()=>{switch(flag){case 1:{n=n+1;return n;}default:{n=n+10;return n;}}})();return [r,n];};export default [f(1),f(2)];', [[1, 1], [10, 10]]],
            ['const f=flag=>{let n=0;const r=(()=>{if(flag){n=n+1;return n;}n=n+10;return n;})();return [r,n];};export default [f(true),f(false)];', [[1, 1], [10, 10]]],
        ]
        for (const [source, expected, refusal, refusalRound] of cases) { sourceResult(source, expected, refusal, refusalRound) }
    },
    loopTestsAndBodiesKeepTheirUpdatedState: () => {
        /** @type {readonly (readonly [string, unknown, string?, number?])[]} */
        const cases = [
            ['export default (()=>{let n=0;let total=0;while(n<3){const r=(()=>{n=n+1;return n;})();total=total+r;}return [n,total];})();', [3, 6]],
            ['export default (()=>{let n=0;let count=0;while((()=>{n=n+1;return n<3;})()){count=count+1;}return [n,count];})();', [3, 2]],
            ['export default (()=>{let n=0;let count=0;while(count<2){count=count+1;switch((()=>{n=n+1;return n;})()){case 1:{n=n+10;break;}default:{n=n+100;break;}}}return [n,count];})();', [112, 2]],
            ['export default (()=>{let n=0;let count=0;while(count<1){count=count+1;switch(1){case (()=>{n=n+1;return 1;})():{n=n+10;break;}case (()=>{n=n+100;return 2;})():{n=n+1000;break;}}}return [n,count];})();', [11, 1]],
            ['export default (()=>{let n=0;let k=0;while(k<1){k=k+1;switch(3){case (()=>{n=n+1;return 1;})():case (()=>{n=n+1;return 2;})():{n=n+10;break;}default:{n=n+100;break;}}}return [n,k];})();', [102, 1], 'a shared node reached from outside the lazy operand that establishes it'],
        ]
        for (const [source, expected, refusal, refusalRound] of cases) { sourceResult(source, expected, refusal, refusalRound) }
    },
    assignmentsRetainAllocationAndSnapshotIdentity: () => {
        /** @type {readonly (readonly [string, unknown, string?, number?])[]} */
        const cases = [
            ['export default (()=>{let n=[];const before=n;const r=(()=>{n=[1];return n;})();return [before===n,r===n,n===n,r];})();', [false, true, true, [1]]],
            ['export default (()=>{let n=[];const r=(()=>{n=[1];return [n,n];})();return [r[0]===r[1],r[0]===n,n];})();', [true, true, [1]]],
            ['export default (()=>{let n=1;const snapshot=n;const held=()=>snapshot;const r=(()=>{n=n+1;return n;})();return [held(),r,n];})();', [1, 2, 2]],
            ['export default (()=>{let n=0;const held=(()=>{n=n+1;const snapshot=n;return ()=>snapshot;})();n=n+10;return [held(),n];})();', [1, 11]],
        ]
        for (const [source, expected, refusal, refusalRound] of cases) { sourceResult(source, expected, refusal, refusalRound) }
    },
    requiredWorkAndFailureOrderSurviveOutput: () => {
        /** @type {readonly (readonly [string, unknown, string?, number?])[]} */
        const cases = [
            // Distinct thrown markers observe which required operand ran first.
            ['const fail=()=>{throw 1;};export default (()=>{let n=0;return [fail(),(()=>{n=n+1;throw 2;})()];})();', 1],
            ['const fail=()=>{throw 2;};export default (()=>{let n=0;return [(()=>{n=n+1;throw 1;})(),fail()];})();', 1],
            ['const fail=()=>{throw 1;};export default (()=>{let n=0;const r=(()=>{n=fail();n=1;return 0;})();return [r,n];})();', 1],
            ['const fail=()=>{throw 1;};export default (()=>{let n=0;const r=(()=>{n=n+1;const required=fail();return n;})();return [r,n];})();', 1],
            ['export default (()=>{let n=0;return null.f((()=>{n=n+1;throw 2;})());})();', ['undefined'], 'an internal member-presence query'],
            ['const take=(...args)=>args;export default (()=>{let n=0;return take(...null,(()=>{n=n+1;throw 2;})());})();', ['undefined']],
            ['export default (()=>{let n=0;return [...null,(()=>{n=n+1;throw 2;})()];})();', ['undefined']],
            ['const key={toString:()=>{throw 1;},valueOf:()=>0};export default (()=>{let n=0;return {[key]:(()=>{n=n+1;throw 2;})()};})();', 1],
        ]
        for (const [source, expected, refusal] of cases) {
            let current = graph(source)
            for (let round = 0; round < (refusal === undefined ? 3 : 1); round = round + 1) {
                assertStructurallySame(assertError(evaluate(current)), expected, source)
                const written = tryModuleStringify(current)
                if (refusal !== undefined) { assertEq(assertError(written), refusal, source) }
                else { current = graph(assertOk(written)) }
            }
        }
    },
}
