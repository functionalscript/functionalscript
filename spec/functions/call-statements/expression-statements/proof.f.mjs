import { assert, assertEq } from '../../../../fjs/asserts/module.f.js'
import { report, suggestedText } from '../../../../fjs/compiler/refused_demo/module.f.mjs'
import alternative from './alternative.f.js'
import { demo, suggestion } from './demo.f.mjs'

/** The text of `sample.mjs`. */
const sample = "/** @type {(o: { readonly x: number }) => number} */\nconst f = o => {\n    o.x;\n    return o.x + 1;\n};\nexport default f({ x: 0 });\n"

export const proof = {
    // `st.expression` (spec/todo/refused-constructs.md): the message and the position.
    refused: () => {
        const r = report(sample)
        assert(r[0] === 'error', 'st.expression is accepted')
        assertEq(r[1][1], "sample.mjs:3:5 - error: unexpected token")
    },
    alternative: () => assertEq(String(alternative), "1"),
    // The proposed message is at the refused token, and its fix is the alternative's line.
    suggested: () => {
        const r = report(sample)
        assert(r[0] === 'error')
        const text = suggestedText(suggestion)(sample)(r[1])
        assert(text.includes(`\n          ${suggestion.fix}\n`), text)
    },
    demo: () => assertEq(demo.init.source[0], 'loading'),
}
