/** Unary plus retains its own source node, precedence and ordinary binding checks. */

/** @import { Node } from './syntax/types.ts' */

import { assert, assertEq, assertError, assertNotNullish, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { parseFromTokens } from './module.f.mjs'
import { tokenizeString } from './proof.f.mjs'
import { parseSyntax } from './syntax/module.f.mjs'

/** @type {(source: string) => Node} */
const expression = source => assertNotNullish(assertOk(parseSyntax(tokenizeString('export default ' + source + ';'))).exported).value

export const proof = /** @type {const} */ ({
    arityAndPrecedence: () => {
        assertStructurallySame(expression('+1'), ['+', ['primitive', 1]])
        assertStructurallySame(expression('+ - +2'), ['+', ['-', ['+', ['primitive', 2]]]])
        assertStructurallySame(expression('+1+2*3'), ['+', ['+', ['primitive', 1]], ['*', ['primitive', 2], ['primitive', 3]]])
        assertStructurallySame(expression('2**+3'), ['**', ['primitive', 2], ['+', ['primitive', 3]]])
        assertStructurallySame(expression('(+2)**3'), ['**', ['+', ['primitive', 2]], ['primitive', 3]])
        const resolved = assertOk(parseFromTokens(tokenizeString('export default +1n;')))
        assertStructurallySame(resolved.body, { statements: [], exit: ['yield', ['object', [[':', 'default', ['+', 1n]]]]] })
    },
    numericIndexAndOptionalChainAreAdmitted: () => {
        for (const source of ['export default (a,x)=>a[+x];', 'export default (a,x)=>a?.[+x];', 'export default (a,x)=>a?.[+x].value;']) {
            assertOk(parseSyntax(tokenizeString(source)))
            assertOk(parseFromTokens(tokenizeString(source)))
        }
    },
    malformedPrefixesAndBindingsStillFail: () => {
        for (const source of ['export default +2**3;', 'export default - +2**3;', 'export default ++2;', 'export default +;', 'export default +x=>x;']) {
            assertError(parseSyntax(tokenizeString(source)))
        }
        assertEq(assertError(parseFromTokens(tokenizeString('export default +missing;'))).message, 'const not found')
        assertEq(assertError(parseFromTokens(tokenizeString('export default (a)=>a[+missing];'))).message, 'const not found')
        const deep = expression('+ '.repeat(512) + '1')
        assert(deep[0] === '+' && deep.length === 2)
    },
})
