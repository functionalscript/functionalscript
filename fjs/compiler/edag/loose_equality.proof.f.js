/** EDAG linking preserves an explicit AST-to-FAST refusal, shown by loose equality, whose lowering is deferred. */

import { assertEq, assertError, assertOk } from '../../asserts/module.f.js'
import { utf8 } from '../../text/module.f.js'
import { virtualAt } from '../../effects/node/virtual/module.f.js'
import { parse } from '../source/module.f.js'
import { resolve, tryUnresolved, unresolved } from './module.f.js'

export const proof = /** @type {const} */ ({
    reportsDeferredLoweringBeforeGraphConstruction: () => {
        const source = /** @type {const} */ ('export default (a,x)=>a==x;')
        const ast = assertOk(parse('input.f.js')(source))
        assertEq(assertError(tryUnresolved(ast)), '== AST-to-FAST conversion is not implemented')
        const result = virtualAt({ 'input.f.js': [utf8(source)] })(resolve('input.f.js'))[1]
        const refusal = assertError(result)
        assertEq(refusal.message, '== AST-to-FAST conversion is not implemented')
        assertEq(refusal.metadata, null)
    },
    throw: {
        strictGraphConstructionKeepsTheRefusal: () => unresolved(assertOk(parse('input.f.js')('export default 1==1;'))),
    },
})
