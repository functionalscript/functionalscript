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
 * Each sample is compiled by the route `fjs compile` takes to the committed
 * `.rs` ([`generate`](../module.f.mjs)), up to the text it writes, so a
 * marked file's text is its `.rs`, byte for byte.
 *
 * Nothing is written until every sample has its marked Rust: a sample the
 * compiler refuses fails the run with the files as they were, as `publish`
 * does. Then each `.rs.marked` in the directory that names no listed sample
 * is removed, as `publish` removes a stale WAT; any other file there is kept.
 *
 * `fjs run ./fjs/nanvm/demos/marked/module.f.mjs`
 *
 * @module
 *
 * @import { IoChannel, NodeProgram } from '../../../effects/node/types.ts'
 * @import { Effect } from '../../../effects/types.ts'
 * @import { _CompileOp } from '../../../compiler/types.ts'
 * @import { FunctionPlace, Place } from '../page/types.ts'
 * @import { Marked } from '../../../text/marked/types.ts'
 */

import { _compileMarked, noRuntime } from '../../../compiler/module.f.mjs'
import { foldStep, ioError, pureError, pureOk, step } from '../../../effects/module.f.js'
import { exitStep, writeFiles } from '../../../effects/node/module.f.js'
import { toTagged } from '../../../text/marked/module.f.mjs'
import { samples } from '../samples/module.f.js'
import { buildDirectory, rustMarkedExtension, rustMarkedPath, rustPath, samplePath } from '../page/module.f.mjs'
import { removeStale } from '../publish/module.f.mjs'

/**
 * Each of `places` compiled, in order, as `[name, marked]`, or the first
 * refusal, as `fjs compile` reports it.
 *
 * @type {(places: readonly (Place | FunctionPlace)[]) => Effect<_CompileOp, readonly (readonly [string, Marked])[], IoChannel>}
 */
const compiled = places => foldStep(
    pureOk(places),
    /** @type {readonly (readonly [string, Marked])[]} */ ([]),
    ({ name, directory }) => done => step(
        _compileMarked(noRuntime)(samplePath(directory), rustPath(name)),
        ([tag, value]) => tag === 'error' ? pureError(ioError({ message: value })) : pureOk([...done, [name, value]])))

/**
 * Compiles every one of `places`, then writes each one's marked Rust, then
 * removes the marked Rust of any sample not among them.
 *
 * @type {(places: readonly (Place | FunctionPlace)[]) => Effect<_CompileOp, void, IoChannel>}
 */
export const writeMarked = places => step(
    compiled(places),
    rusts => step(
        writeFiles(rusts.map(([name, marked]) => [rustMarkedPath(name), toTagged(marked)])),
        () => removeStale(rustMarkedExtension)(buildDirectory, places.map(({ name }) => name))))

/** @type {NodeProgram} */
export const main = _options => exitStep(writeMarked(samples))
