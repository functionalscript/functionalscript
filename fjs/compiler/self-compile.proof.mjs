/**
 * Self-compilation must serialize the real EDAG validator, including the
 * conditional checks for an indexed self. Read its source and imports through
 * the same FunctionalScript output route the compiler uses for itself.
 */

import { fileURLToPath } from 'node:url'
import { assertNotNullish, assertOk } from '../asserts/module.f.js'
import { runNodeEffect } from '../effects/node/module.mjs'
import { noRuntime, outputText } from './module.f.js'

export const proof = {
    indexedSelfValidatorCompilesToSource: async () => {
        const input = fileURLToPath(new URL('../edag/analysis/module.f.js', import.meta.url))
        const write = assertNotNullish(outputText(noRuntime)('analysis.f.js'))
        const output = assertOk(await runNodeEffect(write(input)))
        assertOk(output)
    },
}
