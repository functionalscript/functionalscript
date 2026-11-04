/** Post-test loops preserve condition timing, state and transfer ownership. */

/** @import { Exp } from '../../../edag/types.ts' */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { parse } from '../../../compiler/source/module.f.mjs'
import { tryUnresolved } from '../../../compiler/edag/module.f.mjs'
import { tryModuleStringify } from '../../../compiler/serializer/module.f.mjs'
import { toRust } from '../../../compiler/rust/module.f.mjs'
import { analysis } from '../../../edag/analysis/module.f.mjs'
import { memo } from '../../../edag/memo/module.f.mjs'
import { toData } from '../../../edag/value/to_unknown/module.f.mjs'
import { hasEntry } from '../../../types/object/entry/module.f.js'
import { normalize } from './module.f.mjs'

/** @type {(source: string) => Exp} */
const graph = source => assertOk(tryUnresolved(assertOk(parse('do.f.js')(source)))).edag

/** @type {(source: string) => unknown} */
const result = source => {
    const value = assertOk(toData(assertOk(memo(assertOk(analysis(graph(source))))({ args: [] }))))
    assert(value !== null && typeof value === 'object' && hasEntry(value, 'default'))
    return value.default
}

export const proof = /** @type {const} */ ({
    formerlyUndecidedSampleIsAccepted: () => {
        assertEq(result('const f = () => { let i = 0; do { i = i + 1; } while (i < 3); return i; };\nexport default f();\n'), 3)
    },
    onceEvenWhenFalseAndStateAcrossIterations: () => {
        assertEq(result('let i=0;do{i+=1;}while(false);export default i;'), 1)
        assertEq(result('let i=0;do{i+=1;}while(i<4);export default i;'), 4)
        assertEq(result('let i=0;do{i+=1;continue;}while(i<4);export default i;'), 4)
        assertEq(result('let i=0;do{{i+=1;continue;}}while(i<4);export default i;'), 4)
    },
    conditionRunsOnceOnNormalAndContinuePaths: () => {
        for (const transfer of ['', 'continue;']) {
            const source = 'let i=0;let tests=0;do{i+=1;' + transfer + '}while((()=>{tests+=1;return i<3;})());export default [i,tests];'
            assertStructurallySame(result(source), [3, 3])
        }
    },
    abruptTransfersSkipTheCondition: () => {
        assertEq(result('let i=0;do{i+=1;break;}while((()=>{throw "condition";})());export default i;'), 1)
        assertEq(result('export default (()=>{do{return 7;}while((()=>{throw "condition";})());})();'), 7)
        const source = 'do{throw "body";}while((()=>{throw "condition";})());export default 0;'
        assertEq(assertError(memo(assertOk(analysis(graph(source))))({ args: [] })), 'body')
        const failed = 'do{continue;}while((()=>{throw "condition";})());export default 0;'
        assertEq(assertError(memo(assertOk(analysis(graph(failed))))({ args: [] })), 'condition')
    },
    nestedOwnersAndShadowedNames: () => {
        assertEq(result('let i=0;do{i+=1;switch(i){case 1:{continue;}default:{break;}}}while(i<1);export default i;'), 1)
        assertEq(result('let i=0;let n=0;do{i+=1;do{n+=1;break;}while(true);}while(i<3);export default n;'), 3)
        assertEq(result('let i=0;do{i+=1;switch(i){case 1:{continue;}default:{break;}}}while(i<3);export default i;'), 3)
        assertEq(result('let n=0;for(let i=0;i<2;i+=1){let j=0;do{j+=1;n+=1;continue;}while(j<2);}export default n;'), 4)
        assertEq(result('let i=0;let n=0;do{i+=1;while(n<3){n+=1;continue;}}while(i<2);export default i;'), 2)
        assertEq(result('let condition=false;do{const condition=true;}while(condition);export default condition;'), false)
        assertEq(result('let i=0;do{i+=1;const f=()=>{while(true){return 1;}};f();}while(i<2);export default i;'), 2)
    },
    sourceMarkerAndExistingOutputs: () => {
        const source = 'let i=0;do{i+=1;}while(i<3);export default i;'
        const ast = assertOk(parse('do.f.js')(source))
        const loop = ast.body.statements[1]
        assert(loop[0] === 'while')
        assertEq(loop[1].postTest, true)
        const fast = normalize(ast, [])
        assert(fast.body.statements.some(statement => statement[0] === 'loop'))
        const written = assertOk(tryModuleStringify(graph(source)))
        assertEq(result(written), 3)
        assertOk(toRust(graph(source)))
    },
})
