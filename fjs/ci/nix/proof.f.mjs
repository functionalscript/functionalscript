/**
 * Proofs for generated CI flakes.
 *
 * @import { NixJob, NixPin } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { step as ioStep } from '../../effects/module.f.mjs'
import { readUtf8File } from '../../effects/node/module.f.mjs'
import { emptyState, virtual } from '../../effects/node/virtual/module.f.mjs'
import { node, nixpkgs, rustOverlay, typescript } from '../config/module.f.js'
import { devNixJob, devSystems } from '../dev/module.f.mjs'
import { major } from '../node/module.f.mjs'
import {
    flakePath,
    flakeText,
    lockUpdatePath,
    lockUpdateText,
    generatedDirectory,
    nixDevelop,
    nixFlake,
    nixInstall,
    nixSteps,
    nixSystem,
    nixVersionStep,
    runPath,
    runText,
} from './module.f.mjs'

const { commit } = nixpkgs

/** @type {NixJob} */
const plain = {
    systems: ['aarch64-linux'],
    packages: ['nodejs_26'],
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
            packages = [ pkgs.nodejs_26 ];
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
            packages = [ pkgs.nodejs_26 ];
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
    inputs.rust-overlay.url = "git+https://github.com/oxalica/rust-overlay?ref=${rustOverlay.ref}&rev=${rustOverlay.commit}";
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
            packages = [ pkgs.nodejs_26 ];
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
    inputs.rust-overlay.url = "git+https://github.com/oxalica/rust-overlay?ref=${rustOverlay.ref}&rev=${rustOverlay.commit}";
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

/** @type {(job: NixJob, file: string) => string} */
const generatedFile = (job, file) => {
    // Read the same shared path the workflow enters.
    const written = ioStep(
        nixFlake(job),
        () => readUtf8File(`${flakePath().slice('./'.length)}/${file}`))
    const [, [tag, result]] = virtual(emptyState)(written)
    assert(tag === 'ok', result)
    return result
}

/** @type {(job: NixJob) => string} */
const generated = job => generatedFile(job, 'flake.nix')

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
    nixFlake: {
        write: () => assertEq(generated(plain), plainFlake),
        sharedShell: () => assertEq(generated(devNixJob), flakeText(devNixJob)),
        // The one runtime resolved from PATH and the compiler that packs the
        // declarations both belong to the shared environment.
        packages: () => {
            assertStructurallySame(
                devNixJob.packages.filter(packageName => packageName.startsWith('nodejs_')),
                [`nodejs_${major(node)}`])
            assert(
                devNixJob.packages.includes(typescript.attribute),
                'expected the selected declaration compiler')
        },
        run: () => assertEq(generatedFile(devNixJob, 'run'), runText()),
        // The generator writes the script; real Nix writes the lock when
        // npm run gen runs the script after all generators finish.
        lockUpdateScript: () => {
            assertEq(generatedFile(devNixJob, 'lock-update.sh'), lockUpdateText())
            assertEq(lockUpdatePath, './gen.nix/lock-update.sh')
        },
        // One lock operation for the shared shell, carrying its required
        // experimental features even on a stock Nix installation.
        lockUpdateText: () => assertEq(lockUpdateText(), `#!/bin/sh
set -e
nix flake lock --extra-experimental-features 'nix-command flakes' ./gen.nix
`),
        // Fixed script text keeps argument forwarding, exit status, lock
        // consistency and warnings intact without a second shell wrapper.
        runText: () => assertEq(runText(), `#!/bin/sh
exec nix develop --extra-experimental-features 'nix-command flakes' --no-update-lock-file --quiet ./gen.nix --command "$@"
`),
        oneQuiet: () => assertEq(runText().split(' --quiet').length - 1, 1),
        runNamesItsFlake: () => {
            const [shebang, command, ...rest] = runText().split('\n')
            assertEq(shebang, '#!/bin/sh')
            assert(
                command?.includes(` ${flakePath()} `) === true,
                'expected the shared run script to name its flake')
            assertStructurallySame([...rest], [''])
        },
        // Every per-system addition reaches a shell this environment exposes.
        systems: () => {
            const { systems, perSystem } = devNixJob
            assert(!systems.includes('x86_64-darwin'), 'unexpected Intel macOS shell')
            assert(!flakeText(devNixJob).includes('x86_64-darwin'),
                'unexpected generated Intel macOS shell')
            assertStructurallySame([...systems], [...devSystems])
            assert(systems.includes(nixSystem), nixSystem)
            for (const system of Object.keys(perSystem ?? {})) {
                assert(systems.includes(system), system)
            }
        },
        quotedPackage: () => assert(
            flakeText({ ...plain, packages: ['not an identifier'] })
                .includes('pkgs."not an identifier"'),
            'expected a quoted attribute name'),
        multiplePackages: () => assert(
            flakeText({ ...plain, packages: ['nodejs_26', 'git'] })
                .includes('[ pkgs.nodejs_26 pkgs.git ]'),
            'expected both packages in the shell'),
    },
    workflow: {
        flakePath: () => assertEq(flakePath(), `./${generatedDirectory}`),
        nixDevelop: () => assertEq(
            nixDevelop('node --version'),
            'sh ./gen.nix/run node --version'),
        runPath: () => assertEq(runPath(), './gen.nix/run'),
        // Each command gets its own reported step and shell entry.
        nixSteps: () => {
            const steps = nixSteps(['npm ci', 'node --test'])
            assertEq(steps.length, 2)
            assertStructurallySame(
                steps.map(s => s.type === 'test' ? s.step.run : undefined),
                ['sh ./gen.nix/run npm ci', 'sh ./gen.nix/run node --test'])
        },
        // The command and its output format remain independent inputs.
        nixVersionStep: () => {
            const step = nixVersionStep('node --version', `v${node}`)
            assertEq(step.type, 'test')
            assertEq(
                step.type === 'test' ? step.step.run : undefined,
                `test "$(sh ./gen.nix/run node --version)" = "v${node}"`)
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
