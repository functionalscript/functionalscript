/**
 * source, as one program. {@link generators} is the regeneration, in the
 * subprocess; {@link lock} remains a separate legacy dependency-update API.
 * @module
 * @import { NodeProgram } from '../../effects/node/types.ts'
 */

import { foldStep, pureOk } from '../../effects/module.f.mjs'
import { main as clean } from '../clean/module.f.mjs'
import { main as ci } from '../../ci/self/module.f.mjs'
import { main as rustTests } from '../../nanvm/update/module.f.mjs'
import { main as matrix } from '../../media/datajs/vectors/matrix/module.f.mjs'
import { main as fixtures } from '../../nanvm/harness/module.f.mjs'
import { main as demos } from '../../nanvm/demos/module.f.mjs'
import { main as cloudflare } from '../../website/cloudflare/module.f.mjs'

/**
 * The generators, in the order regeneration needs. Each is a `NodeProgram`
 * that writes its outputs and answers an exit code, so the sequence stops at
 * the first that fails, as `&&` did, and the message naming the failure is
 * the generator's own.
 *
 * @type {readonly NodeProgram[]}
 */
export const generators = [
    // nothing — an output no generator writes any more shows up as a
    // deletion, and a generator that needs a previous output, its own or
    // another's, fails.
    clean,
    // lock is refreshed explicitly, not during source generation in CI.
    ci,
    // The NaNVM Rust test corpus, methods table and values fixture, from the
    // shared test data.
    rustTests,
    // The DataJS class-by-role matrix from the vector corpus, with the check
    // that each set's source is the document it denotes.
    matrix,
    // The `nanvm-harness` fixtures compiled to Rust, and the `mod.rs` naming
    // them: the fixture directory is the list.
    fixtures,
    // The WASM demo samples compiled to Rust, and the `mod.rs` naming them.
    demos,
    // The Cloudflare build script, from the Rust pin.
    cloudflare,
]

/**
 * Runs `programs` in order, each with the same options, stopping at the first
 * nonzero exit code and answering it; `0` once every one has answered `0`.
 *
 * @type {(programs: readonly NodeProgram[]) => NodeProgram}
 */
export const sequence = programs => options =>
    foldStep(pureOk(programs), /** @type {0} */ (0), program => () => program(options))

/** @type {NodeProgram} */
export const main = sequence(generators)
