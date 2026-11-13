/** Vertical-tab template chunks decode to the established UTF-16 and FAST values. */

import { assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { normalize } from '../../js/ast/sugar/module.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'
import { parseFromTokens } from './module.f.mjs'
import { _evaluate, stringifyModule, tokenizeString } from './proof.f.mjs'

export const proof = /** @type {const} */ ({
    sharesUnicodeValuesInEveryChunk: () => {
        for (const [escaped, unicode, expected] of /** @type {const} */ ([
            ['`\\v`', '`\\u000b`', '\u000b'],
            ['`\\v${1}\\v${2}\\v`', '`\\u000b${1}\\u000b${2}\\u000b`', '\u000b1\u000b2\u000b'],
            ['`\\v8\\\\v`', '`\\u000b8\\\\v`', '\u000b8\\v'],
        ])) {
            const actual = assertOk(parseFromTokens(tokenizeString('export default ' + escaped + ';')))
            const fixed = assertOk(parseFromTokens(tokenizeString('export default ' + unicode + ';')))
            assertStructurallySame(normalize(actual, []), normalize(fixed, []))
            assertEq(stringifyModule(actual), stringifyModule(fixed))
            assertStructurallySame(assertOk(toData(_evaluate(actual))), { default: expected })
        }
    },
    rawAndOtherEscapeRestrictionsRemain: () => {
        for (const source of ['export default "\\v";', 'export default `\u000b`;', 'export default `\\q`;', 'export default `\\0`;']) {
            assertError(parseFromTokens(tokenizeString(source)))
        }
    },
})
