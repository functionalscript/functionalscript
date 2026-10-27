/**
 * The cache's committed-input completeness contract against the real checkout.
 * Pure selector fixtures cannot discover files newly tracked by that checkout;
 * this host proof enumerates its actual HEAD through Git and requires every
 * committed file to be classified or explicitly excluded.
 */

import { assertNotNullish, assertOk } from '../../../asserts/module.f.js'
import { step } from '../../../effects/module.f.mjs'
import { execFile } from '../../../effects/node/module.f.mjs'
import { runNodeEffect } from '../../../effects/node/module.mjs'
import { ascii } from '../../../ebnf/byte/module.f.mjs'
import { tryFromHexOf } from '../../../git/oid/module.f.mjs'
import { committedFiles, inputTrees } from '../module.f.mjs'

export const proof = /** @type {const} */ ({
    completeCheckout: async () => {
        const { stdout } = assertOk(await runNodeEffect(execFile('git', ['rev-parse', 'HEAD'])))
        const hex = stdout.trim()
        const width = assertNotNullish(hex.length === 40 ? 20 : hex.length === 64 ? 32 : null)
        const commit = assertNotNullish(tryFromHexOf(width)(ascii(hex)))
        assertOk(await runNodeEffect(step(committedFiles(width)(commit), inputTrees)))
    },
})
