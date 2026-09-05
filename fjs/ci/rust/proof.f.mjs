/**
 * Proofs for the Rust jobs' declarations.
 *
 * `../proof.f.mjs` reads the generated workflow, and `../nix/proof.f.mjs` reads
 * how a flake *renders* from fixtures it declares itself. Between them sat a
 * gap this file closes: nothing called `flakeText` on a job this generator
 * actually emits, so a flake could lose its toolchain, its target or its
 * linker and every proof would stay green while CI went red.
 *
 * That is not hypothetical. The 32-bit linker is one line, and it exists
 * because the job failed CI without it — `rust-lld: … Scrt1.o is incompatible
 * with elf64-x86-64`. Asserting the `cargo` commands does not assert the tool
 * they run with.
 *
 * @module
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { rust } from '../config/module.f.mjs'
import { devNixJob } from '../dev/module.f.mjs'
import { flakeText } from '../nix/module.f.mjs'
import {
    i686System,
    i686Target,
    rustPlatformCommands,
    shellRustCommands,
    wasmJobId,
    wasmRust,
    wasmTargets,
} from './module.f.mjs'

/** The shared shell, as the text the generator writes for it. */
const devFlake = flakeText(devNixJob)

/** @type {(needle: string) => void} */
const assertFlakeContains = needle =>
    assert(devFlake.includes(needle), `the shell's flake is missing: ${needle}`)

/** @type {(text: string, needle: string) => number} */
const occurrences = (text, needle) => text.split(needle).length - 1

export const proof = {
    // What 32-bit Linux needs, asserted through the text the generator
    // actually produces rather than through the object that produces it. Every
    // one of these lines is a mutation that used to pass.
    i686Shell: {
        // The toolchain. Deleting the `rust` field regenerates a flake with no
        // `rust-overlay` input, no overlay and no toolchain — an empty shell
        // for the jobs whose every command is `cargo`.
        toolchain: () => {
            assertFlakeContains(`pkgs.rust-bin.stable."${rust}".minimal`)
            assertFlakeContains('rust-overlay.overlays.default')
        },
        // Clippy. Half the commands run against this target are `cargo
        // clippy`, and `extensions = []` leaves them a toolchain that cannot
        // run them. Asserting the command is not asserting the tool.
        clippy: () => assertFlakeContains('"clippy"'),
        // The target's standard library, in the one shell that can link it and
        // in no other. Without it `cargo --target i686-unknown-linux-gnu` has
        // nothing to link against; in the other three it would be a download
        // no command there can use.
        target: () => {
            assertFlakeContains(
                `${wasmTargets.map(t => `"${t}"`).join(' ')} "i686-unknown-linux-gnu" ]`)
            assertEq(occurrences(devFlake, '"i686-unknown-linux-gnu"'), 1)
        },
        // The linker, which is the whole reason this is a per-system
        // declaration. The hook has to name it: `mkShell` brings its own `cc`
        // from `stdenv` and `addToSearchPath` appends, so `PATH` order would
        // decide otherwise.
        //
        // Asserted as the rendered line, interpolation included, because the
        // reference resolving to a store path is the half a string could not
        // have expressed.
        linker: () => {
            assertFlakeContains(
                'export CARGO_TARGET_I686_UNKNOWN_LINUX_GNU_LINKER='
                + '${pkgs.pkgsi686Linux.stdenv.cc}/bin/cc')
        },
        // The system, and that it is the only one. `pkgsi686Linux` throws
        // wherever the host is not x86 Linux, so the same hook in a second
        // shell would be a shell that cannot be entered — and the flake would
        // still generate, which is what makes this worth counting rather than
        // reading.
        oneSystem: () => {
            assertEq(i686System, 'x86_64-linux')
            assert(
                devNixJob.systems.includes(i686System),
                'the shell has no Intel Linux to add it to')
            assertEq(occurrences(devFlake, 'pkgsi686Linux'), 1)
            // Nothing in `packages`: a 32-bit `cc` on `PATH` would shadow the
            // host one the untargeted commands need. The linker reaches the
            // closure by being interpolated into the hook.
            assert(
                !devNixJob.packages.some(p => p.includes('i686')),
                devNixJob.packages.join(' '))
        },
    },
    // The WASM job takes its toolchain from the same pin, so a platform job
    // and the WASM job cannot drift apart on the Rust version.
    wasmToolchain: () => {
        assertEq(wasmRust.version, rust)
        assertStructurallySame([...wasmRust.targets], [...wasmTargets])
    },
    // 32-bit *Linux* comes from the shell now, so the only platform job that
    // still asks `dtolnay/rust-toolchain` for a second target is Windows Intel.
    i686TargetIsWindowsOnly: () => {
        for (const o of /** @type {const} */ (['ubuntu', 'macos', 'windows'])) {
            for (const a of /** @type {const} */ (['intel', 'arm'])) {
                assertEq(
                    i686Target(o, a),
                    o === 'windows' && a === 'intel'
                        ? 'i686-pc-windows-msvc'
                        : undefined,
                    `${o}-${a}`)
            }
        }
    },
    // The native checks, named. A job on the shared shell runs these and gets
    // its toolchain from the flake.
    platformCommands: () => {
        assertStructurallySame([...rustPlatformCommands], [
            'cargo test',
            'cargo test --release',
            'cargo clippy -- -D warnings',
            'cargo clippy --release -- -D warnings',
        ])
    },
    // And on Intel Linux, those four and the 32-bit target's four — the job
    // `ubuntu-intel32` was, now that the shell it would have entered is the
    // one `ubuntu-intel` already enters.
    //
    // Every other platform gets the native four and nothing else, which is the
    // half worth asserting: `pkgsi686Linux` throws on their systems, so a
    // 32-bit command there would be a job whose shell cannot be built. Windows
    // is not among them — those two jobs have no shell, and `i686Target` is
    // what gives them their own 32-bit target.
    shellCommandsPerPlatform: () => {
        assertStructurallySame(
            [...shellRustCommands('ubuntu', 'intel')],
            [
                ...rustPlatformCommands,
                'cargo test --target i686-unknown-linux-gnu',
                'cargo test --target i686-unknown-linux-gnu --release',
                'cargo clippy --target i686-unknown-linux-gnu -- -D warnings',
                'cargo clippy --target i686-unknown-linux-gnu --release -- -D warnings',
            ])
        for (const [o, a] of /** @type {const} */ ([
            ['ubuntu', 'arm'],
            ['macos', 'intel'],
            ['macos', 'arm'],
        ])) {
            assertStructurallySame(
                [...shellRustCommands(o, a)],
                [...rustPlatformCommands],
                `${o}-${a}`)
        }
    },
    jobIds: () => assertEq(wasmJobId, 'wasm'),
}
