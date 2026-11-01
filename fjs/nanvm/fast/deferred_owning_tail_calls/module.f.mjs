/**
 * Compile the shared deferred-owning-tail-call FAST fixtures directly to Rust.
 * Callable bodies remain symbolic through graph construction and target output;
 * the native tests execute them after `npm run gen` writes this module.
 *
 * @module
 */

import { _fixtures } from '../../../edag/from_fast/deferred_tail_calls/fixtures.f.mjs'
import { fromFast } from '../../../edag/from_fast/module.f.mjs'
import { generate as generateRust } from '../../../compiler/rust/module.f.mjs'

export const path = /** @type {const} */ ('nanvm/harness/gen.fast/deferred_owning_tail_calls.rs')

/** Preserve the raw functions and their deferred bodies through the Rust backend. @type {() => string} */
export const generate = () => [
    '// Fixture source: `fjs/nanvm/fast/deferred_owning_tail_calls/module.f.mjs`; regenerate with `npm run gen`.',
    generateRust(fromFast({ statements: [], exit: ['yield', [['object', Object.entries(_fixtures())
        .map(([name, fn]) => /** @type {const} */ ([':', name, ['function', fn]]))]]] })),
].join('\n').split('\n').map(line => line.trimEnd()).join('\n')
