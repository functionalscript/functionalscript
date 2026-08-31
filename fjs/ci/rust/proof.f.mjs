/**
 * Proofs for the Rust jobs' declarations.
 *
 * `../proof.f.mjs` reads the generated workflow, and `../nix/proof.f.mjs` reads
 * how a flake *renders* from fixtures it declares itself. Between them sat a
 * gap this file closes: nothing called `flakeText` on a job this generator
 * actually emits, so a flake could lose its toolchain, its target or its
 * linker and every proof would stay green while CI went red.
 *
 * That is not hypothetical. `ubuntu-intel32`'s `shellHook` is one line, and it
 * exists because the job failed CI without it — `rust-lld: … Scrt1.o is
 * incompatible with elf64-x86-64`. Asserting the `cargo` commands does not
 * assert the tool they run with.
 *
 * @module
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { rust } from '../config/module.f.mjs'
import { flakeText } from '../nix/module.f.mjs'
import {
    i686JobId,
    i686NixJob,
    i686Target,
    rustPlatformCommands,
    wasmJobId,
    wasmRust,
    wasmTargets,
} from './module.f.mjs'

/** @type {(job: typeof i686NixJob, needle: string) => void} */
const assertFlakeContains = (job, needle) => {
    const text = flakeText(job)
    assert(text !== undefined, `${job.id} flake failed to serialize`)
    assert(text.includes(needle), `${job.id} flake is missing: ${needle}`)
}

export const proof = {
    // The 32-bit job's flake, asserted through the text it actually produces
    // rather than through the object that produces it. Every one of these
    // lines is a mutation that used to pass.
    i686Flake: {
        // The toolchain. Deleting the `rust` field regenerates a flake with no
        // `rust-overlay` input, no overlay and no toolchain — an empty shell
        // for a job whose every command is `cargo`.
        toolchain: () => {
            assertFlakeContains(i686NixJob, `pkgs.rust-bin.stable."${rust}".minimal`)
            assertFlakeContains(i686NixJob, 'rust-overlay.overlays.default')
            assertFlakeContains(i686NixJob, 'packages = [ rust ];')
        },
        // Clippy. Four of this job's commands are `cargo clippy`, and
        // `extensions = []` leaves them a toolchain that cannot run them.
        // Asserting the command is not asserting the tool.
        clippy: () => {
            assertFlakeContains(i686NixJob, 'extensions = [ "clippy" ];')
            // And not `rustfmt`: `wasm` runs the one `cargo fmt` here.
            assert(
                !(flakeText(i686NixJob) ?? '').includes('rustfmt'),
                'unexpected rustfmt in the 32-bit flake')
        },
        // The target's standard library. Without it `cargo --target
        // i686-unknown-linux-gnu` has nothing to link against.
        target: () => {
            assertFlakeContains(
                i686NixJob, 'targets = [ "i686-unknown-linux-gnu" ];')
        },
        // The linker, which is the whole reason this job is separate. The
        // hook has to name it: `mkShell` brings its own `cc` from `stdenv` and
        // `addToSearchPath` appends, so `PATH` order would decide otherwise.
        //
        // Asserted as the rendered line, interpolation included, because the
        // reference resolving to a store path is the half a string could not
        // have expressed.
        linker: () => {
            assertFlakeContains(
                i686NixJob,
                'export CARGO_TARGET_I686_UNKNOWN_LINUX_GNU_LINKER='
                + '${pkgs.pkgsi686Linux.stdenv.cc}/bin/cc')
        },
        // The system. `pkgsi686Linux` is marked broken everywhere else, so a
        // second system here would generate a shell that cannot be entered.
        system: () => {
            assertStructurallySame([...i686NixJob.systems], ['x86_64-linux'])
            assertEq(i686NixJob.id, i686JobId)
            // Nothing in `packages`: a 32-bit `cc` on `PATH` would shadow the
            // host one the untargeted commands need. The toolchain is there
            // because `rust` is a separate binding.
            assertStructurallySame([...i686NixJob.packages], [])
        },
    },
    // The WASM job takes its toolchain from the same pin, so a platform job
    // and the WASM job cannot drift apart on the Rust version.
    wasmToolchain: () => {
        assertEq(wasmRust.version, rust)
        assertStructurallySame([...wasmRust.targets], [...wasmTargets])
    },
    // The 32-bit *Linux* target is a job now; the only platform job that still
    // asks `dtolnay/rust-toolchain` for a second target is Windows Intel.
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
    // The native checks, named. A job on the shared shell runs exactly these
    // and gets its toolchain from the flake.
    platformCommands: () => {
        assertStructurallySame([...rustPlatformCommands], [
            'cargo test',
            'cargo test --release',
            'cargo clippy -- -D warnings',
            'cargo clippy --release -- -D warnings',
        ])
    },
    jobIds: () => {
        assertEq(i686JobId, 'ubuntu-intel32')
        assertEq(wasmJobId, 'wasm')
    },
}
