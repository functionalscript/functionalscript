/** Array-led statements preserve written values, source boundaries and required calls. */

/** @import { Module, Const } from './syntax/types.ts' */

import { assert, assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { parseSyntax } from './syntax/module.f.mjs'
import { parseFromTokens } from './module.f.mjs'
import { _evaluate, stringifyModule, tokenizeString } from './proof.f.mjs'
import { unresolved } from '../edag/module.f.mjs'
import { analysis } from '../../edag/analysis/module.f.mjs'
import { memo } from '../../edag/memo/module.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'

/** @type {(source: string) => Module} */
const written = source => assertOk(parseSyntax(tokenizeString(source)))

/** @type {(module: Module, index: number) => Const} */
const declaration = (module, index) => {
    const statement = module.statements[index]
    assert(statement[0] === 'const')
    return statement[1].declaration
}

export const proof = /** @type {const} */ ({
    allBlockPositionsUseTheSameGrammar: () => {
        for (const source of [
            '[f][0]();export default 0;',
            'export default ()=>{[f][0]();return 0;};',
            'export default ()=>{if(flag){[f][0]();}else{[g][0]();}return 0;};',
            'export default ()=>{while(flag){[f][0]();break;}return 0;};',
            'export default ()=>{for(let i=0;i<1;i=i+1){[f][0]();}return 0;};',
            'export default ()=>{switch(flag){case 0:{[f][0]();return 1;}default:{[g][0]();return 0;}}};',
            '{[f][0]();}export default 0;',
        ]) { written(source) }
    },
    indexingContinuationWinsUntilASeparator: () => {
        assertEq(written('f()\n[0](x);export default 0;').statements.length, 1)
        assertEq(written('f();\n[0](x);export default 0;').statements.length, 2)
        assertEq(written('[f]\n[0](x);export default 0;').statements.length, 1)
        assertEq(written('[f];\n[0](x);export default 0;').statements.length, 2)
        assertEq(written('const a=f()\n[0](x);export default a;').statements.length, 1)
        assertEq(written('const a=f();\n[0](x);export default a;').statements.length, 2)
        assertError(parseSyntax(tokenizeString('f()\n[];export default 0;')))
        const first = declaration(written('[f][0]()\nexport default 0;'), 0)
        assertEq(first.semicolon, false)
    },
    bareReturnKeepsTheFollowingArrayStatement: () => {
        const module = written('export default f=>{return\n[f][0]();};')
        const fn = module.exported?.value
        assert(fn !== undefined && fn[0] === '=>' && fn[2][0] === 'block')
        const statements = fn[2][1]
        assertEq(statements.length, 2)
        assert(statements[0][0] === 'return')
        assertEq(statements[0][1].value, null)
        assertEq(statements[1][0], 'const')
        assertOk(parseFromTokens(tokenizeString('export default f=>{return\n[f][0]();};')))
    },
    acceptedCallsKeepRequiredEvaluation: () => {
        const call = assertOk(parseFromTokens(tokenizeString('const f=()=>1;[f][0]();export default 2;')))
        const bound = assertOk(parseFromTokens(tokenizeString('const f=()=>1;const unused=[f][0]();export default 2;')))
        assertEq(stringifyModule(call), stringifyModule(bound))
        assertStructurallySame(assertOk(toData(_evaluate(call))), { default: 2 })
        const failing = assertOk(parseFromTokens(tokenizeString('[()=>{throw "reached";}][0]();export default 2;')))
        assertEq(assertError(memo(assertOk(analysis(unresolved(failing).edag)))({ args: [] })), 'reached')
        for (const source of ['[];export default 0;', '[1]+2;export default 0;']) {
            written(source)
            assertError(parseFromTokens(tokenizeString(source)))
        }
    },
})
