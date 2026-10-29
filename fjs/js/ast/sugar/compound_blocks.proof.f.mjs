/** Compound assignment and expression-block writes share ordered source state. */

import { assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { parse } from '../../../compiler/source/module.f.mjs'
import { unresolved } from '../../../compiler/edag/module.f.mjs'
import { analysis } from '../../../edag/analysis/module.f.mjs'
import { memo } from '../../../edag/memo/module.f.mjs'
import { toData } from '../../../edag/value/to_unknown/module.f.mjs'

/** @param {string} source */
const evaluate = source => memo(assertOk(analysis(unresolved(assertOk(parse('/compound-blocks.f.js')(source))).edag)))({ args: [] })

export const proof = /** @type {const} */ ({
    eagerTargetReadPrecedesRightOperandWrites: () => {
        const source = /** @type {const} */ ('export default (()=>{let x=1;let y=0;x += (()=>{x=10;y=2;return 3;})();return [x,y];})();')
        assertStructurallySame(assertOk(toData(assertOk(evaluate(source)))), { default: [4, 2] })
    },
    logicalSelectedWritesAreJoinedAndSkippedWritesStayUnreached: () => {
        const cases = /** @type {const} */ ([
            ['&&=', 0, [0, 0]], ['&&=', 7, [5, 1]],
            ['||=', 0, [5, 1]], ['||=', 7, [7, 0]],
            ['??=', 'null', [5, 1]], ['??=', 0, [0, 0]],
        ])
        for (const [operator, initial, expected] of cases) {
            const source = `export default (()=>{let x=${initial};let y=0;x ${operator} (()=>{x=99;y+=1;return 5;})();return [x,y];})();`
            assertStructurallySame(assertOk(toData(assertOk(evaluate(source)))), { default: expected }, source)
        }
    },
    nestedCompoundWritesAreExpressionEffects: () => {
        const source = /** @type {const} */ ('export default (()=>{let x=1;let y=0;const r=(()=>{x+=(()=>{y+=2;return 3;})();return x;})();return [r,x,y];})();')
        assertStructurallySame(assertOk(toData(assertOk(evaluate(source)))), { default: [4, 4, 2] })
    },
    abruptRightOperandsStopOnlyReachedAssignments: () => {
        for (const operator of ['+=', '&&=', '||=', '??=']) {
            const initial = operator === '&&=' ? '1' : operator === '??=' ? 'null' : '0'
            const source = `export default (()=>{let x=${initial};let y=0;x ${operator} (()=>{y+=1;throw 37;})();return x;})();`
            assertEq(assertError(evaluate(source)), 37, source)
        }
        const skipped = /** @type {const} */ ('export default (()=>{let x=1;let y=0;x ??= (()=>{y+=1;throw 37;})();return [x,y];})();')
        assertStructurallySame(assertOk(toData(assertOk(evaluate(skipped)))), { default: [1, 0] })
    },
})
