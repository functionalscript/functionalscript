/**
 * Writes the Rust of the WASM demo pages' samples
 * ([`todo/wasm-demos.md`](../../../todo/wasm-demos.md)): each sample's
 * `sample.f.js` compiled through the compiler's Rust output into
 * `nanvm/demos/gen.samples/<name>.rs`, and `gen.samples/mod.rs` naming each.
 * The `nanvm-demos` crate reaches the set through one `#[path]` to that
 * `mod.rs`.
 *
 * **And the script that builds the module the pages load**,
 * `nanvm/demos/gen.build.sh`: `nanvm-demos` built for `wasm32`, and
 * [`publish`](./publish/module.f.js) copying it into `nanvm/demos/wasm/`
 * with each sample's WAT beside it, then [`marked`](./marked/module.f.js)
 * writing each sample's Rust there with each word's kind in a tag, which the
 * sample's page reads to draw the Rust coloured. The website deploy builds
 * these ignored assets before generating pages. The script
 * requires the pinned Rust so local builds use the same compiler as deploys.
 *
 * Invoked from `gen`, so the drift check fails when a committed `.rs` is
 * stale. The samples are listed, not found by a walk, in
 * [`samples`](./samples/module.f.js): each one also needs a demo page, so a
 * new sample is never one file. A sample of its own is a directory beside
 * this module; a spec page's example sits with its page, so the page holds
 * its text, its example and its demo.
 *
 * **The calls a function sample lists become Rust tests**, in `mod.rs`
 * beside the exports: each holds the compiled sample to the answer the list
 * states for JavaScript, which the list's host proof holds JavaScript to.
 * So a page whose JavaScript and WebAssembly runs would disagree fails
 * `cargo test`, not a reader's press of Run.
 *
 * @module
 *
 * @import { IoChannel, NodeProgram } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { _CompileOp } from '../../compiler/types.ts'
 * @import { FunctionPlace, ListedCall, Place } from './page/types.ts'
 */

import { rust } from '../../ci/config/module.f.js'
import { compileFile, noRuntime } from '../../compiler/module.f.js'
import { forEachStep, pureOk, step } from '../../effects/module.f.js'
import { exitStep, writeFiles } from '../../effects/node/module.f.js'
import { generatedHeader } from '../../media/rust/item/module.f.js'
import { stringLiteral } from '../../media/rust/module.f.js'
import { cmp } from '../../types/string/module.f.js'
import { buildDirectory, placeName, rustDirectory, rustPath as pageRustPath, samplePath as pageSamplePath, wasmPath } from './page/module.f.js'
import { samples as importedSamples } from './samples/module.f.js'
import { hasEntry } from '../../types/object/entry/module.f.js'

export const rustPath = pageRustPath
export const samplePath = pageSamplePath
export const samples = importedSamples


/** The module file naming every compiled sample, which `src/lib.rs` includes by path. */
export const modulesPath = `${rustDirectory}/mod.rs`

/**
 * A number as a Rust `f64` literal: `1.0`, `-42.5`.
 *
 * @type {(n: number) => string}
 */
export const f64Literal = n => Number.isInteger(n) ? `${n}.0` : String(n)

/**
 * A string as a Rust literal; a string with a lone surrogate, which a
 * `&str` cannot hold, as the answer no call gives.
 *
 * @type {(text: string) => string}
 */
const textLiteral = text => {
    const r = stringLiteral(text)
    return r[0] === 'ok' ? r[1] : '"(not UTF-8)"'
}

/**
 * One listed call as a statement of its sample's test, laid out as `rustfmt`
 * lays it out: on one line where the arguments fit in 60 characters and the
 * line in 100, and one argument a line otherwise. An `Ok` or `Err` that
 * exceeds 100 columns puts its string on a nested line.
 *
 * @type {(call: ListedCall) => readonly string[]}
 */
export const callStatement = ([input, [kind, text]]) => {
    const variant = kind === 'returned' ? 'Ok' : 'Err'
    const literal = textLiteral(text)
    const args = ['&entry', f64Literal(input), `${variant}(${literal})`]
    const line = `        crate::assert_call(${args.join(', ')});`
    const resultLine = `            ${args[2]},`
    return args.join(', ').length <= 60 && line.length <= 100
        ? [line]
        : [
            '        crate::assert_call(',
            ...args.slice(0, 2).map(arg => `            ${arg},`),
            ...resultLine.length <= 100 ? [resultLine] : [
                `            ${variant}(`,
                `                ${literal},`,
                '            ),',
            ],
            '        );',
        ]
}

/**
 * The text of `mod.rs`: one `pub mod` per sample, then the export a page
 * loads it by, then a test per function sample, under the header every
 * generated file carries. Sorted with `string.cmp`, the order `rustfmt` puts
 * `mod` lines in, so `cargo fmt --check` passes whatever order `samples`
 * lists them in.
 *
 * **The exports are generated with the modules**, so a sample is listed
 * once: a page calls its sample's export by the sample's name, and an export
 * written by hand in `src/lib.rs` was one more place to keep in step. A
 * `#[no_mangle]` function is a WebAssembly export wherever in the crate it
 * is defined, and a function and a module share a name without colliding.
 *
 * @type {(places: readonly (Place | FunctionPlace)[]) => string}
 */
export const modules = places => {
    const sorted = places.toSorted((a, b) => cmp(placeName(a))(placeName(b)))
    /** @type {readonly FunctionPlace[]} */
    const functions = sorted.flatMap(place => hasEntry(place, 'calls') ? [place] : [])
    return [
        generatedHeader('`fjs run ./fjs/nanvm/demos/module.f.js`', 'add or remove a sample instead'),
        '',
        ...sorted.map(place => `pub mod ${placeName(place)};`),
        ...sorted.flatMap(place => {
            const name = placeName(place)
            return [
            '',
            `/// Loads the \`${name}\` sample.`,
            '#[unsafe(no_mangle)]',
            `pub extern "C" fn ${name}() -> i32 {`,
            `    crate::export(${name}::module::<nanvm_lib::naive::Naive>)`,
            '}',
        ]}),
        ...(functions.length === 0 ? [] : [
            '',
            '/// The calls each function sample lists, each answered as JavaScript answers it.',
            '#[cfg(test)]',
            'mod tests {',
            '    use nanvm_lib::naive::Naive;',
            ...functions.flatMap(place => {
                const name = placeName(place)
                return [
                '',
                '    #[test]',
                `    fn ${name}() {`,
                `        let entry = crate::load(super::${name}::module::<Naive>).unwrap();`,
                ...place.calls.flatMap(callStatement),
                '    }',
            ]}),
            '}',
        ]),
        '',
    ].join('\n')
}

/** The target the pages' module is built for. */
export const wasmTarget = 'wasm32-unknown-unknown'

/** Where `cargo build` writes that module. */
export const builtWasmPath = `target/${wasmTarget}/release/nanvm_demos.wasm`

/** The program that publishes the module and its disassembly. */
export const publishPath = 'fjs/nanvm/demos/publish/module.f.js'

/** The program that writes each sample's marked Rust beside them. */
export const markedPath = 'fjs/nanvm/demos/marked/module.f.js'

/**
 * The script that builds the module and its disassembly: a `gen.` name, run
 * through `sh` as `sh ./nanvm/demos/gen.build.sh`, since a regenerated file
 * has no executable bit.
 */
export const buildScriptPath = 'nanvm/demos/gen.build.sh'

/** Where emit writes NaNVM L0 for the IR demo route. */
export const irL0BuiltPath = `target/${wasmTarget}/release/nanvm_l0_wasm.wasm`

/** Emits IR `.wasm` modules and copies NaNVM L0 into {@link buildDirectory}. */
export const irEmitPath = 'fjs/nanvm/demos/ir/emit.mjs'

/**
 * The script's text: the pinned Rust checked first, then the module built and
 * published with the WAT of each of `places`, then every sample's marked
 * Rust written beside them, then IR `.wasm` and NaNVM L0 for the direct-to-
 * WASM demo route. Run in the shared shell, which carries that Rust and the
 * `wasm32` target: `./dev.sh sh ./nanvm/demos/gen.build.sh`.
 *
 * @type {(places: readonly Place[]) => string}
 */
export const buildScript = places => `#!/bin/sh
set -e
case "$(rustc --version)" in
"rustc ${rust} "*) ;;
*) echo "nanvm/demos/wasm/ is built with Rust ${rust}, not $(rustc --version): run ./dev.sh sh ./${buildScriptPath}" >&2; exit 1 ;;
esac
cargo build -p nanvm-demos --release --target ${wasmTarget}
cargo build -p nanvm-l0-wasm --release --target ${wasmTarget}
node ./fjs/module.mjs run ./${publishPath} ${builtWasmPath} ${wasmPath} ${buildDirectory} ${places.map(placeName).join(' ')}
node ./fjs/module.mjs run ./${markedPath}
node ./${irEmitPath}
`

/**
 * Compiles one sample into the Rust `cargo` builds, as `fjs compile` does,
 * or reports the compiler's refusal and writes nothing.
 *
 * @type {(place: Place | FunctionPlace) => Effect<_CompileOp, void, IoChannel>}
 */
const compileSample = place => compileFile(noRuntime, true)(samplePath(place.directory), rustPath(placeName(place)))

/**
 * Compiles every sample into its `.rs`, in order, stopping at the first the
 * compiler refuses, then writes `mod.rs` naming them all and the script that
 * builds them for the pages.
 *
 * @type {(places: readonly (Place | FunctionPlace)[]) => Effect<_CompileOp, void, IoChannel>}
 */
export const generate = places => step(
    forEachStep(pureOk(places), compileSample),
    () => writeFiles([[modulesPath, modules(places)], [buildScriptPath, buildScript(places)]]))

/** @type {NodeProgram} */
export const main = _options => exitStep(generate(samples))
