/**
 * The site build, generated: `gen.website/build.sh` is what `npm run website`
 * runs — documents the Rust workspace, then generates the site — and it
 * installs Rust first where there is none. Cloudflare's Workers Builds runs
 * `npm run website` as its build command, as it always has, so the script
 * depends on nothing set there: a branch without it still builds, and so
 * does a developer's checkout.
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
import { step } from '../../effects/module.f.mjs'
import { exitStep, mkdir, writeUtf8File } from '../../effects/node/module.f.mjs'

/**
 * The generated directory, beside `gen.nix/` at the repository root.
 *
 * @type {string}
 */
export const generatedDirectory = 'gen.website'

/** The script, as `package.json`'s `website` names it: `sh ./gen.website/build.sh`. */
/** @type {string} */
export const buildPath = `${generatedDirectory}/build.sh`

/**
 * The script's text.
 *
 * **Rust is installed only where `cargo` is not on `PATH`.** The shared shell
 * has the pinned one, so a build there downloads nothing. Cloudflare's build
 * image has none and gets exactly the pin — and so does a checkout outside
 * the shell, as `rustup`'s user-level install under `$HOME`: the shell is the
 * environment ([`AGENTS.md` §2](../../../AGENTS.md#2-environment-and-running-tests)),
 * and a build outside it gets the toolchain the build needs rather than a
 * site without its docs. The installer is `rustup`'s own, saved to a file and then run —
 * not piped into `sh`, whose exit status would be the pipeline's whatever
 * `curl` answered, so a refused download would be a silent one. It goes under
 * `$HOME`, which on a build image is a fresh container's, and runs
 * non-interactively with the smallest profile that carries `cargo` and
 * `rustdoc`, exactly the pinned toolchain, and no edit to a shell profile
 * nothing would read: the script puts the new `cargo` on its own `PATH`
 * instead. `--no-deps` documents the workspace's crates and not their
 * dependencies.
 *
 * The generator is run directly rather than through `npm run website`, which
 * is this script.
 *
 * `set -e` makes the first failing step the script's result, so a build that
 * could not install or document does not publish a site without the docs.
 *
 * The script calls external tools — `curl`, `rustup`'s installer and `cargo`
 * — which the repository owner approved for this one script
 * ([`AGENTS.md` §6](../../../AGENTS.md#6-external-tools)). Its proof pins the
 * text exactly, so no tool joins it unseen.
 *
 * @type {() => string}
 */
export const buildText = () => `#!/bin/sh
set -e
if ! command -v cargo > /dev/null
then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o "$HOME/rustup-init.sh"
    sh "$HOME/rustup-init.sh" -y --profile minimal --default-toolchain ${rust} --no-modify-path
    PATH="$HOME/.cargo/bin:$PATH"
fi
cargo doc --no-deps --workspace
node ./fjs/module.mjs r ./fjs/website/module.f.mjs
`

/**
 * Writes the script. No mode is set: `npm run website` runs it through `sh`,
 * as CI runs `gen.nix/run`, and the effects layer sets none.
 *
 * @type {Effect<Mkdir | Rm | WriteBytes | WriteFile, void, IoChannel>}
 */
export const build = step(
    mkdir(generatedDirectory, { recursive: true }),
    () => writeUtf8File(buildPath, buildText()))

/** @type {NodeProgram} */
export const main = _options => exitStep(build)
