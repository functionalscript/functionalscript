import { assert, assertEq } from '../../../../fjs/asserts/module.f.js'
import { report, suggestedText } from '../../../../fjs/compiler/refused_demo/module.f.mjs'
import entry from './sample.mjs'
import alternative from './alternative.f.js'
import { demo, suggestion } from './demo.f.mjs'

/** The text of `sample.mjs`. */
const sample = "/** @type {(n: number) => string} */\nconst name = n => {\n    switch (n) {\n        default: { return \"many\"; }\n        case 1: { return \"one\"; }\n    }\n};\nexport default name(1);\n"

export const proof = {
    // What JavaScript answers, which the refusal keeps FunctionalScript from contradicting.
    javaScript: () => assertEq(String(entry), "one"),
    // `st.switch-default` (spec/todo/refused-constructs.md): the message and the position.
    refused: () => {
        const r = report(sample)
        assert(r[0] === 'error', 'st.switch-default is accepted')
        assertEq(r[1][1], "sample.mjs:4:9 - error: unexpected token")
    },
    alternative: () => assertEq(String(alternative), "one"),
    // The proposed message is at the refused token, and its fix is the alternative's line.
    suggested: () => {
        const r = report(sample)
        assert(r[0] === 'error')
        const text = suggestedText(suggestion)(sample)(r[1])
        assert(text.includes(`\n          ${suggestion.fix}\n`), text)
    },
    demo: () => assertEq(demo.init.source[0], 'loading'),
}
