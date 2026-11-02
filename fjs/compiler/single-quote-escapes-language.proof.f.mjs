/** New single-quote escapes retain the existing string values and canonical outputs. */

import { assertEq } from '../asserts/module.f.js'
import { utf8 } from '../text/module.f.mjs'
import { compileSource, fjsRoundTrip, jsonOf, moduleRefused } from './proof.f.mjs'

export const proof = /** @type {const} */ ({
    outputsAgreeWithUnicodeEscapes: () => {
        const escaped = /** @type {const} */ ("export default ['\\x00\\x09\\x0a\\x41\\x7F\\x80\\xff\\v', '\\x414', '\\x5cx41'];")
        const unicode = /** @type {const} */ ("export default ['\\u0000\\u0009\\u000a\\u0041\\u007f\\u0080\\u00ff\\u000b', '\\u00414', '\\u005cx41'];")
        for (const output of ['output.js', 'output.f.js', 'output.edag.data.js', 'output.json', 'output.data.js', 'output.rs']) {
            assertEq(compileSource(escaped)(output), compileSource(unicode)(output), output)
        }
    },
    decodedKeysAndPatternsUseExistingPropertyNames: () => {
        const source = /** @type {const} */ ("const {'\\x61': value} = {'a':'\\x41'}; export default [value, {'\\x61':'\\v'}.a];")
        assertEq(compileSource(source)('output.json'), '["A","\\u000b"]')
    },
    escapedModulePathsLoadTheDecodedFile: () => {
        assertEq(jsonOf({
            'a.f.js': [utf8("import value from './m\\x2ef\\x2ejs'; export default value;")],
            'm.f.js': [utf8("export default 'A\\v';")],
        }), '"A\\u000b"')
    },
    singleQuotedStringsInsideTemplateExpressionsDecode: () => {
        assertEq(compileSource("export default `${'\\x41'}`;")('output.json'), '"A"')
    },
    emittedSourceReadsBackThroughCanonicalStringEscapes: () => {
        for (const source of [
            "export default '\\x00\\xff\\v';",
            "export default ({'\\x61': value='\\x41'}={}) => value;",
            "const value='\\x27\\x22\\x5c'; export default [value,value];",
        ]) {
            const first = fjsRoundTrip(source)
            assertEq(fjsRoundTrip(first), first)
        }
    },
    doubleQuotedAndTemplateChunksRemainRestricted: () => {
        for (const source of ['export default "\\x41";', 'export default "\\v";', 'export default `\\x41`;', 'export default `\\v`;']) {
            assertEq(moduleRefused(source).includes('unexpected token'), true, source)
        }
    },
})
