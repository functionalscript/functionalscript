/** Compiler consumers report deferred unary-plus lowering as an ordinary file error. */

import { assertEq, assertError } from '../asserts/module.f.js'
import { utf8 } from '../text/module.f.mjs'
import { virtualAt } from '../effects/node/virtual/module.f.mjs'
import { resolve } from './edag/module.f.mjs'
import { interpret, noRuntime } from './transpiler/module.f.mjs'
import { moduleRefused } from './proof.f.mjs'

export const proof = /** @type {const} */ ({
    linkingAndInterpretingReportTheConversionBoundary: () => {
        for (const source of ['export default +1;', 'export default (a,x)=>a[+x];', 'export default +1n;']) {
            const files = /** @type {const} */ ({ 'input.f.js': [utf8(source)] })
            const linked = assertError(virtualAt(files)(resolve('input.f.js'))[1])
            const interpreted = assertError(virtualAt(files)(interpret(noRuntime)('input.f.js'))[1])
            assertEq(linked.message, 'unary + AST-to-FAST conversion is not implemented')
            assertEq(interpreted.message, linked.message)
            assertEq(linked.metadata, null)
            assertEq(moduleRefused(source).includes(linked.message), true)
        }
    },
})
