/**
 * Compile the shared EDAG fixtures for independent terminal recipes to Rust.
 * Callable bodies remain symbolic until the native harness executes them.
 *
 * @module
 */

import { _independentTailRecipes } from '../../../edag/to_fast/tail/fixtures.f.js'
import { generate as generateRust } from '../../../compiler/rust/module.f.mjs'

export const path = /** @type {const} */ ('nanvm/harness/gen.fast/independent_tail_recipes.rs')

/** Preserve the physical sharing of each recipe through the Rust backend. @type {() => string} */
export const generate = () => [
    '// Fixture source: `fjs/nanvm/fast/independent_tail_recipes/module.f.mjs`; regenerate with `npm run gen`.',
    generateRust(['{}', Object.entries(_independentTailRecipes())
        .map(([name, fn]) => /** @type {const} */ ([':', name, fn]))]),
].join('\n').split('\n').map(line => line.trimEnd()).join('\n')
