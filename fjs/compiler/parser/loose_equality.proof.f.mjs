/** Loose equality retains its source operator without enabling execution. */

/** @import { Node } from './syntax/types.ts' */

import { assertEq, assertError, assertNotNullish, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { parseSyntax } from './syntax/module.f.mjs'
import { parseFromTokens } from './module.f.mjs'
import { tokenizeString } from './proof.f.mjs'

/** @type {(source: string) => Node} */
const expression = source => assertNotNullish(assertOk(parseSyntax(tokenizeString('export default ' + source + ';'))).exported).value

export const proof = /** @type {const} */ ({
    precedenceAndAssociativity: () => {
        assertStructurallySame(expression('1==2'), ['==', ['primitive', 1], ['primitive', 2]])
        assertStructurallySame(expression('1==2===3'), ['===', ['==', ['primitive', 1], ['primitive', 2]], ['primitive', 3]])
        assertStructurallySame(expression('1===2==3'), ['==', ['===', ['primitive', 1], ['primitive', 2]], ['primitive', 3]])
        assertStructurallySame(expression('1<2==3+4&5'), ['&', ['==', ['<', ['primitive', 1], ['primitive', 2]], ['+', ['primitive', 3], ['primitive', 4]]], ['primitive', 5]])
        assertStructurallySame(expression('1==2==3'), ['==', ['==', ['primitive', 1], ['primitive', 2]], ['primitive', 3]])
    },
    inequalityRetainsItsOwnTagAndPrecedence: () => {
        assertStructurallySame(expression('1!=2==3'), ['==', ['!=', ['primitive', 1], ['primitive', 2]], ['primitive', 3]])
        assertStructurallySame(expression('1==2!=3'), ['!=', ['==', ['primitive', 1], ['primitive', 2]], ['primitive', 3]])
        assertStructurallySame(expression('1!==2!=3'), ['!=', ['!==', ['primitive', 1], ['primitive', 2]], ['primitive', 3]])
        assertStructurallySame(expression('1<2!=3+4&5'), ['&', ['!=', ['<', ['primitive', 1], ['primitive', 2]], ['+', ['primitive', 3], ['primitive', 4]]], ['primitive', 5]])
        const ast = assertOk(parseFromTokens(tokenizeString('export default 1!="1";')))
        assertStructurallySame(ast.body, { statements: [], exit: ['yield', ['object', [[':', 'default', ['!=', 1, '1']]]]] })
        assertOk(parseFromTokens(tokenizeString('export default (a,b)=>a!=b;')))
        assertEq(assertError(parseFromTokens(tokenizeString('export default missing!=1;'))).message, 'const not found')
        assertEq(assertError(parseFromTokens(tokenizeString('export default 1!=missing;'))).message, 'const not found')
    },
    resolvedSourceRetainsTheTag: () => {
        const ast = assertOk(parseFromTokens(tokenizeString('export default 1=="1";')))
        assertStructurallySame(ast.body, { statements: [], exit: ['yield', ['object', [[':', 'default', ['==', 1, '1']]]]] })
        assertOk(parseFromTokens(tokenizeString('export default (a,b)=>a==b;')))
    },
    malformedOperandsAndUnboundNamesRemainErrors: () => {
        for (const source of ['export default ==1;', 'export default 1==;', 'export default 1!=;']) {
            assertError(parseSyntax(tokenizeString(source)))
        }
        assertEq(assertError(parseFromTokens(tokenizeString('export default missing==1;'))).message, 'const not found')
        assertEq(assertError(parseFromTokens(tokenizeString('export default 1==missing;'))).message, 'const not found')
    },
})
