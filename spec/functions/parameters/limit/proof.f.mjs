import { assert, assertEq } from '../../../../fjs/asserts/module.f.js'
import { report, suggestedText } from '../../../../fjs/compiler/refused_demo/module.f.mjs'
import alternative from './alternative.f.js'
import { demo, sample, suggestion } from './demo.f.mjs'

export const proof = {
    // `decl.parameter-limit` (spec/todo/refused-constructs.md): the message and the position.
    refused: () => {
        const r = report(sample)
        assert(r[0] === 'error', 'decl.parameter-limit is accepted')
        assertEq(r[1][1], "sample.mjs:2:60 - error: more than 16 fixed parameters")
    },
    alternative: () => assertEq(String(alternative), "17"),
    // The proposed message is at the refused token, and its fix is the alternative's line.
    suggested: () => {
        const r = report(sample)
        assert(r[0] === 'error')
        const text = suggestedText(suggestion)(sample)(r[1])
        assert(text.includes(`\n          ${suggestion.fix}\n`), text)
    },
    demo: () => assertEq(demo.init.source[0], 'loading'),
}
