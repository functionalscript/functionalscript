/**
 * Compiler demo integration with the real host `catch` effect. A FunctionalScript
 * proof can inject a failed operation, but cannot catch the interpreter's actual
 * JavaScript stack overflow. Keep that host boundary and its recovery here.
 */

import { asyncRun } from '../effects/module.mjs'
import { commonOperationMap } from '../effects/common/module.mjs'
import { assert, assertEq, assertOk } from '../asserts/module.f.js'
import { demo } from './demo.f.js'
import { examples } from './examples/module.f.js'
import { htmlToString } from '../media/html/module.f.js'
import { textOfResult } from '../text/marked/module.f.js'

const run = asyncRun(commonOperationMap)

export const proof = /** @type {const} */ ({
    stackOverflowRecovery: async () => {
        const source = examples.find(([name]) => name === 'Recursion: Ackermann')?.[1]
        assert(source !== undefined)
        // Ackermann(2, 333) can finish on engines with a larger stack, making
        // it an expensive arithmetic test instead of an overflow test. This
        // non-tail call grows the host stack linearly on every engine.
        /** @type {string} */
        const edited = 'const recurse = n => 1 + recurse(n + 1);\nexport default recurse(0);'
        const state = assertOk(await run(demo.update(demo.init)({ kind: 'input', name: 'compiler', value: edited })))
        assertEq(state.main, edited)
        // Every output written from the module's value initializes it, the
        // two code outputs among them, and overflows; the EDAG is the
        // program as written and needs no initialization.
        assertEq(state.panes.map(([tag]) => tag).join(), 'error,error,error,ok,error')
        for (const result of state.panes.filter(([tag]) => tag === 'error')) {
            const text = textOfResult(result)
            assert(text.startsWith('Could not compile this output:'), text)
        }
        const shown = htmlToString(demo.view(state))
        assert(shown.includes('Copy .edag.data.js output'), shown)
        const recovered = assertOk(await run(demo.update(state)({ kind: 'input', name: 'compiler', value: source })))
        assertEq(textOfResult(recovered.panes[0]), '9')
        assertEq(recovered.panes.map(([tag]) => tag).join(), 'ok,ok,ok,ok,ok')
    },
})
