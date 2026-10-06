/**
 * Concrete emitted modules pin value construction, capture positions and
 * separation of body code. Executing these modules belongs to the host proof.
 * @import { EdagValue } from '../../../edag/value/types.ts'
 */

import { assertEq } from '../../../asserts/module.f.mjs'
import { stringify } from './module.f.mjs'

export const proof = {
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
        assertEq(stringify(['undefined']), 'const $v0=undefined;export default $v0;')
    },
    containers: () => {
        assertEq(stringify(['[]', []]), 'const $v0=[];export default $v0;')
        assertEq(stringify(['{}', []]), 'const $v0={};export default $v0;')
        assertEq(stringify(['{}', [
            [':', '0', 3], [':', '__proto__', ['undefined']], [':', 'a"b', 'x'],
        ]]), 'const $v0=undefined;const $v1={["0"]:3,["__proto__"]:$v0,["a\\"b"]:"x"};export default $v1;')
        const shared = /** @type {const} */ (['[]', [1]])
        assertEq(stringify(['[]', [shared, shared, ['[]', [1]]]]),
            'const $v0=[1];const $v1=[1];const $v2=[$v0,$v0,$v1];export default $v2;')
        assertEq(stringify(['{}', [[':', 'a', shared], [':', 'b', shared]]]),
            'const $v0=[1];const $v1={["a"]:$v0,["b"]:$v0};export default $v1;')
    },
    functions: () => {
        assertEq(stringify(['=>', 0, [], 1]), 'const $v0=()=>(1);export default $v0;')
        assertEq(stringify(['=>', 1, [2], ['+', ['frame', 0], ['arg', 0]]]),
            'const $v3=(($0)=>(($a_0)=>(($0)+($a_0))))(2);export default $v3;')
        assertEq(stringify(['=>', 0, [7, 7, 9], ['frame', 1]]),
            'const $v1=(($0,$1,$2)=>(()=>($1)))(7,7,9);export default $v1;')
        const captured = /** @type {const} */ (['[]', [2]])
        const fn = /** @type {const} */ (['=>', 0, [captured, captured], ['frame', 1]])
        assertEq(stringify(['[]', [captured, fn, fn]]),
            'const $v0=[2];const $v2=(($0,$1)=>(()=>($1)))($v0,$v0);const $v3=[$v0,$v2,$v2];export default $v3;')
    },
    bodyScopes: () => {
        // Body constructors remain in the function, even when their spelling
        // matches a captured container constructed at module load.
        assertEq(stringify(['=>', 0, [['[]', []]], ['[]', [['frame', 0], ['[]', []]]]]),
            'const $v0=[];const $v4=(($0)=>(()=>([($0),([])])))($v0);export default $v4;')
        assertEq(stringify(['=>', 1, [], ['=>', 0, [['arg', 0]], ['frame', 0]]]),
            'const $v3=($a_0)=>(($0)=>(()=>($0)))(($a_0));export default $v3;')
    },
}
