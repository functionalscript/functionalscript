import { assert, assertEq } from '../../../fjs/asserts/module.f.js'
import { report, reportText, suggestedText } from '../../../fjs/compiler/refused_demo/module.f.mjs'
import alternative from './alternative.f.js'
import { demo, sample, suggestion } from './demo.f.mjs'

export const proof = {
    // `mod.import-after-export` (spec/todo/refused-constructs.md): refused at the `import`.
    refused: () => {
        const r = report(sample)
        assert(r[0] === 'error', 'mod.import-after-export is accepted')
        assertEq(reportText(sample)(r[1]), [
            'sample.mjs:2:1 - error: unexpected token',
            '2 | import b from "./a.f.js";',
            '  | ^',
        ].join('\n'))
    },
    alternative: () => assertEq(String(alternative), '1,1'),
    // The proposed message is at the `import`, and its fix is the alternative's line.
    suggested: () => {
        const r = report(sample)
        assert(r[0] === 'error')
        const text = suggestedText(suggestion)(sample)(r[1])
        assert(text.includes('  | ^^^^^^ '), text)
        assert(text.includes(`\n          ${suggestion.fix}\n`), text)
    },
    demo: () => assertEq(demo.init.source[0], 'loading'),
}
