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
        assertEq(factoryStringify(['undefined']), 'export default()=>{const cv0=undefined;return cv0;};')
        const captured = /** @type {const} */ (['[]', [2]])
        const fn = /** @type {const} */ (['=>', 0, [captured], ['frame', 0]])
        assertEq(factoryStringify(['[]', [captured, fn, fn]]),
            'export default()=>{const cv0=[2];const cv2=((c0)=>(()=>(c0)))(cv0);const cv3=[cv0,cv2,cv2];return cv3;};')
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
        assertEq(stringify(['undefined']), 'const cv0=undefined;export default cv0;')
    },
    containers: () => {
        assertEq(stringify(['[]', []]), 'const cv0=[];export default cv0;')
        assertEq(stringify(['{}', []]), 'const cv0={};export default cv0;')
        assertEq(stringify(['{}', [
            [':', '0', 3], [':', '__proto__', ['undefined']], [':', 'a"b', 'x'],
        ]]), 'const cv0=undefined;const cv1={["0"]:3,["__proto__"]:cv0,["a\\"b"]:"x"};export default cv1;')
        const shared = /** @type {const} */ (['[]', [1]])
        assertEq(stringify(['[]', [shared, shared, ['[]', [1]]]]),
            'const cv0=[1];const cv1=[1];const cv2=[cv0,cv0,cv1];export default cv2;')
        assertEq(stringify(['{}', [[':', 'a', shared], [':', 'b', shared]]]),
            'const cv0=[1];const cv1={["a"]:cv0,["b"]:cv0};export default cv1;')
    },
    functions: () => {
        assertEq(stringify(['=>', 0, [], 1]), 'const cv0=()=>(1);export default cv0;')
        assertEq(stringify(['=>', 1, [2], ['+', ['frame', 0], ['arg', 0]]]),
            'const cv3=((c0)=>((a0)=>((c0)+(a0))))(2);export default cv3;')
        assertEq(stringify(['=>', 0, [7, 7, 9], ['frame', 1]]),
            'const cv1=((c0,c1,c2)=>(()=>(c1)))(7,7,9);export default cv1;')
        const captured = /** @type {const} */ (['[]', [2]])
        const fn = /** @type {const} */ (['=>', 0, [captured, captured], ['frame', 1]])
        assertEq(stringify(['[]', [captured, fn, fn]]),
            'const cv0=[2];const cv2=((c0,c1)=>(()=>(c1)))(cv0,cv0);const cv3=[cv0,cv2,cv2];export default cv3;')
    },
    bodyScopes: () => {
        // Body constructors remain in the function, even when their spelling
        // matches a captured container constructed at module load.
        assertEq(stringify(['=>', 0, [['[]', []]], ['[]', [['frame', 0], ['[]', []]]]]),
            'const cv0=[];const cv4=((c0)=>(()=>([(c0),([])])))(cv0);export default cv4;')
        assertEq(stringify(['=>', 1, [], ['=>', 0, [['arg', 0]], ['frame', 0]]]),
            'const cv3=(a0)=>((c0)=>(()=>(c0)))((a0));export default cv3;')
    },
}
