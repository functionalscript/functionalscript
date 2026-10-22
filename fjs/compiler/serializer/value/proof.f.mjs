/**
 * Concrete emitted modules pin value construction, capture positions and
 * separation of body code. Executing these modules belongs to the host proof.
 * @import { EdagValue } from '../../../edag/value/types.ts'
 */

import { assertEq } from '../../../asserts/module.f.js'
import { factoryStringify, stringify } from './module.f.mjs'

export const proof = {
    factoryStringify: () => {
        assertEq(factoryStringify(7), 'export default()=>{return 7;};')
        assertEq(factoryStringify(['undefined']), 'export default()=>{return undefined;};')
        const captured = /** @type {const} */ (['[]', [2]])
        const fn = /** @type {const} */ (['=>', 0, [captured], ['frame', 0]])
        assertEq(factoryStringify(['[]', [captured, fn, fn]]),
            'export default()=>{const $0=[2];const $1=()=>$0;return [$0,$1,$1];};')
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
        assertEq(stringify(['undefined']), 'export default undefined;')
    },
    containers: () => {
        assertEq(stringify(['[]', []]), 'export default [];')
        assertEq(stringify(['{}', []]), 'export default {};')
        assertEq(stringify(['{}', [
            [':', '0', 3], [':', '__proto__', ['undefined']], [':', 'a"b', 'x'],
        ]]), 'export default {"0":3,["__proto__"]:undefined,"a\\"b":"x"};')
        const shared = /** @type {const} */ (['[]', [1]])
        assertEq(stringify(['[]', [shared, shared, ['[]', [1]]]]),
            'const $0=[1];export default [$0,$0,[1]];')
        assertEq(stringify(['{}', [[':', 'a', shared], [':', 'b', shared]]]),
            'const $0=[1];export default {"a":$0,"b":$0};')
    },
    // The `entry` helper is written directly when unshared, and bound once
    // when several positions hold the same function value.
    entry: () => {
        const text = '($0,$1)=>{const $2=Object.getOwnPropertyDescriptor($0,$1);return $2?.enumerable?$2.value:undefined;}'
        assertEq(stringify(['entry']), `export default ${text};`)
        assertEq(factoryStringify(['entry']), `export default()=>{return ${text};};`)
        const helper = /** @type {const} */ (['entry'])
        const sharedText = '($1,$2)=>{const $3=Object.getOwnPropertyDescriptor($1,$2);return $3?.enumerable?$3.value:undefined;}'
        assertEq(stringify(['[]', [helper, helper]]), `const $0=${sharedText};export default [$0,$0];`)
        assertEq(stringify(['hasEntry']), 'export default ($0,$1)=>{const $2=Object.getOwnPropertyDescriptor($0,$1);return $2?.enumerable===true;};')
        assertEq(stringify(['slice']), 'export default ($0,$1,$2)=>$0.slice($1,$2);')
        assertEq(stringify(['charCodeAt']), 'export default ($0,$1)=>$0.charCodeAt($1);')
    },
    // A static function is the built-in, not its body, so there is none
    // to write: the module reads the host's own, one function however
    // often the value holds it.
    statics: () => {
        assertEq(stringify(['Object.entries']), 'export default Object.entries;')
        assertEq(stringify(['Object.is']), 'export default Object.is;')
        assertEq(stringify(['Number.isNaN']), 'export default Number.isNaN;')
        assertEq(stringify(['[]', [['Object.entries'], ['Object.entries']]]), 'export default [Object.entries,Object.entries];')
        assertEq(factoryStringify(['[]', [['Object.is'], ['Number.isFinite']]]), 'export default()=>{return [Object.is,Number.isFinite];};')
    },
    functions: () => {
        assertEq(stringify(['=>', 0, [], 1]), 'export default ()=>1;')
        assertEq(stringify(['=>', 1, [2], ['+', ['frame', 0], ['arg', 0]]]),
            'export default (($0)=>(($1)=>$0+$1))(2);')
        assertEq(stringify(['=>', 0, [7, 7, 9], ['frame', 1]]),
            'export default (($0,$1,$2)=>(()=>$1))(7,7,9);')
        const captured = /** @type {const} */ (['[]', [2]])
        const fn = /** @type {const} */ (['=>', 0, [captured, captured], ['frame', 1]])
        assertEq(stringify(['[]', [captured, fn, fn]]),
            'const $0=[2];const $1=(($2,$3)=>(()=>$3))($0,$0);export default [$0,$1,$1];')
    },
    bodyScopes: () => {
        // Body constructors remain in the function, even when their spelling
        // matches a captured container constructed at module load.
        assertEq(stringify(['=>', 0, [['[]', []]], ['[]', [['frame', 0], ['[]', []]]]]),
            'const $0=[];export default ()=>[$0,[]];')
        assertEq(stringify(['=>', 1, [], ['=>', 0, [['arg', 0]], ['frame', 0]]]),
            'export default ($0)=>()=>$0;')
    },
}
