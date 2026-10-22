import { assert, assertEq } from '../../../fjs/asserts/module.f.js'
import { report, suggestedText } from '../../../fjs/compiler/refused_demo/module.f.mjs'
import alternative from './alternative.f.js'
import { demo, suggestion } from './demo.f.mjs'

/** The text of `sample.mjs`. */
const sample = "/** @type {(a: readonly string[], i: number) => string | undefined} */\nconst at = (a, i) => a[i];\nexport default at([\"x\", \"y\"], 1);\n"

export const proof = {
    // `acc.runtime-key` (spec/todo/refused-constructs.md): the message and the position.
    refused: () => {
        const r = report(sample)
        assert(r[0] === 'error', 'acc.runtime-key is accepted')
        assertEq(r[1][1], "sample.mjs:2:24 - error: computed key is not Number(...)")
    },
    alternative: () => assertEq(String(alternative), "y"),
    // The proposed message is at the refused token, and its fix is the alternative's line.
    suggested: () => {
        const r = report(sample)
        assert(r[0] === 'error')
        const text = suggestedText(suggestion)(sample)(r[1])
        assert(text.includes(`\n          ${suggestion.fix}\n`), text)
    },
    demo: () => assertEq(demo.init.source[0], 'loading'),
}
