/**
 * Compiler demo integration with the real host `catch` effect. A FunctionalScript
 * proof can inject a failed operation, but cannot catch the interpreter's actual
 * JavaScript stack overflow. Keep that host boundary and its recovery here.
 */

import { asyncRun } from '../effects/module.mjs'
import { commonOperationMap } from '../effects/common/module.mjs'
import { assert, assertEq, assertOk } from '../asserts/module.f.js'
import { demo } from './demo.f.mjs'
import { examples } from './examples/module.f.js'
import { htmlToString } from '../media/html/module.f.mjs'
import { textOfResult } from '../text/marked/module.f.mjs'

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
        assertEq(state.text, edited)
        for (const result of state.panes.slice(0, 2)) {
            const text = textOfResult(result)
            assertEq(result[0], 'error')
            assert(text.startsWith('Could not compile this output:'), text)
        }
        assertEq(state.panes.slice(2).map(([tag]) => tag).join(), 'ok,ok,ok')
        const shown = htmlToString(demo.view(state))
        assert(shown.includes('Copy .js output'), shown)
        assert(shown.includes('Copy .edag.data.js output'), shown)
        assert(shown.includes('Copy .rs output'), shown)
        const recovered = assertOk(await run(demo.update(state)({ kind: 'input', name: 'compiler', value: source })))
        assertEq(textOfResult(recovered.panes[0]), '9')
        assertEq(recovered.panes.map(([tag]) => tag).join(), 'ok,ok,ok,ok,ok')
    },
})
