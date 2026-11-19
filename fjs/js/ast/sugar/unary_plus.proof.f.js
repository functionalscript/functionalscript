/** Unary plus is source syntax that normalizes to FAST, wherever it stands. */

import { assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { parse } from '../../../compiler/source/module.f.js'
import { tryUnresolved, unresolved } from '../../../compiler/edag/module.f.js'
import { normalize, tryNormalize } from './module.f.js'

/** The module graph of a source text. @type {(source: string) => unknown} */
const edagOf = source => unresolved(assertOk(parse('plus.f.js')(source))).edag

export const proof = /** @type {const} */ ({
    normalizesEverySourceOccurrence: () => {
        for (const source of [
            'export default +1;',
            'export default +1n;',
            'export default (a,x)=>a[+x];',
            'export default (a,x)=>a?.[+x];',
            'export default (a,x)=>a?.[+x].value;',
            'export default (x=+1)=>x;',
            'const {x=+1}={};export default x;',
            'export default ()=>{return 1;const unused=+2;};',
        ]) {
            const ast = assertOk(parse('plus.f.js')(source))
            assertOk(tryNormalize(ast, []))
            assertOk(tryUnresolved(ast))
            normalize(ast, [])
        }
    },
    // One node of one operand, distinct from addition by its length; nested
    // prefixes nest, and the operand is whatever expression it was.
    isTheOneOperandNode: () => {
        assertStructurallySame(edagOf('export default +"5";'), ['{}', [[':', 'default', ['+', '5']]]])
        assertStructurallySame(edagOf('export default 1+ +"5";'), ['{}', [[':', 'default', ['+', 1, ['+', '5']]]]])
        assertStructurallySame(edagOf('export default a=>+ +a;'), ['{}', [[':', 'default', ['=>', 1, [], ['+', ['+', ['arg', 0]]]]]]])
        assertStructurallySame(edagOf('export default a=>-+a;'), ['{}', [[':', 'default', ['=>', 1, [], ['-', ['+', ['arg', 0]]]]]]])
    },
    additionAndLiteralPlusDataRemainAdmitted: () => {
        for (const source of ['export default 1+2;', 'export default ["+",1];', 'export default {"+":1};', 'export default (a,x)=>a[Number(x)];']) {
            assertOk(tryNormalize(assertOk(parse('plus.f.js')(source)), []))
        }
    },
})
