import { assert, assertEq } from '../../../fjs/asserts/module.f.js'
import { report, reportText, suggestedText } from '../../../fjs/compiler/refused_demo/module.f.mjs'
import alternative from './alternative.f.js'
import { demo, sample, suggestion } from './demo.f.mjs'

export const proof = {
    // `mod.throw-position` (spec/todo/refused-constructs.md): refused at the `export` after the `throw`.
    refused: () => {
        const r = report(sample)
        assert(r[0] === 'error', 'mod.throw-position is accepted')
        assertEq(reportText(sample)(r[1]), [
            'sample.mjs:2:1 - error: unexpected token',
            '2 | export default 2;',
            '  | ^',
        ].join('\n'))
        // The other order is refused at the `throw`.
        const after = report('export default 2;\nthrow 1;\n')
        assert(after[0] === 'error')
        assertEq(after[1][1], 'sample.mjs:2:1 - error: unexpected token')
    },
    alternative: () => assertEq(alternative, 2),
    // The proposed message is at the `export`, and its fix is the alternative's line.
    suggested: () => {
        const r = report(sample)
        assert(r[0] === 'error')
        const text = suggestedText(suggestion)(sample)(r[1])
        assert(text.includes('  | ^^^^^^ '), text)
        assert(text.includes(`\n          ${suggestion.fix}\n`), text)
    },
    demo: () => assertEq(demo.init.source[0], 'loading'),
}
