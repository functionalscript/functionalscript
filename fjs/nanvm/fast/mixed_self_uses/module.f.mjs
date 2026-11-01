/**
 * Compile the shared mixed-self graph without evaluating its callable body.
 * The native harness observes closed captures, ordinary calls and tail loops.
 *
 * @module
 */

import { _mixedSelfUses } from '../../../edag/to_fast/tail/fixtures.f.js'
import { generate as generateRust } from '../../../compiler/rust/module.f.mjs'

export const path = /** @type {const} */ ('nanvm/harness/gen.fast/mixed_self_uses.rs')

/** Preserve one public self and the shared ordinary call through the backend. @type {() => string} */
export const generate = () => [
    '// Fixture source: `fjs/nanvm/fast/mixed_self_uses/module.f.mjs`; regenerate with `npm run gen`.',
    generateRust(_mixedSelfUses()),
].join('\n').split('\n').map(line => line.trimEnd()).join('\n')
