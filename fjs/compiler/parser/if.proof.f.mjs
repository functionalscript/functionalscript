/** Source conditionals join normal paths and preserve lexical abrupt exits. */

import { assert, assertEq, assertError, assertNotNullish, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { analysis, identityAnalysis } from '../../edag/analysis/module.f.mjs'
import { memo } from '../../edag/memo/module.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'
import { tryStringify } from '../../media/datajs/module.f.mjs'
import { normalize } from '../../js/ast/sugar/module.f.mjs'
import { unresolved } from '../edag/module.f.mjs'
import { parseFromTokens } from './module.f.mjs'
import { _evaluate, tokenizeString } from './proof.f.mjs'

/** @param {string} source */
const parsed = source => {
    const result = parseFromTokens(tokenizeString(source))
    assert(result[0] === 'ok', [source, result])
    return result[1]
}

/** @param {string} source */
const result = source => assertOk(toData(_evaluate(parsed(source))))

/** @type {(cases: readonly (readonly [string, unknown])[]) => void} */
const expectValues = cases => {
    for (const [source, expected] of cases) {
        assertStructurallySame(result(source), { default: expected }, source)
    }
}

export const proof = /** @type {const} */ ({
    normalPathsAndMissingElse: () => expectValues([
        ['const f=c=>{if(c){}return 4;};export default [f(false),f(true)];', [4, 4]],
        ['const f=a=>{if(a){const x=1;}return 2;};export default [f(false),f(true)];', [2, 2]],
        ['const f=c=>{let x=0;if(c){x=1;}return x+2;};export default [f(false),f(true)];', [2, 3]],
        ['const f=c=>{const original=[1];let value=original;if(c){const ignored=2;}return value===original;};export default [f(false),f(true)];', [true, true]],
        ['const f=c=>{let x=1;if(c){x+=2;}if(c){x*=3;}return x;};export default [f(false),f(true)];', [1, 9]],
    ]),
    explicitAlternatesAndElseIf: () => expectValues([
        ['const f=c=>{let x=0;if(c){x=1;}else{x=2;}return x+3;};export default [f(false),f(true)];', [5, 4]],
        ['const f=c=>{if(c){}else{}return 7;};export default [f(false),f(true)];', [7, 7]],
        ['const f=n=>{let x=0;if(n<0){x=1;}else if(n===0){x=2;}else{x=3;}return x;};export default [f(-1),f(0),f(1)];', [1, 2, 3]],
        ['const f=c=>{let x=0;if(c){if(c){x=5;}}else{if(!c){x=6;}}return x;};export default [f(false),f(true)];', [6, 5]],
    ]),
    multipleUpdatedBindings: () => expectValues([
        ['const f=c=>{let a=1;let b=2;if(c){a=b;b=a+1;}return [a,b];};export default [f(false),f(true)];', [[1, 2], [2, 3]]],
        ['const f=c=>{let a=1;let b=2;if(c){a=7;}else{b=8;}return [a,b];};export default [f(false),f(true)];', [[1, 8], [7, 2]]],
        ['const f=c=>{let a=[1];const original=a;let b=a;if(c){a=[2];b=a;}return [a===b,a===original,a[0]];};export default [f(false),f(true)];', [[true, true, 1], [true, false, 2]]],
    ]),
    sourceAndFastRetainOneContinuation: () => {
        const module = parsed('const f=c=>{let a=1;let b=2;if(c){a=7;b=8;}return [a,b];};export default f;')
        const declaration = module.body.statements[0]
        assert(declaration[0] === 'initialize')
        const fn = declaration[2]
        assert(fn instanceof Array && fn[0] === 'function')
        const sourceBranch = fn[1].body.statements[2]
        assert(sourceBranch[0] === 'if')
        assertEq(sourceBranch[2].exit[0], 'yield')
        assertEq(sourceBranch[3].exit[0], 'yield')
        assertEq(fn[1].body.exit[0], 'return')

        const fast = normalize(module, [])
        const definition = assertNotNullish(fast.body.statements.find(statement =>
            statement[0] === 'define' && statement[2] instanceof Array && statement[2][0] === 'function'))
        assert(definition[0] === 'define')
        const value = definition[2]
        assert(value instanceof Array && value[0] === 'function')
        const branch = assertNotNullish(value[1].body.statements.find(statement => statement[0] === 'if'))
        assert(branch[0] === 'if')
        assertEq(branch[1].length, 2)
        for (const arm of [branch[3], branch[4]]) {
            assert(arm.exit[0] === 'yield')
            assertEq(arm.exit[1].length, 2)
        }
        assertEq(value[1].body.exit[0], 'return')
    },
    conditionalReturnsSkipTheContinuation: () => expectValues([
        ['const f=(c,stop)=>{let x=0;if(c){if(stop){return 9;}x=1;}return x+2;};export default [f(false,false),f(false,true),f(true,false),f(true,true)];', [2, 2, 3, 9]],
        ['const f=c=>{let x=0;if(c){return 7;}else{x=3;}return x+1;};export default [f(false),f(true)];', [4, 7]],
        ['const f=c=>{let x=0;if(c){x=3;}else{return 7;}return x+1;};export default [f(false),f(true)];', [7, 4]],
        ['const f=c=>{if(c){const inner=n=>{if(n){return 8;}return 9;};return inner(false);}return 4;};export default [f(false),f(true)];', [4, 9]],
        ['const fail=()=>{throw 11;};const f=(a,b)=>{if(a){if(b){return 7;}}return fail();};export default f(true,true);', 7],
    ]),
    reachedBranchesAndConditions: () => expectValues([
        ['const f=c=>{let count=0;let x=0;if((()=>{count+=1;return c;})()){x=7;}return [count,x];};export default [f(false),f(true)];', [[1, 0], [1, 7]]],
        ['const f=c=>{let x=0;if(c){const unused=null.x;}return x;};export default f(false);', 0],
        ['const f=c=>{let x=0;if(c){x=1;}else if(null.x){x=2;}else{x=3;}return x;};export default f(true);', 1],
        ['const f=c=>{let x=0;if(c){throw 9;}else{x=2;}return x;};export default f(false);', 2],
    ]),
    expressionBlocksKeepNormalAndTerminalWrites: () => expectValues([
        ['const f=n=>(()=>{if(n){n+=1;}return n;})();export default [f(0),f(2)];', [0, 3]],
        ['const f=n=>(()=>{let local=0;const value=(()=>{if(n){local+=1;}return local;})();return [n,local,value];})();export default [f(0),f(2)];', [[0, 0, 0], [2, 1, 1]]],
        ['const f=n=>(()=>{if(n){if(n>1){n+=1;return n;}return 2;}n=3;return n;})();export default [f(0),f(1),f(2)];', [3, 2, 3]],
    ]),
    expressionBlocksKeepTerminatingSwitchGuards: () => expectValues([
        ['const f=n=>(()=>{if(n){switch(n){case 1:{n=10;return n;}default:{n=20;return n;}}}n=30;return n;})();export default [f(0),f(1),f(2)];', [30, 10, 20]],
        ['const f=n=>(()=>{if(n){switch(n){case 1:{n=10;return n;}}n=20;return n;}n=30;return n;})();export default [f(0),f(1),f(2)];', [30, 10, 20]],
        ['const f=n=>(()=>{if(n){if(n>1){switch(n){case 2:{n=12;return n;}default:{n=13;return n;}}}switch(n){case 1:{n=11;return n;}default:{n=14;return n;}}}n=10;return n;})();export default [f(0),f(1),f(2),f(3)];', [10, 11, 12, 13]],
    ]),
    terminatingLoopGuardsStayAbrupt: () => expectValues([
        ['const f=c=>{if(c){while(true){return 7;}}return 8;};export default [f(false),f(true)];', [8, 7]],
        ['const f=c=>{if(c){for(;;){return 7;}}return 8;};export default [f(false),f(true)];', [8, 7]],
    ]),
    normalCompoundBranchesReachTheirContinuation: () => expectValues([
        ['const f=c=>{let x=0;if(c){while(x<3){x+=1;}}return x+10;};export default [f(false),f(true)];', [10, 13]],
        ['const f=c=>{let x=0;if(c){while(true){x+=1;if(x===2){break;}}}return x+10;};export default [f(false),f(true)];', [10, 12]],
        ['const f=n=>{let x=0;if(n){switch(n){case 1:{x=4;break;}default:{return 7;}}}return x+10;};export default [f(0),f(1),f(2)];', [10, 14, 7]],
        ['const f=n=>{let x=0;if(n){switch(n){case 1:{x=4;break;}}}return x+10;};export default [f(0),f(1),f(2)];', [10, 14, 10]],
        ['const f=(a,b)=>{if(a){let x=0;if(b){x=1;}return x;}return 2;};export default [f(false,false),f(true,false),f(true,true)];', [2, 0, 1]],
        ['const f=(a,b,n)=>(()=>{if(a){if(b){n+=1;}return n;}n=2;return n;})();export default [f(false,false,0),f(true,false,0),f(true,true,0)];', [2, 0, 1]],
    ]),
    requiredEvaluationAndThrows: () => {
        const cases = /** @type {const} */ ([
            ['const fail=n=>{throw n;};const f=()=>{if(fail(11)){throw 22;}return fail(33);};export default f();', 11],
            ['const fail=n=>{throw n;};const f=()=>{const before=fail(11);if(fail(22)){}return 33;};export default f();', 11],
            ['const fail=n=>{throw n;};const f=c=>{let x=0;if(c){x=fail(17);x=1;}return x;};export default f(true);', 17],
            ['const fail=n=>{throw n;};const f=c=>{if(c){const unused=fail(19);}return 4;};export default f(true);', 19],
            ['const f=(c,stop)=>{let x=0;if(c){if(stop){throw 23;}x=1;}return x+2;};export default f(true,true);', 23],
        ])
        for (const [source, expected] of cases) {
            const evaluated = memo(assertOk(analysis(unresolved(parsed(source)).edag)))({ args: [] })
            assertEq(assertError(evaluated), expected, source)
        }
    },
    branchScopesAndSnapshots: () => expectValues([
        ['const f=c=>{const x=4;if(c){const x=8;}else{const x=9;}return x;};export default [f(false),f(true)];', [4, 4]],
        ['const f=c=>{if(c){const local=8;}else{const local=9;}const local=4;return local;};export default [f(false),f(true)];', [4, 4]],
        ['const f=c=>{let value=0;let saved=()=>-1;if(c){value=7;const snapshot=value;saved=()=>snapshot;}else{const snapshot=3;saved=()=>snapshot;}return [saved(),value];};export default [f(false),f(true)];', [[3, 0], [7, 7]]],
    ]),
    completeSourceAdmission: () => {
        const cases = /** @type {const} */ ([
            ['const f=c=>{if(c){const hidden=1;}return hidden;};export default f;', 'const not found'],
            ['const f=c=>{if(c){const hidden=1;}else{const read=hidden;}return 0;};export default f;', 'const not found'],
            ['const f=c=>{const duplicate=1;if(c){}const duplicate=2;return duplicate;};export default f;', 'duplicate id'],
            ['const f=c=>{if(c){const duplicate=1;const duplicate=2;}return 0;};export default f;', 'duplicate id'],
            ['const f=c=>{const value=1;if(c){const value=value;}return value;};export default f;', 'capture shadowed'],
            ['const f=c=>{const fixed=0;if(c){fixed=1;}return fixed;};export default f;', 'assignment to const'],
            ['const f=c=>{if(c){missing=1;}return 0;};export default f;', 'const not found'],
            ['const f=c=>{let value=0;const held=()=>value;if(c){value=1;}return held;};export default f;', 'reassigned variable captured'],
            ['const f=c=>{let value=0;if(c){value=1;}return ()=>value;};export default f;', 'reassigned variable captured'],
            ['const f=c=>{let value=0;const held=()=>value;while(false){if(c){return 0;value=1;}}return held;};export default f;', 'reassigned variable captured'],
            ['const f=c=>{while(false){if(c){return 0;const fixed=1;fixed=2;}}return 1;};export default f;', 'assignment to const'],
            ['export default n=>(()=>{if(n){if(n>1){n+=1;return n;}}return n;})();', 'reassigned variable captured'],
        ])
        for (const [source, message] of cases) {
            assertEq(assertError(parseFromTokens(tokenizeString(source))).message, message, source)
        }
    },
    ordinaryBranchesRefuseSyntaxAfterDirectExits: () => {
        const cases = /** @type {const} */ ([
            ['const f=c=>{if(c){return 0;const unreachable=1;}return 1;};export default f;', 'const unreachable'],
            ['const f=c=>{if(c){throw 0;const unreachable=1;}return 1;};export default f;', 'const unreachable'],
            ['const f=c=>{if(c){}else{return 0;const unreachable=1;}return 1;};export default f;', 'const unreachable'],
            ['const f=c=>{if(c){if(c){throw 0;const unreachable=1;}}return 1;};export default f;', 'const unreachable'],
            ['const f=c=>{let value=0;const held=()=>value;if(c){return 0;value=1;}return held;};export default f;', 'value=1'],
        ])
        for (const [source, unreachable] of cases) {
            const failure = assertError(parseFromTokens(tokenizeString(source)))
            assertEq(failure.message, 'unexpected token', source)
            assertEq(failure.metadata?.column, source.indexOf(unreachable) + 1, source)
        }
        expectValues([
            ['const f=c=>{while(c){if(c){return 7;const ignored=null.x;}break;}return 2;};export default [f(false),f(true)];', [2, 7]],
        ])
        const throwing = parsed('const f=()=>{while(true){if(true){throw 5;const ignored=null.x;}}return 0;};export default f();')
        assertEq(assertError(memo(assertOk(analysis(unresolved(throwing).edag)))({ args: [] })), 5)
    },
    transferTargetsRemainLexical: () => {
        const cases = /** @type {const} */ ([
            ['const f=c=>{if(c){break;}return 0;};export default f;', 'break'],
            ['const f=c=>{if(c){continue;}return 0;};export default f;', 'continue'],
            ['const f=c=>{while(c){const g=()=>{if(c){break;}return 0;};break;}return 0;};export default f;', 'break'],
            ['const f=c=>{if(c){switch(1){case 1:{continue;}default:{return 2;}}}return 0;};export default f;', 'continue'],
        ])
        for (const [source, keyword] of cases) {
            const failure = assertError(parseFromTokens(tokenizeString(source)))
            assertEq(failure.message, 'unexpected token', source)
            assertEq(failure.metadata?.column, source.indexOf(keyword) + 1, source)
        }
    },
    functionEndStillNeedsItsTerminator: () => {
        for (const source of [
            'export default ()=>{};',
            'export default c=>{if(c){}};',
            'export default c=>{if(c){return 1;}};',
            'export default c=>{if(c){return 1;}else{return 2;}};',
            'export default ()=>{if(true){}return;};',
        ]) { assertError(parseFromTokens(tokenizeString(source))) }
        expectValues([['const f=c=>{if(c){const unused=1;}return undefined;};export default [f(false),f(true)];', [undefined, undefined]]])
    },
    enclosingLoopsAndNestedSwitches: () => expectValues([
        ['const f=()=>{let i=0;let sum=0;while(i<5){i+=1;if(i===2){continue;}else if(i===4){break;}else{sum+=i;}}return [i,sum];};export default f();', [4, 4]],
        ['const f=c=>{let x=0;if(c){for(let i=0;i<3;i+=1){if(i===1){continue;}x+=i;}}else{x=9;}return x;};export default [f(false),f(true)];', [9, 2]],
        ['const f=c=>{let x=0;if(c){switch(1){case 1:{x=7;break;}default:{throw 9;}}}return x;};export default [f(false),f(true)];', [0, 7]],
    ]),
    graphContinuationIsShared: () => {
        const table = assertOk(identityAnalysis(unresolved(parsed('export default (a,b)=>{if(a){if(b){return 7;}}return [101];};')).edag))
        assertEq(table.exps.filter(node => node[0] === '=>').length, 1)
        const tail = table.exps.filter(node => node[0] === '[]' && node[1].length === 1 && node[1][0] === 101)
        assertEq(tail.length, 1)
        assert(table.shared.includes(table.exps.indexOf(tail[0])), 'normal predecessors share the same continuation allocation')
    },
    terminatingGuardsKeepTheirGraphSpelling: () => {
        // Exact normalized DataJS bytes preserve the legacy graph identity.
        const cases = /** @type {const} */ ([
            ['export default a=>{if(a){throw 1;}const y=[2];return y;};',
                'export default ["{}",[[":","default",["=>",1,[],["?:",["arg",0],["throw",1],["[]",[2]]]]]]];'],
            ['export default (a,b)=>{if(a){if(b){throw 1;}return 2;}return 3;};',
                'export default ["{}",[[":","default",["=>",2,[],["?:",["arg",0],["?:",["arg",1],["throw",1],2],3]]]]];'],
            ['export default n=>(()=>{if(n){switch(n){case 1:{n=10;return n;}default:{n=20;return n;}}}n=30;return n;})();',
                'const $0=["arg",0];const $1=["?:",["===",$0,1],["[]",[10,10]],["[]",[20,20]]];const $2=["?:",$0,["[]",[[".",$1,0],[".",$1,1]]],["[]",[30,30]]];export default ["{}",[[":","default",["=>",1,[],[".",["[]",[[".",$2,0],[".",$2,1]]],0]]]]];'],
            ['export default n=>(()=>{if(n){switch(n){case 1:{n=10;return n;}}n=20;return n;}n=30;return n;})();',
                'const $0=["arg",0];const $1=["?:",["===",$0,1],["[]",[10,10]],["[]",[20,20]]];const $2=["?:",$0,["[]",[[".",$1,0],[".",$1,1]]],["[]",[30,30]]];export default ["{}",[[":","default",["=>",1,[],[".",["[]",[[".",$2,0],[".",$2,1]]],0]]]]];'],
            ['export default n=>(()=>{if(n){if(n>1){switch(n){case 2:{n=12;return n;}default:{n=13;return n;}}}switch(n){case 1:{n=11;return n;}default:{n=14;return n;}}}n=10;return n;})();',
                'const $0=["arg",0];const $1=["?:",["===",$0,2],["[]",[12,12]],["[]",[13,13]]];const $2=["?:",["===",$0,1],["[]",[11,11]],["[]",[14,14]]];const $3=["?:",[">",$0,1],["[]",[[".",$1,0],[".",$1,1]]],["[]",[[".",$2,0],[".",$2,1]]]];const $4=["?:",$0,["[]",[[".",$3,0],[".",$3,1]]],["[]",[10,10]]];export default ["{}",[[":","default",["=>",1,[],[".",["[]",[[".",$4,0],[".",$4,1]]],0]]]]];'],
            ['export default c=>{if(c){while(true){return 7;}}return 8;};',
                'const $0=[".",["()",["=>",1,[],["[]",[["[]",["return",7]]]]],[["[]",[]]]],0];export default ["{}",[[":","default",["=>",1,[],["?:",["arg",0],["?:",["===",[".",$0,0],"return"],[".",$0,1],["throw","a terminal loop completed normally"]],8]]]]];'],
            ['export default c=>{if(c){for(;;){return 7;}}return 8;};',
                'const $0=[".",["()",["=>",1,[],["[]",[["[]",["return",7]]]]],[["[]",[]]]],0];export default ["{}",[[":","default",["=>",1,[],["?:",["arg",0],["?:",["===",[".",$0,0],"return"],[".",$0,1],["throw","a terminal loop completed normally"]],8]]]]];'],
        ])
        for (const [source, expected] of cases) {
            assertEq(assertOk(tryStringify(unresolved(parsed(source)).edag)), expected, source)
        }
    },
    sequentialJoinsDoNotMultiplyTheGraph: () => {
        /** @param {number} count */
        const size = count => {
            const branches = Array.from({ length: count }, (_, index) => `if(a){if(b){return ${index};}}`).join('')
            const graph = unresolved(parsed(`export default (a,b)=>{${branches}return [101];};`)).edag
            return assertOk(identityAnalysis(graph)).nodes.length
        }
        assert(size(8) < 3 * size(4), 'doubling sequential conditionals keeps graph growth linear')
    },
})
