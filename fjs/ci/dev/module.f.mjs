/**
 * The developer environment: one shell carrying every runtime this
 * repository's jobs use, on every system Nix runs on.
 *
 * The CI jobs deliberately do not share it. Each of them exists to test one
 * runtime, and a shell with five would let a job pass on a `node` that happened
 * to be first on `PATH`. This one has the opposite job: to be the single thing
 * a developer enters before running anything.
 *
 * It is generated from the same declarations those jobs use, so it cannot drift
 * from them — the Node version is `../config/module.f.mjs`'s, the Bun override
 * is the `bun` job's, the toolchain and its targets are the `wasm` job's.
 *
 * Nix does not run natively on Windows, so the four systems below are all there
 * are; a Windows developer reaches this shell through WSL2 as a Linux one, or
 * works the way this repository has always supported natively — `npm ci`,
 * `tsc`, `fjs test`, none of which need Nix. That developer installs the
 * compiler globally at the version `../config/module.f.mjs` pins, which
 * `CONTRIBUTING.md` spells out; `npx tsc` is no longer the same thing, since
 * there is nothing left in `node_modules` for it to resolve.
 *
 * @module
 *
 * @import { MetaStep } from '../common/types.ts'
 * @import { NixJob } from '../nix/types.ts'
 */

import { bun, deno, node, rust, typescript, wasmer, wasmtime } from '../config/module.f.mjs'
import { bunPin } from '../bun/module.f.mjs'
import { major } from '../node/module.f.mjs'
import { wasmTargets } from '../rust/module.f.mjs'
import { nixInstall, nixSteps, nixVersionStep } from '../nix/module.f.mjs'

/** CI job id, and the directory name of its generated flake. */
export const devJobId = /** @type {const} */ ('dev')

/**
 * Every system this shell is generated for: two architectures on Linux, two on
 * macOS, each a named `devShells.<system>.default`.
 *
 * The flake writes the shell itself once and lets those four entries call it,
 * passing the three things that differ — the system, and the archive and hash a
 * pinned package takes on it. What it does not do is fold over a list of
 * systems: which systems exist is still something you read off the file. See
 * `../todo/65z-ci-nix.md`.
 *
 * @type {readonly [string, ...string[]]}
 */
export const devSystems = [
    'aarch64-linux',
    'x86_64-linux',
    'aarch64-darwin',
    'x86_64-darwin',
]

/**
 * The shell itself.
 *
 * `git` is declared because `nix develop` builds the environment from what the
 * shell asks for rather than from what the machine has, so a shell without it
 * is one a developer leaves immediately. The rest is the union of what the
 * canonical jobs run on.
 *
 * The compiler is in that union rather than beside it. `npx tsc` used to reach
 * a `typescript` in `node_modules`, so every environment that ran `npm ci` had
 * one whether it type-checked or not; now only the `node26` job's shell carries
 * it, and a developer needs the same one to run `npm test` or `npm pack` at
 * all. See `../todo/65z-ci-nix.md`.
 *
 * @type {NixJob}
 */
export const devNixJob = {
    id: devJobId,
    systems: devSystems,
    packages: [
        `nodejs_${major(node.default)}`,
        'deno',
        typescript.attribute,
        'wasmtime',
        'wasmer',
        'git',
    ],
    rust: {
        version: rust,
        extensions: ['clippy', 'rustfmt'],
        targets: wasmTargets,
    },
    pin: bunPin(devSystems),
}

/**
 * The job that keeps this shell honest: enter it, and assert every version it
 * hands a developer.
 *
 * Without it nothing would ever evaluate this flake. Every other generated
 * flake is entered by the job that owns it — that is why no separate job checks
 * them — and a developer environment has no such job unless one is written. It
 * would rot silently, and the first person to notice would be a developer whose
 * shell failed to build.
 *
 * Rust has no check, for the reason it has none in the `wasm` job: the flake
 * names `1.98.0` in full, so a check could only restate it. The six below are
 * the tools whose versions the flake does *not* say — four from unversioned
 * snapshot attributes, one from a major-versioned one, and Bun from an override
 * that has to be confirmed to have applied at all.
 *
 * The last step is a plain command rather than a sixth check, and it is not
 * decoration. A version check reaches the shell inside a substitution — its
 * command is `test` — so a job built only from checks would install Nix and
 * enter nothing, a shape `../proof.f.mjs`'s `nixCoverage` refuses. `git` is
 * the right one to spend it on: it is in `packages` only so the shell is
 * usable, nothing else checks it, and it is there whether or not the project
 * has Rust.
 *
 * Nothing here runs `cargo`, deliberately. The steps of a job are generated
 * for whatever project runs `fjs ci`, and one without a `Cargo.toml` has no
 * Rust jobs and must get no Rust commands. The shell still carries the
 * toolchain — the flakes are written from a fixed list, as `wasm`'s is for a
 * project with no Rust at all — and the `wasm` job exercises that same version
 * from its own flake.
 *
 * It runs on one runner, so it evaluates one of the four shells. The other
 * three are generated from the same declaration and pinned as text by
 * `../nix/proof.f.mjs`; that they *build* is not something this repository's CI
 * establishes today.
 *
 * @type {readonly MetaStep[]}
 */
export const devSteps = [
    nixInstall,
    nixVersionStep(devJobId, 'node --version', `v${node.default}`),
    nixVersionStep(devJobId, `deno eval 'console.log(Deno.version.deno)'`, deno),
    nixVersionStep(devJobId, 'bun --version', bun),
    nixVersionStep(devJobId, 'tsc --version', `Version ${typescript.version}`),
    nixVersionStep(devJobId, 'wasmtime --version', `wasmtime ${wasmtime}`),
    nixVersionStep(devJobId, 'wasmer --version', `wasmer ${wasmer}`),
    ...nixSteps(devJobId)(['git --version']),
]
