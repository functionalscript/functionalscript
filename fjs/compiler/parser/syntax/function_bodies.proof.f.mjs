/** Written bodies are statement sequences; completion is a lowering decision. */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { tokenizeString } from '../proof.f.mjs'
import { parseSyntax } from './module.f.mjs'

/** @type {(source: string) => import('./types.ts').Block[1]} */
const statements = source => {
    const value = assertOk(parseSyntax(tokenizeString(source))).exported?.value
    assert(value !== undefined && value[0] === '=>')
    const body = value[2]
    assert(body[0] === 'block')
    return body[1]
}

export const proof = /** @type {const} */ ({
    missingReturnIsAbsence: () => {
        assertStructurallySame(statements('export default ()=>{};'), [])
        assertStructurallySame(statements('export default ()=>{const x=1;let y=2;};').map(statement => statement[0]), ['const', 'let'])
    },
    unreachableStatementsArePreserved: () => {
        assertStructurallySame(statements('export default ()=>{return 1;const x=2;throw 3;};').map(statement => statement[0]), ['return', 'const', 'throw'])
        const module = assertOk(parseSyntax(tokenizeString('{throw 1;const x=2;}export default 0;')))
        const block = module.statements[0]
        assert(block[0] === 'block')
        assertStructurallySame(block[1].block[1].map(statement => statement[0]), ['throw', 'const'])
    },
    allIfArmsHaveTheSameWrittenShape: () => {
        const body = statements('export default a=>{if(a){return 1;}else{return 2;}const x=3;};')
        assertStructurallySame(body.map(statement => statement[0]), ['if', 'const'])
        const conditional = body[0]
        assert(conditional[0] === 'if' && conditional[1].otherwise !== null)
        assertEq(conditional[1].block[1][0][0], 'return')
        assertEq(conditional[1].otherwise[1][0][0], 'return')
        assertEq(statements('export default a=>{if(a){return 1;}};')[0][0], 'if')
    },
    loopsDoNotCarryCompletionMarkers: () => {
        for(const source of ['while(true){}', 'while(false){}', 'for(;;){}', 'for(const x of []){}']) {
            const final = statements(`export default ()=>{${source}};`)
            const followed = statements(`export default ()=>{${source}return 1;};`)
            assertEq(final[0][0], followed[0][0])
            assertEq(final.length, 1)
            assertEq(followed[1][0], 'return')
        }
    },
    explicitReturnValuesRemainExplicit: () => {
        const statement = statements('export default ()=>{return;};')[0]
        assert(statement[0] === 'return')
        assertEq(statement[1].value, null)
        assertEq(statements('export default ()=>{throw 1;};')[0][0], 'throw')
    },
})
