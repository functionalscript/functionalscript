/**
 * Puts the WASM demo pages' module where the site serves it
 * ([`todo/wasm-demos.md`](../../../../todo/wasm-demos.md)), with each
 * sample's disassembly and marked Rust. The deployment build runs it after building
 * `nanvm-demos` for `wasm32`: `cargo` writes the module under `target/`,
 * which the site does not serve, and this copies it out, making the
 * directory first, and writes each sample's WAT and Rust beside it.
 *
 * **The module is copied as it was built**, its bytes unchanged: the page
 * instantiates what `cargo` wrote, not what [`binary/write`](../../../media/wasm/binary/write/module.f.mjs)
 * would write from it.
 *
 * **A sample's WAT holds only the functions Rust defines in its module**,
 * `nanvm_demos::samples::<sample>`, picked by their names in the module's name
 * section, which this demangles first so the WAT names every function as Rust
 * does: NaNVM and `std` are most of the module and the same for every
 * sample. Each function is printed as [`wat`](../../../media/wasm/wat/module.f.mjs)
 * prints it in the whole module, so a fragment is not a module of its own.
 * Each sample's WAT is written as `<sample>.wat.marked`: the text with each
 * word's kind in a tag ([`text/marked`](../../../text/marked/README.md)'s
 * `toTagged`), which the demo page reads to draw the WAT coloured. No plain
 * `.wat` is written, as nothing reads one; `untagged` gives it.
 *
 * Each sample's Rust is compiled through the same marked output route as the
 * committed `.rs` Cargo builds, then written as `<sample>.rs.marked` beside
 * the WAT. Neither marked asset is committed.
 *
 * Nothing is written until every sample has its WAT and Rust: an input that
 * is no module, a sample with no functions, or a refused compile fails the
 * run with the files as they were. Then each `.wat.marked` or `.rs.marked`
 * in the directory that names no listed sample is removed, so a sample
 * removed or renamed leaves no marked assets behind; other files are kept.
 *
 * `fjs run ./fjs/nanvm/demos/publish/module.f.mjs <built .wasm> <published .wasm> <asset directory> <sample>...`
 *
 * @module
 *
 * @import { NodeProgram, Mkdir, Readdir, ReadWhole, ResolveFileModule, Rm, WriteBytes, WriteFile } from '../../../effects/node/types.ts'
 * @import { Effect, IoChannel } from '../../../effects/types.ts'
 * @import { Write } from '../../../effects/common/types.ts'
 * @import { Module } from '../../../media/wasm/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { Marked } from '../../../text/marked/types.ts'
 * @import { _Checked } from './private.ts'
 * @import { Place } from '../page/types.ts'
 */

import { _compileMarked, noRuntime } from '../../../compiler/module.f.mjs'
import { errorExit } from '../../../effects/common/module.f.mjs'
import { foldStep, forEachStep, history, historyStep, ioError, mapStep, pureError, pureOk, step } from '../../../effects/module.f.mjs'
import { exitStep, mkdir, readdir, readWhole, rm, writeChunks, writeFiles } from '../../../effects/node/module.f.mjs'
import { parse } from '../../../media/wasm/binary/parse/module.f.mjs'
import { functionsMarked } from '../../../media/wasm/wat/module.f.mjs'
import { parent } from '../../../path/module.f.js'
import { demangle } from '../../../rust/demangle/module.f.mjs'
import { toTagged } from '../../../text/marked/module.f.mjs'
import { u8ArrayMsb } from '../../../types/bit_vec/module.f.mjs'
import { error, ok } from '../../../types/result/module.f.js'
import { rustPath, samplePath } from '../page/module.f.mjs'
import { samples as knownSamples } from '../samples/module.f.js'

/**
 * `module` with every function name in its name section demangled.
 *
 * @type {(module: Module) => Module}
 */
export const demangleNames = m => ({
    ...m,
    customs: m.customs.map(c => c.content[0] !== 'name' ? c : {
        ...c,
        content: ['name', c.content[1].map(s => s[0] !== 'function' ? s
            : ['function', s[1].map(([index, name]) => /** @type {const} */ ([index, demangle(name)]))])],
    }),
})

/**
 * Each sample's WAT, as `[sample, marked]`, or why one has none: the
 * functions of `module`, by their demangled names, whose path is in
 * `nanvm_demos::samples::<sample>::`, in the order the module defines them.
 *
 * @type {(module: Module, samples: readonly string[]) => Result<readonly (readonly [string, Marked])[], string>}
 */
export const sampleWats = (m, samples) => {
    const named = demangleNames(m)
    const imported = m.imports.filter(({ desc }) => desc[0] === 'func').length
    /** @type {ReadonlyMap<number, string>} */
    const names = new Map(named.customs.flatMap(({ content }) => content[0] === 'name' ? content[1] : [])
        .flatMap(s => s[0] === 'function' ? s[1] : []))
    const texts = functionsMarked(named)
    /** @type {(sample: string) => Marked} */
    const wat = sample => {
        const path = `nanvm_demos::samples::${sample}::`
        return texts.filter((_, k) => (names.get(imported + k) ?? '').includes(path)).flat()
    }
    const wats = samples.map(sample => /** @type {const} */ ([sample, wat(sample)]))
    const missing = wats.find(([, marked]) => marked.length === 0)
    return missing === undefined ? ok(wats) : error(`no functions of the sample \`${missing[0]}\``)
}

/** The file extension of a published sample's WAT. */
const watExtension = '.wat.marked'

/** The file extension of a published sample's Rust. */
const rustExtension = '.rs.marked'

/**
 * Removes each marked WAT or Rust file in `directory` that names none of
 * `samples`.
 *
 * @type {(directory: string, samples: readonly string[]) => Effect<Readdir | Rm, void, IoChannel>}
 */
const removeStale = (directory, samples) => step(
    readdir(directory, {}),
    entries => forEachStep(
        pureOk(entries.filter(({ name, isFile }) => isFile && [watExtension, rustExtension].some(extension =>
            name.length > extension.length && name.endsWith(extension) && !samples.includes(name.slice(0, -extension.length))))),
        ({ name }) => rm(`${directory}/${name}`)))

/**
 * Each sample's Rust, compiled against the committed output's path so its
 * generated text is exactly what the plain sample generator writes.
 *
 * @type {(samples: readonly Place[]) => Effect<ReadWhole | ResolveFileModule, readonly (readonly [string, Marked])[], IoChannel>}
 */
const sampleRusts = samples => foldStep(
    pureOk(samples),
    /** @type {readonly (readonly [string, Marked])[]} */ ([]),
    ({ name, directory }) => rusts => step(
        _compileMarked(noRuntime)(samplePath(directory), rustPath(name)),
        ([tag, value]) => tag === 'error'
            ? pureError(ioError({ message: value }))
            : pureOk([...rusts, [name, value]])))

/**
 * The module at `from`, read and parsed, with each sample's WAT and compiled
 * Rust, or why there is none, naming the input that was refused.
 *
 * @type {(from: string, samples: readonly Place[]) => Effect<ReadWhole | ResolveFileModule, _Checked, IoChannel>}
 */
const check = (from, samples) => {
    const wat = step(readWhole(from), chunks => {
        const parsed = parse(chunks.flatMap(u8ArrayMsb))
        const wats = parsed[0] === 'error' ? parsed : sampleWats(parsed[1], samples.map(({ name }) => name))
        return wats[0] === 'error'
            ? pureError(ioError({ message: `${from}: ${wats[1]}` }))
            : pureOk({ chunks, wats: wats[1] })
    })
    const rust = historyStep(history(wat), () => sampleRusts(samples))
    return mapStep(rust, ([rusts, checked]) => ({ ...checked, rusts }))
}

/**
 * Writes what {@link check} read: the module's chunks to `to` and each
 * sample's WAT and Rust to `directory`, making each directory first, then
 * removes any other marked WAT or Rust there.
 *
 * @type {(to: string, directory: string, samples: readonly Place[]) => (checked: _Checked) => Effect<Mkdir | WriteFile | WriteBytes | Rm | Readdir, void, IoChannel>}
 */
const save = (to, directory, samples) => ({ chunks, wats, rusts }) => {
    const madeTo = mkdir(parent(to), { recursive: true })
    const copied = step(madeTo, () => writeChunks(to, chunks))
    const madeAssets = step(copied, () => mkdir(directory, { recursive: true }))
    const written = step(madeAssets, () => writeFiles([
        ...wats.map(([sample, marked]) => /** @type {const} */ ([`${directory}/${sample}${watExtension}`, toTagged(marked)])),
        ...rusts.map(([sample, marked]) => /** @type {const} */ ([`${directory}/${sample}${rustExtension}`, toTagged(marked)])),
    ]))
    return step(written, () => removeStale(directory, samples.map(({ name }) => name)))
}

/**
 * Copies `from` to `to`, and writes each sample's WAT and compiled Rust to
 * `<sample>.wat.marked` and `<sample>.rs.marked` in `directory`, making each
 * directory first, then removes marked assets of any other sample there.
 *
 * @type {(from: string, to: string, directory: string, samples: readonly Place[]) => Effect<ReadWhole | ResolveFileModule | Mkdir | WriteFile | WriteBytes | Rm | Readdir, void, IoChannel>}
 */
export const publish = (from, to, directory, samples) =>
    step(check(from, samples), save(to, directory, samples))

/** The command line, when it has too few arguments. */
export const usage = 'usage: fjs run ./fjs/nanvm/demos/publish/module.f.mjs <built .wasm> <published .wasm> <asset directory> <sample>...'

/** @type {NodeProgram} */
export const main = ({ args }) => {
    const [from, to, directory, ...names] = args
    if (from === undefined || to === undefined || directory === undefined) { return errorExit(usage) }
    const unknown = names.find(name => !knownSamples.some(sample => sample.name === name))
    return unknown !== undefined
        ? errorExit(`unknown sample \`${unknown}\``)
        : exitStep(publish(from, to, directory, names.flatMap(name => knownSamples.filter(sample => sample.name === name))))
}
