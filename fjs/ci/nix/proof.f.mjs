/**
 * Proofs for generated CI flakes.
 *
 * @import { NixJob, NixPin } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { step as ioStep } from '../../effects/module.f.mjs'
import { readUtf8File } from '../../effects/node/module.f.mjs'
import { emptyState, virtual } from '../../effects/node/virtual/module.f.mjs'
import { nixpkgs, rustOverlay } from '../config/module.f.mjs'
import { nixJobs } from '../module.f.mjs'
import { nodeNixJobs } from '../node/module.f.mjs'
import {
    flakePath,
    flakeText,
    generatedDirectory,
    nixDevelop,
    nixFlakes,
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
    id: 'node24',
    system: 'aarch64-linux',
    packages: ['nodejs_24'],
}

/**
 * No declared job needs a `shellHook` any more — Node 22's went with the global
 * install it existed for. The generator still emits one, and this fixture is
 * what holds that capability to its shape.
 *
 * @type {NixJob}
 */
const withShellHook = {
    ...plain,
    id: 'node22',
    packages: ['nodejs_22'],
    shellHook: `export NPM_CONFIG_PREFIX="$HOME/.npm-global"`,
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
        url: 'https://github.com/oven-sh/bun/releases/download/bun-v1.4.0/bun-linux-aarch64.zip',
        hash: 'sha256-SxozLuhhmD65O8/m93D/+U4+MbLDiL2uo8jtNeWO7Q4=',
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
    const written = ioStep(
        nixFlakes(jobs),
        () => readUtf8File(`${generatedDirectory}/${id}/${file}`))
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
        packages: () => {
            for (const { id, packages } of nodeNixJobs) {
                assertEq(packages.length, 1)
                assertEq(packages[0], `nodejs_${id.slice('node'.length)}`)
            }
        },
        // The `run` script is written beside every flake, byte for byte the
        // same for each job: it resolves its own flake from `$0`, so nothing
        // in it varies by job.
        run: () => {
            for (const job of nixJobs) {
                assertEq(generatedFile(nixJobs, job.id, 'run'), runText)
            }
        },
        // What that script must say, pinned rather than described. `exec` keeps
        // the command's exit status; the `case` and `${0%/*}` find the flake
        // from the script rather than from the working directory; `"$@"` passes
        // the caller's arguments through unsplit.
        //
        // This is also the whole of what holds the script to root `AGENTS.md`
        // §6, which forbids a generated script from calling an external tool:
        // the text is fixed, so reintroducing `dirname` — or anything else —
        // fails here. A separate guard scanning for tool names would add no
        // coverage this does not already have, and would be the kind of check
        // §6 describes: blind to any name it does not list, and tripped by one
        // appearing in a comment.
        runText: () => assertEq(runText, `#!/bin/sh
case $0 in */*) d=\${0%/*} ;; *) d=. ;; esac
exec nix develop --no-write-lock-file --quiet "$d" --command "$@"
`),
        // Every declared job runs on the one runner the flakes are generated
        // for. A second system would need its own `devShells.<system>.default`
        // rather than a loop, so a job that quietly declared another would
        // otherwise generate a shell no runner can enter.
        oneSystem: () => {
            for (const { system } of nixJobs) {
                assertEq(system, nixSystem)
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
