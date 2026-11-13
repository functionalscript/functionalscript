/** Omitted named-let initializers become the existing undefined value at declaration time. */

/** @import { ResolvedModule } from './types.ts' */

import { assertEq, assertError, assertNotNullish, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'
import { normalize } from '../../js/ast/sugar/module.f.mjs'
import { parseFromTokens } from './module.f.mjs'
import { _evaluate, stringifyModule, tokenizeString } from './proof.f.mjs'

/** @type {(source: string) => ResolvedModule} */
const admitted = source => assertOk(parseFromTokens(tokenizeString(source)))

export const proof = /** @type {const} */ ({
    sharesExplicitUndefinedFastAndGraph: () => {
        for (const [omitted, explicit] of [
            ['let value;export default value;', 'let value=undefined;export default value;'],
            ['export default ()=>{let value;return value;};', 'export default ()=>{let value=undefined;return value;};'],
            ['let n=0;while(n<1){let value;value=1;n+=value;}export default n;', 'let n=0;while(n<1){let value=undefined;value=1;n+=value;}export default n;'],
            ['for(let value;value===undefined;value=1){}export default 0;', 'for(let value=undefined;value===undefined;value=1){}export default 0;'],
            ['export default n=>{let value;while(n>0){value=n;n-=1;}return value;};', 'export default n=>{let value=undefined;while(n>0){value=n;n-=1;}return value;};'],
        ]) {
            const bare = admitted(omitted)
            const initialized = admitted(explicit)
            assertStructurallySame(normalize(bare, []), normalize(initialized, []), omitted)
            assertEq(stringifyModule(bare), stringifyModule(initialized), omitted)
        }
    },
    sourceFactsInitializeBeforeReadsAndWrites: () => {
        const module = admitted('let value;const initial=value;value=3;export default [initial,value];')
        const value = assertNotNullish(module.origins.find(origin => origin.name === 'value')).id
        const initial = assertNotNullish(module.origins.find(origin => origin.name === 'initial')).id
        assertStructurallySame(module.scope.events, [
            ['initialize', value], ['read', value], ['initialize', initial],
            ['write', value], ['read', initial], ['read', value],
        ])
        assertEq(assertNotNullish(module.bindings.find(binding => binding.id === value)).isMutable, true)
        assertStructurallySame(assertOk(toData(_evaluate(module))), { default: [undefined, 3] })
    },
    ordinaryReadsBranchesAndFreshLoopDeclarations: () => {
        /** @type {readonly (readonly [string, unknown])[]} */
        const cases = [
            ['const value=9;const read=()=>{let value;return value;};export default read();', undefined],
            ['let value;const read=()=>value;export default read();', undefined],
            ['const choose=flag=>{let value;if(flag){value=3;}return value;};export default [choose(false),choose(true)];', [undefined, 3]],
            ['let count=0;let fresh=true;while(count<3){let local;fresh=fresh&&(local===undefined);local=count;count+=1;}export default [fresh,count];', [true, 3]],
            ['let count=0;let result=0;for(let cursor;count<3;count+=1){if(cursor===undefined){cursor=4;}else{cursor+=1;}result=cursor;}export default result;', 6],
            ['let value\nconst initial=value\nvalue=2\nexport default initial===undefined&&value===2', true],
            ['export default (()=>{let value\nreturn value})();', undefined],
        ]
        for (const [source, expected] of cases) {
            assertStructurallySame(assertOk(toData(_evaluate(admitted(source)))), { default: expected }, source)
        }
    },
    lexicalAndCaptureRefusalsRemain: () => {
        for (const [source, message] of [
            ['const before=value;let value;export default before;', 'const not found'],
            ['value=1;let value;export default value;', 'const not found'],
            ['let value=value;export default value;', 'const not found'],
            ['const value=9;export default ()=>{const before=value;let value;return before;};', 'capture shadowed'],
            ['let value;let value;export default value;', 'duplicate id'],
            ['export default value=>{let value;return value;};', 'duplicate id'],
            ['let value;const read=()=>value;value=1;export default read;', 'reassigned variable captured'],
            ['for(let value;false;){}export default value;', 'const not found'],
        ]) {
            assertEq(assertError(parseFromTokens(tokenizeString(source))).message, message, source)
        }
    },
    otherMissingInitializersAndStatementBoundariesStayRefused: () => {
        for (const source of [
            'const value;export default value;',
            'let [value];export default value;',
            'let {value};export default value;',
            'for(const value;false;){}export default 0;',
            'for(let [value];false;){}export default 0;',
            'export let value;export default value;',
            'export default ()=>{let value return value;};',
        ]) { assertError(parseFromTokens(tokenizeString(source))) }
    },
})
