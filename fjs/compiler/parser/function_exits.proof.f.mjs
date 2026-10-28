/** Loop-body function exits keep their lexical owner and complete source facts. */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { analysis } from '../../edag/analysis/module.f.mjs'
import { memo } from '../../edag/memo/module.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'
import { unresolved } from '../edag/module.f.mjs'
import { parseFromTokens } from './module.f.mjs'
import { _evaluate, tokenizeString } from './proof.f.mjs'

export const proof = /** @type {const} */ ({
    sourceTargetsFollowOrdinaryFunctions: () => {
        const module = assertOk(parseFromTokens(tokenizeString('const f=n=>{while(n){if(n){return n;throw n;}else{throw n;return n;}while(false){return 3;}const g=()=>{while(false){return 4;}return 5;};return g();}return 6;};export default f;')))
        const declaration = module.body.statements[0]
        assert(declaration[0] === 'initialize')
        const fn = declaration[2]
        assert(fn instanceof Array && fn[0] === 'function')
        const outer = fn[1].body.statements[0]
        assert(outer[0] === 'while')
        const branch = outer[1].body.statements[0]
        assert(branch[0] === 'if')
        for (const arm of [branch[2], branch[3]]) {
            assertStructurallySame(arm.statements.map(statement => statement[0]).toSorted(), ['return', 'throw'])
            const statement = arm.statements.find(statement => statement[0] === 'return')
            assert(statement?.[0] === 'return')
            assertEq(statement[1], fn[1].target)
        }
        const inner = outer[1].body.statements[1]
        assert(inner[0] === 'while')
        const returned = inner[1].body.statements[0]
        assert(returned[0] === 'return')
        assertEq(returned[1], fn[1].target)
        const nestedDeclaration = outer[1].body.statements[2]
        assert(nestedDeclaration[0] === 'initialize')
        const nested = nestedDeclaration[2]
        assert(nested instanceof Array && nested[0] === 'function')
        assert(nested[1].target !== fn[1].target)
        const nestedLoop = nested[1].body.statements[0]
        assert(nestedLoop[0] === 'while')
        const local = nestedLoop[1].body.statements[0]
        assert(local[0] === 'return')
        assertEq(local[1], nested[1].target)
        const afterNested = outer[1].body.statements[3]
        assert(afterNested[0] === 'return')
        assertEq(afterNested[1], fn[1].target)
        assertStructurallySame(outer[1].body.exit, ['yield', undefined])
    },
    moduleLoopsHaveNoReturnOwner: () => {
        for (const source of [
            'while(false){return 0;}export default 1;',
            'while(false){if(true){return 0;}else{throw 2;}}export default 1;',
            'while(false){while(false){return 0;}}export default 1;',
        ]) {
            const result = assertError(parseFromTokens(tokenizeString(source)))
            assertEq(result.message, 'unexpected token')
            assertEq(result.metadata?.column, source.indexOf('return') + 1)
        }
        const module = assertOk(parseFromTokens(tokenizeString('while(false){const f=()=>{while(false){return 2;}return 3;};throw f();}export default 1;')))
        const loop = module.body.statements[0]
        assert(loop[0] === 'while')
        assertEq(loop[1].body.statements[1][0], 'throw')
    },
    returnsCrossLoopsAndKeepNestedCallsLocal: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['const f=n=>{while(n>0){return n;const skipped=null.x;}return -1;};export default [f(0),f(3)];', { default: [-1, 3] }],
            ['const f=n=>{let i=0;while(i<n){i=i+1;if(i===2){return [i,n];}}return [i,0];};export default [f(0),f(1),f(4)];', { default: [[0, 0], [1, 0], [2, 4]] }],
            ['const f=n=>{let i=0;while(i<n){i=i+1;if(i<2){continue;}else if(i===3){return i;}else{n=n+1;}}return -1;};export default f(4);', { default: 3 }],
            ['const f=n=>{while(n>0){let j=0;while(j<3){j=j+1;if(j===2){return [n,j];}}n=n-1;}return 0;};export default f(2);', { default: [2, 2] }],
            ['const f=n=>{while(n>0){const local=()=>{while(true){return 4;}return 5;};const value=local();return [n,value];}return 0;};export default f(2);', { default: [2, 4] }],
            ['const f=n=>{while(n>0){const value=(()=>{while(true){return 4;}return 5;})();return [n,value];}return 0;};export default f(2);', { default: [2, 4] }],
            ['const f=n=>{while(n>0){return 7;}const required=null.x;return 0;};export default f(1);', { default: 7 }],
            ['const f=n=>{let i=0;while(i<n){i=i+1;const snapshot=i;if(i===2){return [snapshot,(()=>snapshot)()];}}return i;};export default f(4);', { default: [2, 2] }],
            ['let i=0;while(i<2){i=i+1;const value=(()=>{while(true){return i;}return 0;})();}export default i;', { default: 2 }],
        ]
        for (const [source, expected] of cases) {
            assertStructurallySame(assertOk(toData(_evaluate(assertOk(parseFromTokens(tokenizeString(source)))))), expected, source)
        }
    },
    throwsRetainTheirReachedValue: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['while(true){throw 7;const skipped=null.x;}export default 0;', 7],
            ['const f=n=>{while(n>0){n=n-1;if(n===2){throw [n,4];}else{continue;}}return 0;};export default f(4);', [2, 4]],
            ['const f=n=>{while(n>0){let j=0;while(j<2){j=j+1;if(j===2){throw [n,j];}}n=n-1;}return 0;};export default f(3);', [3, 2]],
            ['const f=n=>{while(n>0){const g=()=>{while(true){throw n;}return 0;};return g();}return 0;};export default f(3);', 3],
            ['const f=n=>{while(n>0){return (()=>{throw 8;})();}return 0;};export default f(3);', 8],
        ]
        for (const [source, expected] of cases) {
            const module = assertOk(parseFromTokens(tokenizeString(source)))
            const thrown = assertError(memo(assertOk(analysis(unresolved(module).edag)))({ args: [] }))
            assertStructurallySame(assertOk(toData(thrown)), expected, source)
        }
        assertStructurallySame(assertOk(toData(_evaluate(assertOk(parseFromTokens(tokenizeString('while(false){throw null.x;}export default 3;')))))), { default: 3 })
    },
    earlierComputationsStayRequired: () => {
        for (const source of [
            'const f=n=>{while(n>0){const required=null.x;return 3;}return 0;};export default f(2);',
            'const f=n=>{while(n>0){n=null.x;n=1;throw 3;}return 0;};export default f(2);',
            'const f=n=>{while(n>0?null.x:false){return 3;}return 0;};export default f(2);',
            'const f=n=>{while(n>0){if(n===2){const required=null.x;return 3;}throw 4;}return 0;};export default f(2);',
        ]) {
            const module = assertOk(parseFromTokens(tokenizeString(source)))
            assertError(memo(assertOk(analysis(unresolved(module).edag)))({ args: [] }))
        }
    },
    sourceChecksContinueAfterBothExits: () => {
        /** @type {readonly (readonly [string, string])[]} */
        const cases = [
            ['const f=()=>{while(false){return 0;const unused=missing;}return 0;};export default f;', 'const not found'],
            ['const f=()=>{while(false){return 0;const unused=unused;}return 0;};export default f;', 'const not found'],
            ['const f=()=>{while(false){throw 0;const duplicate=1;const duplicate=2;}return 0;};export default f;', 'duplicate id'],
            ['const fixed=0;while(false){throw 1;fixed=2;}export default fixed;', 'assignment to const'],
            ['let value=0;const held=()=>value;while(false){throw 1;value=2;}export default held;', 'reassigned variable captured'],
            ['const f=n=>{const held=()=>n;while(false){return 1;n=2;}return held;};export default f;', 'reassigned variable captured'],
            ['const f=()=>{while(false){return 0;const local=1;}return local;};export default f;', 'const not found'],
            ['const f=()=>{while(false){if(true){return 1;}else{throw 2;}const unused=missing;}return 0;};export default f;', 'const not found'],
            ['const f=()=>{while(false){return 0;let [a,{b}]=missing;}return 0;};export default f;', 'const not found'],
        ]
        for (const [source, expected] of cases) {
            assertEq(assertError(parseFromTokens(tokenizeString(source))).message, expected, source)
        }
        const module = assertOk(parseFromTokens(tokenizeString('const f=n=>{while(false){return n;n=1;throw n;}return n;};export default f;')))
        assertEq(module.bindings.filter(binding => binding.isMutable).length, 1)
    },
    exitLineRulesMatchTerminalExits: () => {
        for (const source of [
            'const f=()=>{while(false){return\n1;}return 0;};export default f;',
            'const f=()=>{while(false){throw\n1;}return 0;};export default f;',
            'const f=()=>{while(false){return 1 return 2;}return 0;};export default f;',
            'const f=()=>{while(false){throw 1 const next=2;}return 0;};export default f;',
            'const f=()=>{while(false){return;}return 0;};export default f;',
            'const f=()=>{while(false){throw;}return 0;};export default f;',
        ]) {
            assertEq(assertError(parseFromTokens(tokenizeString(source))).message, 'unexpected token', source)
        }
        assertOk(parseFromTokens(tokenizeString('const f=()=>{while(false){return 1\nthrow 2\n}return 0;};export default f;')))
        assertOk(parseFromTokens(tokenizeString('const f=()=>{while(false){return undefined;}return 0;};export default f;')))
    },
    resolverUsesExplicitStacksAfterExits: () => {
        const module = assertOk(parseFromTokens(tokenizeString(`const f=()=>{while(false){${'return 0;throw 1;'.repeat(4096)}}return 0;};export default f;`)))
        const statement = module.body.statements[0]
        assert(statement[0] === 'initialize')
        const fn = statement[2]
        assert(fn instanceof Array && fn[0] === 'function')
        const loop = fn[1].body.statements[0]
        assert(loop[0] === 'while')
        assertEq(loop[1].body.statements.length, 8192)
        const depth = /** @type {const} */ (2048)
        assertOk(parseFromTokens(tokenizeString(`const f=()=>{while(false){${'if(true){'.repeat(depth)}return 0;${'}'.repeat(depth)}}return 0;};export default f;`)))
    },
})
