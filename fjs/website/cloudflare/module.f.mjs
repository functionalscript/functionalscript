/**
 * The Cloudflare build, generated: `gen.cloudflare/build.sh` is the build
 * command Cloudflare's Workers Builds runs. It installs what the build image
 * lacks — Rust today — documents the workspace's crates with `cargo doc`, and
 * runs `npm run website`, which stays the generator alone, so a checkout
 * builds the site with `npm run website` exactly as before and only the
 * deploy carries the installs.
 *
 * **Generated rather than written**, because of the version in it. The
 * toolchain it installs is {@link rust} from `fjs/ci/config` — the constant
 * the shared shell and the platform matrix also take. Written out in full, a
 * bump of the pin is a diff in this script that the drift check guards, as it
 * is in `gen.nix/flake.nix`; read at run time, nothing committed would say
 * which Rust the site is built with.
 *
 * @module
 *
 * @import { Effect, IoChannel } from '../../effects/types.ts'
 * @import { Mkdir, NodeProgram, Rm, WriteBytes, WriteFile } from '../../effects/node/types.ts'
 */

import { rust } from '../../ci/config/module.f.js'
import { rustdocHeadPath, rustdocFooterPath, rustdocHeaderPath, rustdocStylesheetPath } from '../cargo-doc/module.f.mjs'
import { exitStep, writeFiles } from '../../effects/node/module.f.mjs'
import { samples } from '../../nanvm/demos/module.f.mjs'
import { buildDirectory, wasmPath } from '../../nanvm/demos/page/module.f.mjs'

/**
 * The generated directory, beside `gen.nix/` at the repository root, where
 * `wrangler.jsonc`, `.assetsignore` and `.node-version` already are for
 * Cloudflare's sake.
 *
 * @type {string}
 */
export const generatedDirectory = 'gen.cloudflare'

/** The script, as the dashboard's build command names it: `sh ./gen.cloudflare/build.sh`. */
/** @type {string} */
export const buildPath = `${generatedDirectory}/build.sh`

/** The target the WASM demo pages' module is built for. @type {string} */
export const wasmTarget = 'wasm32-unknown-unknown'

/** Where `cargo build` writes that module. @type {string} */
export const builtWasmPath = `target/${wasmTarget}/release/nanvm_demos.wasm`

/**
 * The script's text.
 *
 * `rustup`'s installer, saved to a file and then run — not piped into `sh`,
 * whose exit status would be the pipeline's whatever `curl` answered, so a
 * refused download would be a silent one. It goes under `$HOME`, which on
 * the build image is a fresh container's, and runs non-interactively with
 * the smallest profile that carries `cargo` and `rustdoc`, exactly the
 * pinned toolchain, and no edit to a shell profile nothing would read: the
 * script puts the new `cargo` on its own `PATH` instead.
 *
 * **Then the WASM demo pages' module**
 * ([`todo/wasm-demos.md`](../../../todo/wasm-demos.md)): the `wasm32` target
 * added to the toolchain just installed, `nanvm-demos` built for it, and
 * `nanvm-demos-publish` copying the module out of `target/`, which the site
 * does not serve, to where the page fetches it, and printing each sample's WAT
 * beside it. Built here, and never committed, so nothing can go stale.
 *
 * **Then the site's bars, `cargo doc`, and the site** — the order
 * [`../README.md`](../README.md#the-rust-api-reference) gives.
 * `npm run rustdoc-bars` writes the site's favicon links, header, footer and their
 * stylesheet, which `cargo doc` puts on every page of rustdoc's, and
 * `npm run website` then copies `target/doc` onto the site and links it, so
 * the site is generated once. `--no-deps` documents the
 * workspace's crates and not their dependencies. No `cargo clean --doc`:
 * the build starts from a fresh checkout, with no earlier docs to reuse.
 *
 * `set -e` makes the first failing step the script's result, so a build that
 * could not install does not go on to publish as if it had.
 *
 * The script calls external tools — `curl`, `rustup`'s installer, `rustup`,
 * `npm` and `cargo` —
 * which the repository owner approved for this one script
 * ([`AGENTS.md` §6](../../../AGENTS.md#6-external-tools)). Its proof pins the
 * text exactly, so no tool joins it unseen.
 *
 * @type {() => string}
 */
export const buildText = () => `#!/bin/sh
set -e
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o "$HOME/rustup-init.sh"
sh "$HOME/rustup-init.sh" -y --profile minimal --default-toolchain ${rust} --no-modify-path
export PATH="$HOME/.cargo/bin:$PATH"
rustup target add ${wasmTarget}
cargo build -p nanvm-demos --release --target ${wasmTarget}
cargo run -p nanvm-demos-publish --release -- ${builtWasmPath} ${wasmPath} ${buildDirectory} ${samples.map(({ name }) => name).join(' ')}
npm run rustdoc-bars
RUSTDOCFLAGS="--html-in-header $PWD/${rustdocHeadPath} --html-before-content $PWD/${rustdocHeaderPath} --html-after-content $PWD/${rustdocFooterPath} --extend-css $PWD/${rustdocStylesheetPath}" cargo doc --no-deps --workspace
npm run website
`

/**
 * Writes the script. No mode is set: Cloudflare runs it through `sh`, as CI
 * runs `gen.nix/run`, and the effects layer sets none.
 *
 * @type {Effect<Mkdir | Rm | WriteBytes | WriteFile, void, IoChannel>}
 */
export const cloudflare = writeFiles([[buildPath, buildText()]])

/** @type {NodeProgram} */
export const main = _options => exitStep(cloudflare)
