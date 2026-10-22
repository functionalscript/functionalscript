import { assert, assertEq } from '../../../fjs/asserts/module.f.js'
import { report, reportText } from '../../../fjs/compiler/refused_demo/module.f.mjs'
import entry from './sample.mjs'
import { demo } from './demo.f.mjs'

/** The text of `sample.mjs`. */
const sample = 'export default "toString" in {};\n'

export const proof = {
    // JavaScript finds `toString` on the prototype chain: the reason `in` is refused.
    javaScript: () => assert(entry === true),
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
    demo: () => assertEq(demo.init[0], 'loading'),
}
