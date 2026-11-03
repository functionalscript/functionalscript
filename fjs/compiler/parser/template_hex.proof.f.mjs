/** Template hexadecimal escapes preserve the existing UTF-16 and FAST values. */

import { assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { normalize } from '../../js/ast/sugar/module.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'
import { parseFromTokens } from './module.f.mjs'
import { _evaluate, stringifyModule, tokenizeString } from './proof.f.mjs'

export const proof = /** @type {const} */ ({
    everyByteMatchesUnicode: () => {
        const digits = Array.from({ length: 0x100 }, (_, value) => value.toString(16).padStart(2, '0'))
        const hex = assertOk(parseFromTokens(tokenizeString('export default `' + digits.map(value => '\\x' + value).join('') + '`;')))
        const unicode = assertOk(parseFromTokens(tokenizeString('export default `' + digits.map(value => '\\u00' + value).join('') + '`;')))
        assertStructurallySame(normalize(hex, []), normalize(unicode, []))
        assertStructurallySame(stringifyModule(hex), stringifyModule(unicode))
        assertStructurallySame(assertOk(toData(_evaluate(hex))), { default: String.fromCharCode(...digits.map(value => parseInt(value, 16))) })
    },
    substitutionsAndFixedWidth: () => {
        const hex = assertOk(parseFromTokens(tokenizeString('export default `\\x008${1}\\x80${2}\\xFf\\x414\\x5cx41`;')))
        const unicode = assertOk(parseFromTokens(tokenizeString('export default `\\u00008${1}\\u0080${2}\\u00ff\\u00414\\u005cx41`;')))
        assertStructurallySame(normalize(hex, []), normalize(unicode, []))
        assertStructurallySame(assertOk(toData(_evaluate(hex))), { default: '\u000081\u00802\u00ffA4\\x41' })
    },
    malformedEscapesRemainErrors: () => {
        for (const escape of ['\\x', '\\x8', '\\x8?', '\\xG0', '\\x0G', '\\x{80}']) {
            for (const template of ['`' + escape + '`', '`' + escape + '${1}`', '`${1}' + escape + '${2}`', '`${1}' + escape + '`']) {
                assertError(parseFromTokens(tokenizeString('export default ' + template + ';')))
            }
        }
    },
})
