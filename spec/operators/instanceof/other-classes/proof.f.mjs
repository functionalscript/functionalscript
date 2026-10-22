import { assert, assertEq } from '../../../../fjs/asserts/module.f.js'
import { report, suggestedText } from '../../../../fjs/compiler/refused_demo/module.f.mjs'
import entry from './sample.mjs'
import alternative from './alternative.f.js'
import { demo, suggestion } from './demo.f.mjs'

/** The text of `sample.mjs`. */
const sample = "export default [] instanceof Map;\n"

export const proof = {
    // What JavaScript answers, which the refusal keeps FunctionalScript from contradicting.
    javaScript: () => assertEq(String(entry), "false"),
    // `op.instanceof` (spec/todo/refused-constructs.md): the message and the position.
    refused: () => {
        const r = report(sample)
        assert(r[0] === 'error', 'op.instanceof is accepted')
        assertEq(r[1][1], "sample.mjs:1:19 - error: the right operand of instanceof must be Array")
    },
    alternative: () => assertEq(String(alternative), "true"),
    // The proposed message is at the refused token, and its fix is the alternative's line.
    suggested: () => {
        const r = report(sample)
        assert(r[0] === 'error')
        const text = suggestedText(suggestion)(sample)(r[1])
        assert(text.includes(`\n          ${suggestion.fix}\n`), text)
    },
    demo: () => assertEq(demo.init.source[0], 'loading'),
}
