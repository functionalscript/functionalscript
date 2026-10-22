import { assert, assertEq } from '../../../fjs/asserts/module.f.js'
import { report, suggestedText } from '../../../fjs/compiler/refused_demo/module.f.mjs'
import alternative from './alternative.f.js'
import { demo, suggestion } from './demo.f.mjs'

/** The text of `sample.mjs`. */
const sample = "/** @type {() => number} */\nconst f = () => {\n    return 1;\n    const a = 2;\n};\nexport default f();\n"

export const proof = {
    // `st.unreachable` (spec/todo/refused-constructs.md): the message and the position.
    refused: () => {
        const r = report(sample)
        assert(r[0] === 'error', 'st.unreachable is accepted')
        assertEq(r[1][1], "sample.mjs:4:5 - error: unexpected token")
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
