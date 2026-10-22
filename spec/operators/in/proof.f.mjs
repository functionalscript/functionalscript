import { assert, assertEq } from '../../../fjs/asserts/module.f.js'
import { report, reportText, suggestedText } from '../../../fjs/compiler/refused_demo/module.f.mjs'
import alternative from './alternative.f.js'
import { demo, sample, suggestion } from './demo.f.mjs'

export const proof = {
    // `op.in` (spec/todo/refused-constructs.md): refused at the `in`.
    refused: () => {
        const r = report(sample)
        assert(r[0] === 'error', 'in is accepted')
        assertEq(reportText(sample)(r[1]), [
            'sample.mjs:1:27 - error: unexpected token',
            '1 | export default "toString" in {};',
            '  |                           ^',
        ].join('\n'))
    },
    // `{}` owns no `toString`: the question FunctionalScript answers instead.
    alternative: () => assert(alternative === false),
    // The proposed message is at the same token, and its fix is the alternative's line.
    suggested: () => {
        const r = report(sample)
        assert(r[0] === 'error')
        const text = suggestedText(suggestion)(sample)(r[1])
        assert(text.includes('  |                           ^^ '), text)
        assert(text.includes('          export default hasEntry({}, "toString");'), text)
    },
    demo: () => assertEq(demo.init.source[0], 'loading'),
}
