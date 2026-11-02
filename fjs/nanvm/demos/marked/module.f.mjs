/**
 * Writes each WASM demo sample's Rust with each word's kind in a tag
 * ([`text/marked`](../../../text/marked/README.md)'s `toTagged`) where its
 * page reads it to draw the Rust coloured: `<name>.rs.marked` in the ignored
 * `nanvm/demos/wasm/`, beside the sample's WAT.
 *
 * **Written when the site is built, not committed.** Only the page reads a
 * marked file, so it is a build asset like the WAT
 * ([`publish`](../publish/module.f.mjs)), and the committed tree holds the
 * `.rs` `cargo` builds and nothing more. The deploy's build script,
 * `nanvm/demos/gen.build.sh`, runs this after `publish`.
 *
 * Each sample is compiled as [`generate`](../module.f.mjs) compiles it, so a
 * marked file's text is its committed `.rs`, byte for byte. A sample the
 * compiler refuses fails the run there. Then each `.rs.marked` in the
 * directory that names no listed sample is removed, as `publish` removes a
 * stale WAT; any other file there is kept.
 *
 * `fjs run ./fjs/nanvm/demos/marked/module.f.mjs`
 *
 * @module
 *
 * @import { IoChannel, NodeProgram } from '../../../effects/node/types.ts'
 * @import { Effect } from '../../../effects/types.ts'
 * @import { _CompileOp } from '../../../compiler/types.ts'
 * @import { FunctionPlace, Place } from '../page/types.ts'
 */

import { forEachStep, pureOk, step } from '../../../effects/module.f.mjs'
import { exitStep, writeFiles } from '../../../effects/node/module.f.mjs'
import { toTagged } from '../../../text/marked/module.f.mjs'
import { compileSample, samples } from '../module.f.mjs'
import { buildDirectory, rustMarkedExtension, rustMarkedPath } from '../page/module.f.mjs'
import { removeStale } from '../publish/module.f.mjs'

/**
 * Compiles each of `places`, in order, stopping at the first the compiler
 * refuses, writing each one's marked Rust as it goes; then removes the
 * marked Rust of any sample not among them.
 *
 * @type {(places: readonly (Place | FunctionPlace)[]) => Effect<_CompileOp, void, IoChannel>}
 */
export const writeMarked = places => step(
    forEachStep(pureOk(places), place => step(compileSample(place), marked => writeFiles([[rustMarkedPath(place.name), toTagged(marked)]]))),
    () => removeStale(rustMarkedExtension)(buildDirectory, places.map(({ name }) => name)))

/** @type {NodeProgram} */
export const main = _options => exitStep(writeMarked(samples))
