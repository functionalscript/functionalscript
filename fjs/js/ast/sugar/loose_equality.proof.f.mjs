/** Deferred equality fails before normalization, even in unreachable source. */

import { assertEq, assertError, assertOk } from '../../../asserts/module.f.js'
import { parse } from '../../../compiler/source/module.f.mjs'
import { tryUnresolved } from '../../../compiler/edag/module.f.mjs'
import { tryNormalize } from './module.f.mjs'

export const proof = /** @type {const} */ ({
    everyOccurrenceRefusesBeforeFast: () => {
        for (const source of [
            'export default 1=="1";',
            'export default (a,b)=>a==b;',
            'export default (x=null==undefined)=>x;',
            'const {x=0==""}={};export default x;',
            'export default false&&(0=="");',
            'export default ()=>{return 1;const unused=1=="1";};',
            'let x=0;export default (()=>{x+=1;return x;})()=="1";',
        ]) {
            for (const operator of ['==', '!=']) {
                const ast = assertOk(parse('equality.f.js')(source.replaceAll('==', operator)))
                assertEq(assertError(tryNormalize(ast, [])), `${operator} AST-to-FAST conversion is not implemented`)
                assertEq(assertError(tryUnresolved(ast)), `${operator} AST-to-FAST conversion is not implemented`)
            }
        }
    },
    strictEqualityAndLiteralDataStillLower: () => {
        for (const source of ['export default 1===1;', 'export default 1!=="1";', 'export default ["==",1,2];', 'export default ["!=",1,2];', 'export default {"==":1};', 'export default {"!=":1};']) {
            assertOk(tryNormalize(assertOk(parse('equality.f.js')(source)), []))
        }
    },
})
