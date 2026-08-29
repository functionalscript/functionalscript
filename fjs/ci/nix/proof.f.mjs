/**
 * Proofs for generated CI flakes.
 *
 * @import { NixJob } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { step as ioStep } from '../../effects/module.f.mjs'
import { readUtf8File } from '../../effects/node/module.f.mjs'
import { emptyState, virtual } from '../../effects/node/virtual/module.f.mjs'
import { nixpkgs } from '../config/module.f.mjs'
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
        // the command's exit status; `dirname "$0"` finds the flake from the
        // script rather than from the working directory; `"$@"` passes the
        // caller's arguments through unsplit.
        runText: () => assertEq(runText, `#!/bin/sh
exec nix develop --no-write-lock-file --quiet "$(dirname "$0")" --command "$@"
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
                'test "$(./nix/node24/run node --version)" = v24.19.0')
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
