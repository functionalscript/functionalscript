/**
 * Concrete emitted modules pin value construction, capture positions and
 * separation of body code. Executing these modules belongs to the host proof.
 * @import { EdagValue } from '../../../edag/value/types.ts'
 */

import { assertEq } from '../../../asserts/module.f.mjs'
import { factoryStringify, stringify } from './module.f.mjs'

export const proof = {
    factoryStringify: () => {
        assertEq(factoryStringify(7), 'export default()=>{return 7;};')
        assertEq(factoryStringify(['undefined']), 'export default()=>{const $0=undefined;return $0;};')
        const captured = /** @type {const} */ (['[]', [2]])
        const fn = /** @type {const} */ (['=>', 0, [captured], ['frame', 0]])
        assertEq(factoryStringify(['[]', [captured, fn, fn]]),
            'export default()=>{const $0=[2];const $1=(($2)=>(()=>($2)))($0);const $3=[$0,$1,$1];return $3;};')
    },
    primitives: () => {
        /** @type {readonly (readonly [EdagValue, string])[]} */
        const cases = [
            [null, 'null'], [false, 'false'], [true, 'true'],
            [7, '7'], [-0, '-0'], [NaN, 'NaN'],
            [Infinity, 'Infinity'], [-Infinity, '-Infinity'],
            [3n, '3n'], ['a\n"b', '"a\\n\\"b"'],
        ]
        for (const [value, text] of cases) {
            assertEq(stringify(value), `export default ${text};`)
        }
        assertEq(stringify(['undefined']), 'const $0=undefined;export default $0;')
    },
    containers: () => {
        assertEq(stringify(['[]', []]), 'const $0=[];export default $0;')
        assertEq(stringify(['{}', []]), 'const $0={};export default $0;')
        assertEq(stringify(['{}', [
            [':', '0', 3], [':', '__proto__', ['undefined']], [':', 'a"b', 'x'],
        ]]), 'const $0=undefined;const $1={["0"]:3,["__proto__"]:$0,["a\\"b"]:"x"};export default $1;')
        const shared = /** @type {const} */ (['[]', [1]])
        assertEq(stringify(['[]', [shared, shared, ['[]', [1]]]]),
            'const $0=[1];const $1=[1];const $2=[$0,$0,$1];export default $2;')
        assertEq(stringify(['{}', [[':', 'a', shared], [':', 'b', shared]]]),
            'const $0=[1];const $1={["a"]:$0,["b"]:$0};export default $1;')
    },
    functions: () => {
        assertEq(stringify(['=>', 0, [], 1]), 'const $0=()=>(1);export default $0;')
        assertEq(stringify(['=>', 1, [2], ['+', ['frame', 0], ['arg', 0]]]),
            'const $0=(($1)=>(($2)=>(($1)+($2))))(2);export default $0;')
        assertEq(stringify(['=>', 0, [7, 7, 9], ['frame', 1]]),
            'const $0=(($1,$2,$3)=>(()=>($2)))(7,7,9);export default $0;')
        const captured = /** @type {const} */ (['[]', [2]])
        const fn = /** @type {const} */ (['=>', 0, [captured, captured], ['frame', 1]])
        assertEq(stringify(['[]', [captured, fn, fn]]),
            'const $0=[2];const $1=(($2,$3)=>(()=>($3)))($0,$0);const $4=[$0,$1,$1];export default $4;')
    },
    bodyScopes: () => {
        // Body constructors remain in the function, even when their spelling
        // matches a captured container constructed at module load.
        assertEq(stringify(['=>', 0, [['[]', []]], ['[]', [['frame', 0], ['[]', []]]]]),
            'const $0=[];const $1=(($2)=>(()=>([($2),([])])))($0);export default $1;')
        assertEq(stringify(['=>', 1, [], ['=>', 0, [['arg', 0]], ['frame', 0]]]),
            'const $0=($1)=>(($2)=>(()=>($2)))(($1));export default $0;')
    },
}
