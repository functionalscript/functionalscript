/** Single-quoted hexadecimal and vertical-tab escapes decode before source lowering. */

/** @import { ResolvedModule } from './types.ts' */

import { assertEq, assertError, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { normalize } from '../../js/ast/sugar/module.f.mjs'
import { toData } from '../../edag/value/to_unknown/module.f.mjs'
import { parseFromTokens } from './module.f.mjs'
import { _evaluate, expectRefused, stringifyModule, tokenizeString } from './proof.f.mjs'

/** @type {(source: string) => ResolvedModule} */
const admitted = source => assertOk(parseFromTokens(tokenizeString(source)))

export const proof = /** @type {const} */ ({
    sharesUnicodeEscapeFastAndGraphValues: () => {
        const escaped = admitted("export default ['\\x00\\x09\\x41\\x7f\\x80\\xff\\v', '\\x414'];")
        const unicode = admitted("export default ['\\u0000\\u0009\\u0041\\u007f\\u0080\\u00ff\\u000b', '\\u00414'];")
        assertStructurallySame(normalize(escaped, []), normalize(unicode, []))
        assertEq(stringifyModule(escaped), stringifyModule(unicode))
    },
    valuesAgreeWithNativeJavaScriptLiterals: () => {
        const parsed = admitted("export default ['\\x00\\x7F\\x80\\xFf\\v', '\\x27', '\\x22', '\\x5c', '\\x5cx41'];")
        assertStructurallySame(assertOk(toData(_evaluate(parsed))), {
            default: ['\x00\x7f\x80\xff\v', "'", '"', '\\', '\\x41'],
        })
    },
    importPathsDecodeBeforeResolution: () => {
        const parsed = admitted("import value from './m\\x2ef\\x2ejs'; export default value;")
        assertEq(parsed.imports[0].specifier, './m.f.js')
    },
    decodedNamesRetainPrototypeChecks: () => {
        const proto = /** @type {const} */ ("export default {'\\x5f\\x5fproto__': 1};")
        expectRefused(proto, '__proto__ requires the computed key form', proto.indexOf("'") + 1)
        const access = /** @type {const} */ ("const value={}; export default value['\\x74oString'];")
        expectRefused(access, 'prohibited property name', access.indexOf("'") + 1)
    },
    otherEscapeBoundariesRemainRefused: () => {
        for (const source of [
            'export default "\\x41";',
            'export default "\\v";',
            'export default `\\x41`;',
            'export default `\\v`;',
            "export default '\\x4';",
            "export default '\\x4Z';",
            "export default '\\0';",
            "export default '\\u{41}';",
        ]) { assertError(parseFromTokens(tokenizeString(source))) }
    },
})
