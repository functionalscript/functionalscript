/** Syntax retains post-test ordering, boundaries and unreachable body syntax. */

import { assert, assertEq, assertOk } from '../../../asserts/module.f.js'
import { tokenizeString } from '../proof.f.mjs'
import { parseSyntax } from './module.f.mjs'

export const proof = /** @type {const} */ ({
    writtenLoopRecord: () => {
        const module = assertOk(parseSyntax(tokenizeString('do{break;const after=1;}while(false);export default 0;')))
        const statement = module.statements[0]
        assert(statement[0] === 'do')
        assertEq(statement[1].postTest, true)
        assertEq(statement[1].semicolon, true)
        assertEq(statement[1].block[1].length, 2)
        const fn = assertOk(parseSyntax(tokenizeString('export default ()=>{do{}while(false)};'))).exported?.value
        assert(fn !== undefined && fn[0] === '=>' && fn[2][0] === 'block')
        const inner = fn[2][1][0]
        assert(inner[0] === 'do')
        assertEq(inner[1].semicolon, false)
    },
})
