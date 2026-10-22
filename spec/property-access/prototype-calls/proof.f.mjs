import { assert, assertEq } from '../../../fjs/asserts/module.f.js'
import { report, suggestedText } from '../../../fjs/compiler/refused_demo/module.f.mjs'
import entry from './sample.mjs'
import alternative from './alternative.f.js'
import { demo, suggestion } from './demo.f.mjs'

/** The text of `sample.mjs`. */
const sample = "export default ({ a: 1 }).hasOwnProperty(\"a\");\n"

export const proof = {
    // What JavaScript answers, which the refusal keeps FunctionalScript from contradicting.
    javaScript: () => assertEq(String(entry), "true"),
    // `acc.prototype-call` (spec/todo/refused-constructs.md): the message and the position.
    refused: () => {
        const r = report(sample)
        assert(r[0] === 'error', 'acc.prototype-call is accepted')
        assertEq(r[1][1], "sample.mjs:1:27 - error: prohibited member function")
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
