/** An array-led expression retains its discard record and exact opening token. */

import { assert, assertEq, assertOk } from '../../../asserts/module.f.js'
import { tokenizeString } from '../proof.f.mjs'
import { parseSyntax } from './module.f.mjs'

export const proof = /** @type {const} */ ({
    retainsTheArrayMemberCallAndOpeningToken: () => {
        const module = assertOk(parseSyntax(tokenizeString('[1,2].forEach(f);export default 0;')))
        const statement = module.statements[0]
        assert(statement[0] === 'const')
        const first = statement[1].declaration
        assertEq(first.target[0], 'discard')
        assertEq(first.start.token.kind, '[')
        assertEq(first.start.metadata.column, 1)
        assertEq(first.semicolon, true)
        const node = first.value
        assert(node[0] === '()' && node[1][0] === '.')
        assertEq(node[1][1][0], 'array')
        assert(!(node[1][2] instanceof Array))
        assert(node[1][2].token.kind === 'id')
        assertEq(node[1][2].token.value, 'forEach')
    },
})
