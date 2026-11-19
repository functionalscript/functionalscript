/** Represented interpretation never bypasses a deferred AST-to-FAST lowering, shown by loose equality. */

import { assertEq, assertError } from '../../asserts/module.f.js'
import { utf8 } from '../../text/module.f.js'
import { virtualAt } from '../../effects/node/virtual/module.f.js'
import { interpret, noRuntime } from './module.f.js'

export const proof = /** @type {const} */ ({
    returnsAFileDiagnosticBeforeInitialization: () => {
        for (const source of ['export default 1==1;', 'export default 1!=2;', 'export default (a,x)=>a==x;']) {
            const result = virtualAt({ 'input.f.js': [utf8(source)] })(interpret(noRuntime)('input.f.js'))[1]
            const refusal = assertError(result)
            assertEq(refusal.message, `${source.includes('!=') ? '!=' : '=='} AST-to-FAST conversion is not implemented`)
            assertEq(refusal.metadata, null)
        }
    },
})
