/**
 * Proofs for generated CI flakes.
 *
 * @import { NixJob, NixPin } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { step as ioStep } from '../../effects/module.f.mjs'
import { readUtf8File } from '../../effects/node/module.f.mjs'
import { emptyState, virtual } from '../../effects/node/virtual/module.f.mjs'
import { nixpkgs, node, rustOverlay, typescript } from '../config/module.f.mjs'
import { devJobId, devSystems } from '../dev/module.f.mjs'
import { nixJobs } from '../module.f.mjs'
import { nodeNixJobs } from '../node/module.f.mjs'
import {
    flakePath,
    flakeText,
    lockUpdateText,
    generatedDirectory,
    nixDevelop,
    nixFlakes,
    nixInstall,
    nixShell,
    nixSteps,
    nixSystem,
    nixVersionStep,
    runPath,
    runText,
} from './module.f.mjs'

const { commit } = nixpkgs

/** @type {NixJob} */
const plain = {
    id: 'node24',
    systems: ['aarch64-linux'],
    packages: ['nodejs_24'],
}

/**
 * A hook in both its halves: text, and a package it has to name.
 *
 * The interpolation is the half that cannot be written as a string. A store
 * path is not knowable when this file is generated, so a reference has to
 * reach the flake unescaped and be resolved by Nix — which is exactly what
 * Intel Linux needs to point `cargo` at a 32-bit linker. The text around it is
 * escaped, so the `$HOME` below arrives as those five characters rather than as
 * anything Nix reads.
 *
 * It is declared for a system rather than for the job, because a hook naming a
 * package is a statement about the platform that has it. With one system there
 * is nothing to distinguish it from a job-wide hook, which is why the flake
 * below is the flat text a hook always produced.
 *
 * The package named here is a fixture, not the one the developer shell uses:
 * this file proves how a hook *renders*, and `../rust/proof.f.mjs` proves what
 * is actually declared.
 *
 * @type {NixJob}
 */
const withShellHook = {
    ...plain,
    id: 'node22',
    packages: ['nodejs_22'],
    perSystem: {
        'aarch64-linux': {
            shellHook: [
                'export NPM_CONFIG_PREFIX="$HOME/.npm-global"\nexport CC=',
                ['ref', 'pkgs', 'gcc_multi'],
                '/bin/cc',
            ],
        },
    },
}

/**
 * A job whose targets Nixpkgs has no `std` for, so its toolchain comes from the
 * second input. Everything that input brings — the `url`, the `follows`, the
 * lambda argument, the overlay, the `rust` binding and its place at the head of
 * `packages` — appears only for a job that asks for it, which `plainFlake`
 * below is what holds.
 *
 * @type {NixJob}
 */
const withRust = {
    ...plain,
    id: 'wasm',
    packages: ['wasmtime'],
    rust: {
        version: '1.98.0',
        extensions: ['clippy'],
        targets: ['wasm32-wasip1', 'wasm32-wasip2'],
    },
}

/**
 * A job whose runtime the snapshot carries at a version its suite fails on. The
 * flake keeps the snapshot's packaging and replaces only the archive, so the
 * override is a `let` binding and the shell takes that binding rather than
 * `pkgs.<package>` — which is what keeps the snapshot's copy off `PATH` beside
 * it.
 *
 * @type {NixJob}
 */
const withPin = {
    ...plain,
    id: 'bun',
    packages: [],
    pin: {
        package: 'bun',
        version: '1.4.0',
        sources: {
            'aarch64-linux': {
                url: 'https://github.com/oven-sh/bun/releases/download/bun-v1.4.0/bun-linux-aarch64.zip',
                hash: 'sha256-SxozLuhhmD65O8/m93D/+U4+MbLDiL2uo8jtNeWO7Q4=',
            },
        },
    },
}

const plainFlake = `{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/${commit}";
    outputs = { nixpkgs, ... }: {
        devShells.aarch64-linux.default = let
            pkgs = import nixpkgs {
                system = "aarch64-linux";
            };
        in
        pkgs.mkShell {
            packages = [ pkgs.nodejs_24 ];
        };
    };
}
`

const shellHookFlake = `{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/${commit}";
    outputs = { nixpkgs, ... }: {
        devShells.aarch64-linux.default = let
            pkgs = import nixpkgs {
                system = "aarch64-linux";
            };
        in
        pkgs.mkShell {
            packages = [ pkgs.nodejs_22 ];
            shellHook = ''
                export NPM_CONFIG_PREFIX="$HOME/.npm-global"
                export CC=\${pkgs.gcc_multi}/bin/cc
            '';
        };
    };
}
`

const rustFlake = `{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/${commit}";
    inputs.rust-overlay.url = "github:oxalica/rust-overlay/${rustOverlay.commit}";
    inputs.rust-overlay.inputs.nixpkgs.follows = "nixpkgs";
    outputs = { nixpkgs, rust-overlay, ... }: {
        devShells.aarch64-linux.default = let
            pkgs = import nixpkgs {
                system = "aarch64-linux";
                overlays = [ rust-overlay.overlays.default ];
            };
            rust = pkgs.rust-bin.stable."1.98.0".minimal.override {
                extensions = [ "clippy" ];
                targets = [ "wasm32-wasip1" "wasm32-wasip2" ];
            };
        in
        pkgs.mkShell {
            packages = [ rust pkgs.wasmtime ];
        };
    };
}
`

const pinFlake = `{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/${commit}";
    outputs = { nixpkgs, ... }: {
        devShells.aarch64-linux.default = let
            pkgs = import nixpkgs {
                system = "aarch64-linux";
            };
            pinned = pkgs.bun.overrideAttrs {
                version = "1.4.0";
                src = pkgs.fetchurl {
                    url = "https://github.com/oven-sh/bun/releases/download/bun-v1.4.0/bun-linux-aarch64.zip";
                    hash = "sha256-SxozLuhhmD65O8/m93D/+U4+MbLDiL2uo8jtNeWO7Q4=";
                };
            };
        in
        pkgs.mkShell {
            packages = [ pinned ];
        };
    };
}
`

/**
 * A job exposing a shell for more than one system — the developer environment's
 * shape, at two systems rather than four.
 *
 * Both halves of a pinned archive vary with the system, so each shell carries
 * its own `url` and `hash`; everything else about the two is identical, written
 * out twice rather than abstracted over.
 *
 * @type {NixJob}
 */
const withSystems = {
    ...plain,
    id: 'dev',
    systems: ['aarch64-linux', 'x86_64-darwin'],
    packages: ['git'],
    pin: {
        package: 'bun',
        version: '1.4.0',
        sources: {
            'aarch64-linux': {
                url: 'https://example.test/bun-linux-aarch64.zip',
                hash: 'sha256-AAAA',
            },
            'x86_64-darwin': {
                url: 'https://example.test/bun-darwin-x64-baseline.zip',
                hash: 'sha256-BBBB',
            },
        },
    },
}

const systemsFlake = `{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/${commit}";
    outputs = { nixpkgs, ... }: let
        shell = { pkgs, url, hash, ... }: let
            pinned = pkgs.bun.overrideAttrs {
                version = "1.4.0";
                src = pkgs.fetchurl {
                    url = url;
                    hash = hash;
                };
            };
        in
        pkgs.mkShell {
            packages = [ pinned pkgs.git ];
        };
    in
    {
        devShells.aarch64-linux.default = let
            pkgs = import nixpkgs {
                system = "aarch64-linux";
            };
        in
        shell {
            pkgs = pkgs;
            url = "https://example.test/bun-linux-aarch64.zip";
            hash = "sha256-AAAA";
        };
        devShells.x86_64-darwin.default = let
            pkgs = import nixpkgs {
                system = "x86_64-darwin";
            };
        in
        shell {
            pkgs = pkgs;
            url = "https://example.test/bun-darwin-x64-baseline.zip";
            hash = "sha256-BBBB";
        };
    };
}
`

/**
 * The same two systems with nothing pinned: the only thing that varies between
 * the two shells is then the system itself.
 *
 * That is the shape a project whose runtimes the snapshot carries at the right
 * versions would generate, and it is the one that keeps the shared function
 * honest — its argument list is what the shell reads, not a fixed three names
 * with two of them empty.
 *
 * @type {NixJob}
 */
const withSystemsUnpinned = {
    ...plain,
    systems: ['aarch64-linux', 'x86_64-darwin'],
}

const unpinnedSystemsFlake = `{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/${commit}";
    outputs = { nixpkgs, ... }: let
        shell = { pkgs, ... }: pkgs.mkShell {
            packages = [ pkgs.nodejs_24 ];
        };
    in
    {
        devShells.aarch64-linux.default = let
            pkgs = import nixpkgs {
                system = "aarch64-linux";
            };
        in
        shell {
            pkgs = pkgs;
        };
        devShells.x86_64-darwin.default = let
            pkgs = import nixpkgs {
                system = "x86_64-darwin";
            };
        in
        shell {
            pkgs = pkgs;
        };
    };
}
`

/**
 * The developer environment's real shape: several systems, and one of them
 * carrying something the others cannot have.
 *
 * This is the whole reason `perSystem` exists. A shell that is the environment
 * for its platform is not the same shell on every platform — 32-bit Linux needs
 * a `rust-std` and a linker that exist on x86 Linux and nowhere else — so the
 * difference has to be sayable, and sayable at the system it belongs to.
 *
 * What the flake below shows is that saying it costs the other systems nothing
 * they can trip over. The package a hook names is resolved inside the entry
 * that declares it, from a `pkgs` for *that* system, so a system without the
 * hook never mentions the package — where a condition inside the shared body
 * would put the name in text every system reads.
 *
 * @type {NixJob}
 */
const withPerSystem = {
    ...withSystems,
    rust: {
        version: '1.98.0',
        extensions: ['clippy'],
        targets: ['wasm32-wasip1'],
    },
    perSystem: {
        'aarch64-linux': {
            targets: ['i686-unknown-linux-gnu'],
            shellHook: [
                'export CC=',
                ['ref', 'pkgs', 'pkgsi686Linux', 'stdenv', 'cc'],
                '/bin/cc',
            ],
        },
    },
}

const perSystemFlake = `{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/${commit}";
    inputs.rust-overlay.url = "github:oxalica/rust-overlay/${rustOverlay.commit}";
    inputs.rust-overlay.inputs.nixpkgs.follows = "nixpkgs";
    outputs = { nixpkgs, rust-overlay, ... }: let
        shell = { pkgs, targets, shellHook, url, hash, ... }: let
            rust = pkgs.rust-bin.stable."1.98.0".minimal.override {
                extensions = [ "clippy" ];
                targets = targets;
            };
            pinned = pkgs.bun.overrideAttrs {
                version = "1.4.0";
                src = pkgs.fetchurl {
                    url = url;
                    hash = hash;
                };
            };
        in
        pkgs.mkShell {
            packages = [ rust pinned pkgs.git ];
            shellHook = shellHook;
        };
    in
    {
        devShells.aarch64-linux.default = let
            pkgs = import nixpkgs {
                system = "aarch64-linux";
                overlays = [ rust-overlay.overlays.default ];
            };
        in
        shell {
            pkgs = pkgs;
            targets = [ "wasm32-wasip1" "i686-unknown-linux-gnu" ];
            shellHook = ''
                export CC=\${pkgs.pkgsi686Linux.stdenv.cc}/bin/cc
            '';
            url = "https://example.test/bun-linux-aarch64.zip";
            hash = "sha256-AAAA";
        };
        devShells.x86_64-darwin.default = let
            pkgs = import nixpkgs {
                system = "x86_64-darwin";
                overlays = [ rust-overlay.overlays.default ];
            };
        in
        shell {
            pkgs = pkgs;
            targets = [ "wasm32-wasip1" ];
            shellHook = "";
            url = "https://example.test/bun-darwin-x64-baseline.zip";
            hash = "sha256-BBBB";
        };
    };
}
`

/**
 * `withPin`'s pin, without the optionality the type carries for jobs that
 * declare none.
 *
 * @type {(job: NixJob) => NixPin}
 */
const unwrapPin = ({ pin }) => {
    assert(pin !== undefined, 'expected a pinned release')
    return pin
}

/** @type {(jobs: readonly NixJob[], id: string, file: string) => string} */
const generatedFile = (jobs, id, file) => {
    // `flakePath` rather than a second spelling of it: the shared shell is the
    // generated directory itself, so a literal `nix/<id>/` here would read the
    // one path the generator never writes.
    const written = ioStep(
        nixFlakes(jobs),
        () => readUtf8File(`${flakePath(id).slice('./'.length)}/${file}`))
    const [, [tag, result]] = virtual(emptyState)(written)
    assert(tag === 'ok', result)
    return result
}

/** @type {(jobs: readonly NixJob[], id: string) => string} */
const generated = (jobs, id) => generatedFile(jobs, id, 'flake.nix')

export const proof = {
    flakeText: {
        plain: () => assertEq(flakeText(plain), plainFlake),
        shellHook: () => assertEq(flakeText(withShellHook), shellHookFlake),
        // The whole second input, pinned rather than described: the toolchain
        // is `minimal.override` with the job's own components and targets, the
        // overlay reaches `pkgs` through `import nixpkgs`, and the overlay's
        // own Nixpkgs follows ours so the flake resolves one snapshot.
        rust: () => assertEq(flakeText(withRust), rustFlake),
        // The override, pinned rather than described: no second input — this
        // needs none — and the archive's hash is in the flake, so the fetch is
        // checked before anything unpacks it.
        pin: () => assertEq(flakeText(withPin), pinFlake),
        // Two shells from one declaration, sharing the body that does not vary
        // and naming, per system, the three things that do. Still no loop and
        // no `flake-utils`: every system it serves is a `devShells.<system>`
        // binding you can read off the file, rather than a fold over a list the
        // file does not contain.
        systems: () => assertEq(flakeText(withSystems), systemsFlake),
        // The same, with nothing pinned: the shared function takes the system
        // and only the system. A flake that pins nothing has no `url` and no
        // `hash` anywhere in it, rather than two arguments the shell never
        // reads.
        unpinnedSystems: () =>
            assertEq(flakeText(withSystemsUnpinned), unpinnedSystemsFlake),
        // One system carrying more than the others, which is what a shell that
        // is the environment *for its platform* means. The two arguments the
        // function grows are exactly the two some system had something to say
        // about; the system that had nothing still passes both, because a
        // caller's argument list is the function's, not its own.
        //
        // The linker is named where it can be: inside the entry that declares
        // it, from that system's `pkgs`. `x86_64-darwin`'s shell does not
        // mention the package at all, which is the property a condition inside
        // the shared body would lose — Nix would not evaluate it there either,
        // but a reader would have to know that to believe it.
        perSystem: () => assertEq(flakeText(withPerSystem), perSystemFlake),
        // A package name reaches one quotable position and one binding the
        // generator owns, so an unusual one is escaped rather than rejected.
        // The `let` name is the generator's precisely so that it cannot be:
        // a reference's root must be an identifier, while a selection need not
        // be, and binding to the job's string would throw here instead.
        quotedPin: () => {
            const text = flakeText({
                ...withPin,
                pin: { ...unwrapPin(withPin), package: 'not an identifier' },
            })
            assert(
                text.includes('pinned = pkgs."not an identifier".overrideAttrs'),
                text)
            assert(text.includes('packages = [ pinned ]'), text)
        },
    },
    nixFlakes: {
        write: () => assertEq(generated([plain], plain.id), plainFlake),
        every: () => {
            for (const job of nixJobs) {
                assertEq(generated(nixJobs, job.id), flakeText(job))
            }
        },
        // The Node mapping only. Deno's and Bun's attributes are unversioned,
        // so there is no name to derive — their jobs' version checks carry
        // that tie instead.
        //
        // The runtime and nothing else. These two flakes exist only because
        // `npm ci` and `node --test` resolve `node` from `PATH`, so each holds
        // the one release its job proves this code runs on — anything more is
        // a build neither job ever opens, and a second `nodejs_*` would put two
        // on `PATH` with one winning silently.
        packages: () => {
            for (const { id, packages } of nodeNixJobs) {
                assertStructurallySame(
                    [...packages],
                    [`nodejs_${id.slice('node'.length)}`])
            }
            // The compiler is in the shared shell, which is where the job that
            // type-checks runs — see `../dev/proof.f.mjs`.
            assert(
                !nodeNixJobs.some(job => job.packages.includes(typescript.attribute)),
                'a job that only runs the suite needs no compiler')
        },
        // The `run` script is written beside every flake, naming that flake.
        // The only thing that varies between copies is the path.
        run: () => {
            for (const job of nixJobs) {
                assertEq(generatedFile(nixJobs, job.id, 'run'), runText(job.id))
            }
        },
        // `nixFlakes` writes the lock-update script once, beside the shared
        // shell, rather than a `flake.lock` per job: that file is left to
        // whatever is already committed, refreshed only by running the script
        // this generates.
        lockUpdateScript: () => {
            const written = ioStep(
                nixFlakes(nixJobs),
                () => readUtf8File(`${generatedDirectory}/lock-update.sh`))
            const [, [tag, result]] = virtual(emptyState)(written)
            assert(tag === 'ok', result)
            assertEq(result, lockUpdateText(nixJobs))
        },
        // One `nix flake lock` per generated directory — Nix has no form that
        // locks several flakes at once — under `set -e`, so a later directory
        // is never silently skipped after an earlier one fails.
        //
        // Each line carries the experimental features for the same reason the
        // `run` scripts do: `nix flake` is gated behind `nix-command` and
        // `flakes` exactly as `nix develop` is, so a stock installation that
        // could not run `./nix/run` could not run this either.
        lockUpdateText: () => {
            assertEq(lockUpdateText([plain, withRust]), `#!/bin/sh
set -e
nix flake lock --extra-experimental-features 'nix-command flakes' ${flakePath(plain.id)}
nix flake lock --extra-experimental-features 'nix-command flakes' ${flakePath(withRust.id)}
`)
        },
        // What that script must say, pinned rather than described, for the
        // shared shell and for a flake with a directory of its own. `exec`
        // keeps the command's exit status; the path is written in rather than
        // derived, so there is no shell logic to read; `"$@"` passes the
        // caller's arguments through unsplit.
        //
        // This is also the whole of what holds the script to root `AGENTS.md`
        // §6, which forbids a generated script from calling an external tool:
        // the text is fixed, so reintroducing `dirname` — or anything else —
        // fails here. A separate guard scanning for tool names would add no
        // coverage this does not already have, and would be the kind of check
        // §6 describes: blind to any name it does not list, and tripped by one
        // appearing in a comment.
        runText: () => {
            assertEq(runText(nixShell), `#!/bin/sh
exec nix develop --extra-experimental-features 'nix-command flakes' --no-update-lock-file --quiet ./nix --command "$@"
`)
            assertEq(runText(plain.id), `#!/bin/sh
exec nix develop --extra-experimental-features 'nix-command flakes' --no-update-lock-file --quiet ./nix/node24 --command "$@"
`)
        },
        // One, and the count is arithmetic rather than taste. Nix has a single
        // verbosity integer: the default is `lvlInfo` (3), each `--quiet`
        // decrements it by one, and a message prints when its own level is at
        // most the current value. One reaches `lvlNotice` (2), which drops the
        // `copying N paths` chatter at `lvlInfo` and keeps every warning.
        //
        // There were three, and the second and third only existed to get below
        // `lvlWarn` (1) and hide `not writing modified lock file`. That took
        // every other Nix warning with them — a failing substituter, a dirty
        // tree, a deprecation notice — because global verbosity is the only
        // lever Nix has. `lockText` removed the cause, so a second `--quiet`
        // here would now buy nothing and cost the warning channel again.
        oneQuiet: () => {
            for (const job of nixJobs) {
                assertEq(
                    runText(job.id).split(' --quiet').length - 1,
                    1,
                    `expected one --quiet in ${job.id}'s run script`)
            }
        },
        // Two lines, and the second names a path. Omitting it would leave
        // `nix develop` defaulting to `.` — the *process* working directory,
        // which is the repository root, where there is no `flake.nix`.
        runNamesItsFlake: () => {
            for (const job of nixJobs) {
                const [shebang, command, ...rest] = runText(job.id).split('\n')
                assertEq(shebang, '#!/bin/sh')
                assert(
                    command?.includes(` ${flakePath(job.id)} `) === true,
                    `expected ${job.id}'s run script to name its flake`)
                assertStructurallySame([...rest], [''])
            }
        },
        // Every job but the developer environment runs on one runner, and
        // declares the one system that runner is. The exception is named
        // rather than exempted by a pattern: a job quietly declaring a second
        // system would otherwise generate a shell no runner enters.
        //
        // `dev` is the reason the list form exists — four systems, one per
        // machine a developer might have. It is also the only declaration with
        // a `perSystem`, and every key of one has to be a system the flake
        // writes a shell for: a key that is not names a shell that does not
        // exist, and the capability it declares would silently be in none.
        systems: () => {
            for (const { id, systems, perSystem } of nixJobs) {
                if (id === devJobId) {
                    assertStructurallySame([...systems], [...devSystems])
                } else {
                    assertStructurallySame([...systems], [nixSystem])
                }
                for (const system of Object.keys(perSystem ?? {})) {
                    assert(
                        systems.includes(system),
                        `${id} declares ${system}, which it has no shell for`)
                }
            }
        },
        // Job data only ever reaches quotable positions, so an unusual package
        // name is escaped rather than rejected.
        quotedPackage: () => assert(
            flakeText({ ...plain, packages: ['not an identifier'] })
                .includes('pkgs."not an identifier"'),
            'expected a quoted attribute name'),
        multiplePackages: () => assert(
            flakeText({ ...plain, packages: ['nodejs_24', 'git'] })
                .includes('[ pkgs.nodejs_24 pkgs.git ]'),
            'expected both packages in the shell'),
    },
    workflow: {
        // The path a workflow passes to `nix develop` must be the directory the
        // generator wrote the flake into.
        flakePath: () => assertEq(flakePath(plain.id), `./${generatedDirectory}/node24`),
        // A step reads as the command it runs. The `nix develop` spelling and
        // its flags live in the generated script instead, once per job rather
        // than once per step.
        nixDevelop: () => assertEq(
            nixDevelop(plain.id, 'node --version'),
            './nix/node24/run node --version'),
        runPath: () => assertEq(runPath(plain.id), './nix/node24/run'),
        // The shared shell is the generated directory itself, not a `dev`
        // below it. `nix develop ./nix` is what a developer types, and the
        // name stays only as the label the declaration is found by.
        sharedShellIsTheDirectory: () => {
            assertEq(flakePath(nixShell), `./${generatedDirectory}`)
            assertEq(runPath(nixShell), `./${generatedDirectory}/run`)
            assert(
                !runPath(nixShell).includes(`/${nixShell}/`),
                `the shared shell must not sit under ./${generatedDirectory}/${nixShell}`)
        },
        // One step per command, each entering the shell itself (root
        // `AGENTS.md` §7) — never one invocation carrying the sequence.
        nixSteps: () => {
            const steps = nixSteps(plain.id)(['npm ci', 'node --test'])
            assertEq(steps.length, 2)
            assertStructurallySame(
                steps.map(s => s.type === 'test' ? s.step.run : undefined),
                ['./nix/node24/run npm ci', './nix/node24/run node --test'])
        },
        // The command and the expected string are independent: Node's output
        // carries a leading `v` that the configured version does not.
        nixVersionStep: () => {
            const step = nixVersionStep(plain.id, 'node --version', 'v24.19.0')
            assertEq(step.type, 'test')
            assertEq(
                step.type === 'test' ? step.step.run : undefined,
                'test "$(./nix/node24/run node --version)" = "v24.19.0"')
        },
        nixInstall: () => {
            assertEq(nixInstall.type, 'install')
            assert(
                nixInstall.type === 'install'
                && nixInstall.step.uses?.startsWith('cachix/install-nix-action@') === true,
                'expected the pinned Nix installer action')
        },
    },
}
