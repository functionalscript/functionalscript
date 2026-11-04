/** Unary plus is source syntax, with an explicit refusal before FAST construction. */

import { assertEq, assertError, assertOk } from '../../../asserts/module.f.js'
import { parse } from '../../../compiler/source/module.f.mjs'
import { tryUnresolved } from '../../../compiler/edag/module.f.mjs'
import { normalize, tryNormalize } from './module.f.mjs'

export const proof = /** @type {const} */ ({
    refusesEverySourceOccurrence: () => {
        for (const source of [
            'export default +1;',
            'export default +1n;',
            'export default (a,x)=>a[+x];',
            'export default (a,x)=>a?.[+x];',
            'export default (a,x)=>a?.[+x].value;',
            'export default (x=+1)=>x;',
            'const {x=+1}={};export default x;',
            'let x=0;export default +(()=>{x+=1;return x;})();',
            'export default ()=>{return 1;const unused=+2;};',
        ]) {
            const ast = assertOk(parse('plus.f.js')(source))
            assertEq(assertError(tryNormalize(ast, [])), 'unary + AST-to-FAST conversion is not implemented')
            assertEq(assertError(tryUnresolved(ast)), 'unary + AST-to-FAST conversion is not implemented')
        }
    },
    additionAndLiteralPlusDataRemainAdmitted: () => {
        for (const source of ['export default 1+2;', 'export default ["+",1];', 'export default {"+":1};', 'export default (a,x)=>a[Number(x)];']) {
            assertOk(tryNormalize(assertOk(parse('plus.f.js')(source)), []))
        }
    },
    throw: {
        strictNormalizerReportsTheSameRefusal: () => normalize(assertOk(parse('plus.f.js')('export default +1;')), []),
    },
})
