/**
 * The shell: one environment carrying every tool this repository's jobs use, on
 * every system Nix runs on.
 *
 * It is both things at once, and that is the point. It is what a developer
 * enters before running anything, and it is what all but two CI jobs run
 * inside — so the environment CI proves is the environment people work in,
 * rather than a fifth arrangement nobody uses.
 *
 * The jobs used to have one flake each, on the reasoning that a shell with five
 * runtimes would let a job pass on whichever `node` reached `PATH` first. That
 * risk is real, and it is narrower than the rule it produced: it applies only
 * where a command resolves its runtime from `PATH`. `deno task cov`, `bun
 * test`, `cargo test` and `tsc` all name theirs, so what else is installed
 * cannot decide what runs them. The two jobs the risk does apply to — Node 22
 * and Node 24, whose `npm ci` and `node --test` take whatever `node` they find
 * — keep a flake each. See `../node/module.f.mjs`.
 *
 * Nothing is declared here that no job needs, `git` excepted: `nix develop`
 * builds the environment from what the shell asks for rather than from what the
 * machine has, so a shell without it is one a developer leaves immediately.
 *
 * The versions come from the declarations the jobs already own — the Node
 * version is `../config/module.f.mjs`'s, the Bun override is `../bun`'s, the
 * toolchain and its targets are `../rust`'s — so the tools stay next to the
 * commands that use them, and this file stays a list rather than a second copy
 * of what they say.
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
 * @import { NixJob } from '../nix/types.ts'
 */

import { node, typescript } from '../config/module.f.mjs'
import { bunPin } from '../bun/module.f.mjs'
import { major } from '../node/module.f.mjs'
import { i686PerSystem, wasmPackages, wasmRust } from '../rust/module.f.mjs'
import { nixShell } from '../nix/module.f.mjs'

/** The directory name of the generated flake. */
export const devJobId = nixShell

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
 * The declaration itself: Node, Deno, the WASM runtimes, `git`, the compiler,
 * the pinned Bun and the Rust toolchain — and, on Intel Linux, the 32-bit
 * target and linker that platform's job needs.
 *
 * The Node here is the default one, which is what makes `node26` able to share
 * this shell and Node 22 and Node 24 unable to.
 *
 * `perSystem` is what makes this *the* environment rather than most of it. Every
 * job a platform runs should be runnable in the shell that platform's developer
 * enters, and one of them needs something no other system can have: 32-bit
 * Linux, whose linker comes from a package set that exists only on x86 Linux.
 * Declaring it for that system gives Intel Linux the whole of its CI, and
 * leaves the other three shells exactly what they were — a difference the
 * generated flake writes at the system it belongs to, rather than a condition
 * inside a shell shared by four.
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
        ...wasmPackages,
        'git',
    ],
    rust: wasmRust,
    pin: bunPin(devSystems),
    perSystem: i686PerSystem,
}
