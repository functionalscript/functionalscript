/**
 * Puts the WASM demo pages' module where the site serves it
 * ([`todo/wasm-demos.md`](../../../../todo/wasm-demos.md)), with each
 * sample's disassembly. The deployment build runs it after building
 * `nanvm-demos` for `wasm32`: `cargo` writes the module under `target/`,
 * which the site does not serve, and this copies it out, making the
 * directory first, and writes each sample's WAT beside it.
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
 *
 * Nothing is written until every sample has its WAT: an input that is no
 * module, or a sample with no functions, fails the run with the files as they
 * were. Then each `.wat` in the directory that names no listed sample is
 * removed, so a sample removed or renamed leaves no disassembly behind; any
 * other file there is kept.
 *
 * `fjs run ./fjs/nanvm/demos/publish/module.f.mjs <built .wasm> <published .wasm> <WAT directory> <sample>...`
 *
 * @module
 *
 * @import { NodeProgram, Mkdir, Readdir, ReadWhole, Rm, WriteBytes, WriteFile } from '../../../effects/node/types.ts'
 * @import { Effect, IoChannel } from '../../../effects/types.ts'
 * @import { Write } from '../../../effects/common/types.ts'
 * @import { Module } from '../../../media/wasm/types.ts'
 * @import { Result } from '../../../types/result/types.ts'
 * @import { _Checked } from './private.ts'
 */

import { errorExit } from '../../../effects/common/module.f.mjs'
import { forEachStep, ioError, pureError, pureOk, step } from '../../../effects/module.f.mjs'
import { exitStep, mkdir, readdir, readWhole, rm, writeChunks, writeFiles } from '../../../effects/node/module.f.mjs'
import { parse } from '../../../media/wasm/binary/parse/module.f.mjs'
import { functions } from '../../../media/wasm/wat/module.f.mjs'
import { parent } from '../../../path/module.f.js'
import { demangle } from '../../../rust/demangle/module.f.mjs'
import { u8ArrayMsb } from '../../../types/bit_vec/module.f.mjs'
import { error, ok } from '../../../types/result/module.f.js'

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
 * Each sample's WAT, as `[sample, text]`, or why one has none: the functions
 * of `module`, by their demangled names, whose path is in
 * `nanvm_demos::samples::<sample>::`, in the order the module defines them.
 *
 * @type {(module: Module, samples: readonly string[]) => Result<readonly (readonly [string, string])[], string>}
 */
export const sampleWats = (m, samples) => {
    const named = demangleNames(m)
    const imported = m.imports.filter(({ desc }) => desc[0] === 'func').length
    /** @type {ReadonlyMap<number, string>} */
    const names = new Map(named.customs.flatMap(({ content }) => content[0] === 'name' ? content[1] : [])
        .flatMap(s => s[0] === 'function' ? s[1] : []))
    const texts = functions(named)
    /** @type {(sample: string) => string} */
    const wat = sample => {
        const path = `nanvm_demos::samples::${sample}::`
        return texts.filter((_, k) => (names.get(imported + k) ?? '').includes(path)).join('')
    }
    const wats = samples.map(sample => /** @type {const} */ ([sample, wat(sample)]))
    const missing = wats.find(([, text]) => text === '')
    return missing === undefined ? ok(wats) : error(`no functions of the sample \`${missing[0]}\``)
}

/**
 * Removes each `.wat` in `directory` that names none of `samples`.
 *
 * @type {(directory: string, samples: readonly string[]) => Effect<Readdir | Rm, void, IoChannel>}
 */
const removeStale = (directory, samples) => step(
    readdir(directory, {}),
    entries => forEachStep(
        pureOk(entries.filter(({ name, isFile }) => isFile && name.length > 4 && name.endsWith('.wat')
            && !samples.includes(name.slice(0, -4)))),
        ({ name }) => rm(`${directory}/${name}`)))

/**
 * The module at `from`, read and parsed, with each sample's WAT, or why
 * there is none, naming `from`.
 *
 * @type {(from: string, samples: readonly string[]) => Effect<ReadWhole, _Checked, IoChannel>}
 */
const check = (from, samples) => step(readWhole(from), chunks => {
    const parsed = parse(chunks.flatMap(u8ArrayMsb))
    const wats = parsed[0] === 'error' ? parsed : sampleWats(parsed[1], samples)
    return wats[0] === 'error'
        ? pureError(ioError({ message: `${from}: ${wats[1]}` }))
        : pureOk({ chunks, wats: wats[1] })
})

/**
 * Writes what {@link check} read: the module's chunks to `to` and each
 * sample's WAT to `watDirectory`, making each directory first, then removes
 * any other WAT there.
 *
 * @type {(to: string, watDirectory: string, samples: readonly string[]) => (checked: _Checked) => Effect<Mkdir | WriteFile | WriteBytes | Rm | Readdir, void, IoChannel>}
 */
const save = (to, watDirectory, samples) => ({ chunks, wats }) => {
    const madeTo = mkdir(parent(to), { recursive: true })
    const copied = step(madeTo, () => writeChunks(to, chunks))
    const madeWat = step(copied, () => mkdir(watDirectory, { recursive: true }))
    const written = step(madeWat, () => writeFiles(wats.map(([sample, text]) => [`${watDirectory}/${sample}.wat`, text])))
    return step(written, () => removeStale(watDirectory, samples))
}

/**
 * Copies `from` to `to`, and writes each sample's WAT to `<sample>.wat` in
 * `watDirectory`, making each directory first, then removes any other WAT
 * there.
 *
 * @type {(from: string, to: string, watDirectory: string, samples: readonly string[]) => Effect<ReadWhole | Mkdir | WriteFile | WriteBytes | Rm | Readdir, void, IoChannel>}
 */
export const publish = (from, to, watDirectory, samples) =>
    step(check(from, samples), save(to, watDirectory, samples))

/** The command line, when it has too few arguments. */
export const usage = 'usage: fjs run ./fjs/nanvm/demos/publish/module.f.mjs <built .wasm> <published .wasm> <WAT directory> <sample>...'

/** @type {NodeProgram} */
export const main = ({ args }) => {
    const [from, to, watDirectory, ...samples] = args
    return from === undefined || to === undefined || watDirectory === undefined
        ? errorExit(usage)
        : exitStep(publish(from, to, watDirectory, samples))
}
