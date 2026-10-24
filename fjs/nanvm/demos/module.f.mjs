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
 * `nanvm-demos-publish` copying it into `nanvm/demos/wasm/` with each
 * sample's WAT beside it. Its output is committed, so building the site
 * takes no Rust; CI runs the script on Intel Linux and fails when the
 * committed files differ from what it built. The build is reproducible only
 * with the pinned Rust, so the script refuses any other `rustc` rather than
 * writing a module that would differ for that reason alone.
 *
 * Invoked from `gen`, so the drift check fails when a committed `.rs` is
 * stale. The samples are listed, not found by a walk, in
 * [`samples`](./samples/module.f.mjs): each one also needs a demo page, so a
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
import { compileFile, noRuntime } from '../../compiler/module.f.mjs'
import { forEachStep, pureOk, step } from '../../effects/module.f.mjs'
import { exitStep, writeFiles } from '../../effects/node/module.f.mjs'
import { generatedHeader } from '../../media/rust/item/module.f.js'
import { stringLiteral } from '../../media/rust/module.f.mjs'
import { cmp } from '../../types/string/module.f.mjs'
import { buildDirectory, rustDirectory, rustPath, samplePath, wasmPath } from './page/module.f.mjs'
import { samples } from './samples/module.f.mjs'

export { rustPath, samplePath, samples }


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
 * line in 100, and one argument a line otherwise.
 *
 * @type {(call: ListedCall) => readonly string[]}
 */
export const callStatement = ([input, [kind, text]]) => {
    const args = ['&entry', f64Literal(input), `${kind === 'returned' ? 'Ok' : 'Err'}(${textLiteral(text)})`]
    const line = `        crate::assert_call(${args.join(', ')});`
    return args.join(', ').length <= 60 && line.length <= 100
        ? [line]
        : ['        crate::assert_call(', ...args.map(arg => `            ${arg},`), '        );']
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
    const sorted = places.toSorted((a, b) => cmp(a.name)(b.name))
    /** @type {readonly FunctionPlace[]} */
    const functions = sorted.flatMap(place => 'calls' in place ? [place] : [])
    return [
        generatedHeader('`fjs run ./fjs/nanvm/demos/module.f.mjs`', 'add or remove a sample instead'),
        '',
        ...sorted.map(({ name }) => `pub mod ${name};`),
        ...sorted.flatMap(({ name }) => [
            '',
            `/// Loads the \`${name}\` sample.`,
            '#[unsafe(no_mangle)]',
            `pub extern "C" fn ${name}() -> i32 {`,
            `    crate::export(${name}::module::<nanvm_lib::naive::Naive>)`,
            '}',
        ]),
        ...(functions.length === 0 ? [] : [
            '',
            '/// The calls each function sample lists, each answered as JavaScript answers it.',
            '#[cfg(test)]',
            'mod tests {',
            '    use nanvm_lib::naive::Naive;',
            ...functions.flatMap(({ name, calls }) => [
                '',
                '    #[test]',
                `    fn ${name}() {`,
                `        let entry = crate::load(super::${name}::module::<Naive>).unwrap();`,
                ...calls.flatMap(callStatement),
                '    }',
            ]),
            '}',
        ]),
        '',
    ].join('\n')
}

/** The target the pages' module is built for. */
export const wasmTarget = 'wasm32-unknown-unknown'

/** Where `cargo build` writes that module. */
export const builtWasmPath = `target/${wasmTarget}/release/nanvm_demos.wasm`

/**
 * The script that builds the module and its disassembly: a `gen.` name, run
 * through `sh` as `sh ./nanvm/demos/gen.build.sh`, since a regenerated file
 * has no executable bit.
 */
export const buildScriptPath = 'nanvm/demos/gen.build.sh'

/**
 * The script's text: the pinned Rust checked first, then the module built and
 * published with the WAT of each of `places`. Run in the shared shell, which
 * carries that Rust and the `wasm32` target: `sh ./gen.nix/run sh
 * ./nanvm/demos/gen.build.sh`.
 *
 * @type {(places: readonly Place[]) => string}
 */
export const buildScript = places => `#!/bin/sh
set -e
case "$(rustc --version)" in
"rustc ${rust} "*) ;;
*) echo "nanvm/demos/wasm/ is built with Rust ${rust}, not $(rustc --version): run sh ./gen.nix/run sh ./${buildScriptPath}" >&2; exit 1 ;;
esac
cargo build -p nanvm-demos --release --target ${wasmTarget}
cargo run -p nanvm-demos-publish --release -- ${builtWasmPath} ${wasmPath} ${buildDirectory} ${places.map(({ name }) => name).join(' ')}
`

/**
 * Compiles every sample into its `.rs`, in order, stopping at the first the
 * compiler refuses, then writes `mod.rs` naming them all and the script that
 * builds them for the pages.
 *
 * @type {(places: readonly (Place | FunctionPlace)[]) => Effect<_CompileOp, void, IoChannel>}
 */
export const generate = places => step(
    forEachStep(pureOk(places), ({ name, directory }) => compileFile(noRuntime)(samplePath(directory), rustPath(name))),
    () => writeFiles([[modulesPath, modules(places)], [buildScriptPath, buildScript(places)]]))

/** @type {NodeProgram} */
export const main = _options => exitStep(generate(samples))
