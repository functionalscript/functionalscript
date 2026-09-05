/**
 * CI step builder for the Rust crate: platform compatibility jobs run native
 * tests and Clippy, Intel jobs also run 32-bit target tests and Clippy, and the
 * canonical WASM job exercises every WASM target inside its generated flake.
 *
 * The two families get their toolchain from different places, and the reason is
 * packaging rather than preference. The platform matrix runs on six runner
 * images across three operating systems, only one of which a generated flake
 * could serve, so it keeps `dtolnay/rust-toolchain`. The WASM job runs on one
 * Linux runner and can have a flake — but not one built from Nixpkgs alone:
 * Nixpkgs builds a single `rustc` and hard-codes the targets it builds `std`
 * for, and three of this job's four are not among them at any version. Its
 * flake takes the toolchain from `rust-overlay` instead, which unpacks the same
 * release artifacts `rustup` would.
 *
 * Both name `../config/module.f.mjs`'s `rust`, so the version cannot differ
 * between a platform job and this one.
 *
 * @module
 *
 * @import { Architecture, MetaStep, Os } from '../common/types.ts'
 * @import { NixPerSystem, NixRust } from '../nix/types.ts'
 */

import { rust, wasmer, wasmtime } from '../config/module.f.mjs'
import { test } from '../common/module.f.mjs'
import { nixInstall, nixShell, nixSteps, nixVersionStep } from '../nix/module.f.mjs'

/** @type {(tool: 'clippy' | 'test', target?: string, config?: string) => string} */
const cargoCommand = (tool, target, config) => {
    const to = target ? ` --target ${target}` : ''
    const co = config ? ` --config ${config}` : ''
    return `cargo ${tool}${to}${co}`
}

/** @type {(target?: string) => string} */
const cargoClippy = target => `${cargoCommand('clippy', target)} -- -D warnings`

/** @type {(target?: string) => string} */
const cargoReleaseClippy = target =>
    `${cargoCommand('clippy', target)} --release -- -D warnings`

/** Debug and release, tests then Clippy — the check set every target gets. */
/** @type {(target?: string) => readonly string[]} */
const targetCheckCommands = target => [
    cargoCommand('test', target),
    `${cargoCommand('test', target)} --release`,
    cargoClippy(target),
    cargoReleaseClippy(target),
]

/** @type {(target: string, config: string) => readonly string[]} */
const cargoTestPairCommands = (target, config) => {
    const main = cargoCommand('test', target, config)
    return [main, `${main} --release`]
}

/** @type {(commands: readonly string[]) => readonly MetaStep[]} */
const testSteps = commands => commands.map(run => test({ run }))

/** @type {(target: string) => readonly MetaStep[]} */
const rustTarget = target => [
    { type: 'rust', target },
    ...testSteps(targetCheckCommands(target)),
]

const i686Linux = /** @type {const} */ ('i686-unknown-linux-gnu')

/**
 * The 32-bit target a platform job also checks, which is now Windows Intel and
 * nothing else.
 *
 * 32-bit Linux used to be here too, and became {@link i686JobId} — a job of its
 * own, whose target and linker the shared shell carries on the one system they
 * exist for. Windows stays because that job has no shell at all: Nix does not
 * run there, so `dtolnay/rust-toolchain` provides the target the way it always
 * did.
 *
 * @type {(v: Os, a: Architecture) => string | undefined}
 */
export const i686Target = (v, a) =>
    a === 'intel' && v === 'windows' ? 'i686-pc-windows-msvc' : undefined

/** CI job id of the 32-bit Linux job. */
export const i686JobId = /** @type {const} */ ('ubuntu-intel32')

/** @type {(v: Os, a: Architecture) => readonly MetaStep[]} */
const i686 = (v, a) => {
    const target = i686Target(v, a)
    return target === undefined ? [] : rustTarget(target)
}



/**
 * The one system a 32-bit x86 toolchain exists for, and the runner this job
 * has.
 *
 * `pkgsi686Linux` is Nixpkgs built for `i686-linux`, and the snapshot builds it
 * only where the host is x86 Linux — on anything else the attribute is a
 * `throw`, not a package set. So this is a capability of one platform, declared
 * for that platform, rather than a property of the shell.
 */
export const i686System = /** @type {const} */ ('x86_64-linux')

/**
 * What Intel Linux adds to the shared shell: the 32-bit target, and the linker
 * `cargo` has to be pointed at to use it.
 *
 * The linker is the whole reason this is a per-system declaration, and it is an
 * **i686** toolchain rather than a multilib one. `pkgsi686Linux` is Nixpkgs
 * built for `i686-linux`, so its cc-wrapper injects the 32-bit emulation and
 * the 32-bit libc as a matter of what it is, with nothing to override.
 *
 * `gcc_multi` was tried first and does not work, which is worth recording
 * because it looks like the obvious answer. It finds every 32-bit file
 * correctly — `glibc_multi`'s `lib/32/Scrt1.o`, gcc's `32/crtbeginS.o` — and
 * the link still fails with every object *"incompatible with elf64-x86-64"*.
 * The wrapper is a 64-bit wrapper: its bintools inject `-m elf_x86_64`, which
 * outlives gcc's own `-m32`, so `lld` is told to emit a 64-bit binary out of
 * 32-bit input. A wrapper that is i686 has no such flag to inject.
 *
 * It replaces `apt-get install libc6-dev-i386` rather than joining it. A Nix
 * toolchain does not look in `/usr`: the cc-wrapper is built to keep
 * `/usr/include` and `/usr/lib` off its search paths, so a libc installed by
 * the runner's package manager would sit there unread. The `rust-std` for the
 * target comes from `rust-overlay`, as the `targets` below asks; that is the
 * standard library, and this is what it links against.
 *
 * Nothing names it in the shell's `packages`, and nothing should: interpolating
 * a derivation into the hook puts it in the closure, which is all that is
 * wanted here — a 32-bit `cc` on `PATH` would only shadow the host one that
 * the untargeted `cargo test` needs.
 *
 * The `shellHook` names that linker outright rather than trusting `PATH`.
 * `mkShell` brings its own `cc` from `stdenv`, and `addToSearchPath` appends,
 * so which one `cargo` finds is a question about ordering;
 * `CARGO_TARGET_<TARGET>_LINKER` is not. The `${...}` in it is Nix's
 * interpolation, not this file's — the generator emits an indented string,
 * where Nix resolves the reference to its store path.
 *
 * The target is an addition to what every system's toolchain carries rather
 * than a toolchain of its own: the shell already has `rust-overlay`'s
 * `1.98.0` with the WASM targets, and this is one more `rust-std` on the
 * platform that can link it.
 *
 * @type {{ readonly [system: string]: NixPerSystem }}
 */
export const i686PerSystem = {
    [i686System]: {
        targets: [i686Linux],
        shellHook: [
            'export CARGO_TARGET_I686_UNKNOWN_LINUX_GNU_LINKER=',
            /** @type {const} */ (['ref', 'pkgs', 'pkgsi686Linux', 'stdenv', 'cc']),
            '/bin/cc',
        ],
    },
}

/**
 * The 32-bit Linux job: one target, checked four ways, in the shared shell.
 *
 * It is a job rather than four more steps on `ubuntu-intel` so that the two run
 * in parallel, and so that a red result says "32-bit Linux" where a red
 * `ubuntu-intel` used to mean one of nine things. It is not a job because of
 * its environment: it runs on Intel Linux, where the shared shell carries the
 * target and the linker above.
 *
 * No version check, unlike most jobs entering that shell: the tool this one
 * runs is `cargo`, whose flake names `1.98.0` in full, so a check could only
 * restate the file. The runtimes the same shell provides are checked by the
 * jobs that use them.
 *
 * @type {readonly MetaStep[]}
 */
export const i686Steps = [
    nixInstall,
    ...nixSteps(nixShell)(targetCheckCommands(i686Linux)),
]

/**
 * The native checks every platform job runs, as commands rather than steps.
 *
 * A job on the shared shell runs these through `nix develop` and needs no
 * toolchain of its own; one off it wraps them in `rustPlatformSteps` below,
 * whose `{ type: 'rust' }` marker is what makes `toSteps` install one.
 *
 * @type {readonly string[]}
 */
export const rustPlatformCommands = targetCheckCommands()

/** @type {(v: Os, a: Architecture) => readonly MetaStep[]} */
export const rustPlatformSteps = (v, a) => [
    { type: 'rust' },
    ...testSteps(rustPlatformCommands),
    ...i686(v, a),
]

/** CI job id, and the directory name of its generated flake. */
export const wasmJobId = /** @type {const} */ ('wasm')

const wasmerConfig = /** @type {const} */ ('.cargo/config.wasmer.toml')

/**
 * Wasmtime 47 removed wasi-threads, so this target runs under Wasmer only.
 * Clippy needs no runner and stays. See `../../../todo/blocked/wasmtime-threads.md`.
 *
 * The Wasmtime the flake provides predates that removal, so the arrangement
 * currently tests less than it could rather than something it cannot: revisit
 * when the pinned snapshot moves past 47.
 */
const wasmerOnlyTarget = /** @type {const} */ ('wasm32-wasip1-threads')

/**
 * Every WASM target the job exercises, in the order it exercises them.
 *
 * One list, read three times: the flake declares these as the targets whose
 * `rust-std` its toolchain must carry, the steps below build the commands from
 * the same array, and `../dev/module.f.mjs` gives a developer's shell the same
 * ones. A target added here therefore arrives in the shell and in the job
 * together, rather than as a command with no standard library.
 */
export const wasmTargets = /** @type {const} */ ([
    'wasm32-wasip1',
    'wasm32-wasip2',
    'wasm32-unknown-unknown',
    wasmerOnlyTarget,
])

/** @type {(target: string) => readonly string[]} */
const wasmTargetCommands = target =>
    target === wasmerOnlyTarget
        ? [
            cargoClippy(target),
            cargoReleaseClippy(target),
            ...cargoTestPairCommands(target, wasmerConfig),
        ]
        : [
            ...targetCheckCommands(target),
            ...cargoTestPairCommands(target, wasmerConfig),
        ]

/**
 * The Rust the shared flake carries: a `rust-overlay` toolchain with every
 * target this job builds.
 *
 * `minimal` rather than `default`, with the two components the job actually
 * runs named explicitly: the default profile would add `rust-docs`, which is a
 * download nothing here opens.
 *
 * It is declared beside the commands that use it rather than beside the flake,
 * so the targets below and `wasmTargets` above cannot come apart —
 * `../dev/module.f.mjs` takes this whole record.
 *
 * The flake names `1.98.0` in full, so no job checks the toolchain's version:
 * a check could only restate the flake. The two runtimes are the opposite
 * case, and the checks below are the whole of that tie.
 *
 * @type {NixRust}
 */
export const wasmRust = {
    version: rust,
    extensions: ['clippy', 'rustfmt'],
    targets: wasmTargets,
}

/**
 * The two runtimes `.cargo/config.toml` and `.cargo/config.wasmer.toml` name,
 * as the shared flake's attributes. Neither carries a version.
 *
 * @type {readonly string[]}
 */
export const wasmPackages = ['wasmtime', 'wasmer']

/**
 * The migrated job: install Nix, check the two runtimes its flake provides,
 * then format, test and lint every WASM target through that shell.
 *
 * It installs no toolchain of its own. `cargo` comes from the flake, which is
 * also where `wasmtime` and `wasmer` come from — and that is not a detail:
 * `cargo` invokes those runners itself, through the `runner` keys in
 * `.cargo/config.toml`, so they have to be on the same `PATH` as the `cargo`
 * that spawns them. A job taking the toolchain from an action and the runtimes
 * from a flake would depend on whether `nix develop` keeps the runner's `PATH`,
 * which nothing else here depends on.
 *
 * @type {readonly MetaStep[]}
 */
export const rustWasmSteps = [
    nixInstall,
    nixVersionStep(nixShell, 'wasmtime --version', `wasmtime ${wasmtime}`),
    nixVersionStep(nixShell, 'wasmer --version', `wasmer ${wasmer}`),
    ...nixSteps(nixShell)([
        'cargo fmt -- --check',
        ...wasmTargets.flatMap(wasmTargetCommands),
    ]),
]
