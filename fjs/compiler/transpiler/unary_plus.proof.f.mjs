/** Represented interpretation never bypasses deferred AST-to-FAST lowering. */

import { assertEq, assertError } from '../../asserts/module.f.js'
import { utf8 } from '../../text/module.f.js'
import { virtualAt } from '../../effects/node/virtual/module.f.js'
import { interpret, noRuntime } from './module.f.mjs'

export const proof = /** @type {const} */ ({
    returnsAFileDiagnosticBeforeInitialization: () => {
        for (const source of ['export default +1;', 'export default +1n;', 'export default (a,x)=>a[+x];']) {
            const result = virtualAt({ 'input.f.js': [utf8(source)] })(interpret(noRuntime)('input.f.js'))[1]
            const refusal = assertError(result)
            assertEq(refusal.message, 'unary + AST-to-FAST conversion is not implemented')
            assertEq(refusal.metadata, null)
        }
    },
})
