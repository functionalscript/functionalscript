/** Const statement lists retain syntax grouping and lower to sequential bindings. */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { memo } from '../../edag/memo/module.f.mjs'
import { analysis } from '../../edag/analysis/module.f.mjs'
import { unresolved } from '../edag/module.f.mjs'
import { normalize } from '../../js/ast/sugar/module.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'
import { parseFromTokens } from './module.f.mjs'
import { parseSyntax } from './syntax/module.f.mjs'
import { _evaluate, tokenizeString } from './proof.f.mjs'

/** @type {(source: string) => import('./types.ts').ResolvedModule} */
const parsed = source => assertOk(parseFromTokens(tokenizeString(source)))

export const proof = {
    astRetainsTheWrittenGroup: () => {
        const module = assertOk(parseSyntax(tokenizeString('const a=[1,2],{length:b}=a;export default b;')))
        assertEq(module.statements.length, 1)
        const declaration = module.statements[0]
        assert(declaration[0] === 'const')
        assertEq(declaration[1].declaration.following?.length, 1)
    },
    fastMatchesSeparateDeclarations: () => {
        for (const [grouped, separate] of [
            ['const a=[1],b=[a,a];export default [a,b];', 'const a=[1];const b=[a,a];export default [a,b];'],
            ['export default ()=>{const a=1,b=a+1;return b;};', 'export default ()=>{const a=1;const b=a+1;return b;};'],
            ['export const a=1,b=a+1;', 'export const a=1;export const b=a+1;'],
        ]) { assertStructurallySame(normalize(parsed(grouped), []), normalize(parsed(separate), [])) }
    },
    valuesAndScopesStaySequential: () => {
        for (const [source, expected] of /** @type {readonly (readonly [string, unknown])[]} */ ([
            ['const a=1,b=a+1;export default b;', 2],
            ['const f=(a,b)=>{const x=1,y=x+1;return a+b+x+y;};export default f(1,2);', 6],
            ['const a=[1],b=a;export default a===b;', true],
            ['const a=[1],{length:b}=a,[c]=a;export default [b,c];', [1,1]],
            ['const a=1,b=()=>b;export default b()===b;', true],
            ['const f=n=>{if(n){const a=1,b=a+1;return b;}return 0;};export default f(true);', 2],
            ['const f=n=>{switch(n){case 1:{const a=1,b=a+1;return b;}default:{return 0;}}};export default f(1);', 2],
            ['const a=1;let result=0;{const a=2,b=a+1;result=b;}export default [a,result];', [1,3]],
            ['let result=0;while(result<1){const a=1,b=a+1;result=b;}export default result;', 2],
            ['const a=1,b=a+1\nexport default b;', 2],
        ])) { assertStructurallySame(assertOk(toData(_evaluate(parsed(source)))), { default: expected }, source) }
    },
    requiredInitializersStayRequired: () => {
        for (const source of [
            'const a=null.x,b=1;export default b;',
            'const a=1,b=null.x;export default a;',
            'export default (()=>{const a=null.x,b=1;return b;})();',
        ]) { assertError(memo(assertOk(analysis(unresolved(parsed(source)).edag)))({ args: [] })) }
    },
    declarationAndSeparatorErrorsRemainErrors: () => {
        assertEq(assertError(parseFromTokens(tokenizeString('const a=1,a=2;export default a;'))).metadata?.column, 11)
        for (const source of [
            'const a=1,a=2;export default a;',
            'const a=b,b=1;export default a;',
            'const a=1,b;export default a;',
            'const a=1,;export default a;',
            'const a=1,,b=2;export default a;',
            'const a=1,b=2 export default a;',
            'const a=1,b=2;export const b=3;',
        ]) { assertError(parseFromTokens(tokenizeString(source))) }
    },
}
