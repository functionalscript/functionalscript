/**
 * Proofs for generated CI flakes.
 *
 * @import { NixJob } from './types.ts'
 */

import { assert, assertEq } from '../../asserts/module.f.mjs'
import { step as ioStep } from '../../effects/module.f.mjs'
import { readUtf8File } from '../../effects/node/module.f.mjs'
import { emptyState, virtual } from '../../effects/node/virtual/module.f.mjs'
import { nixpkgs } from '../config/module.f.mjs'
import { nodeNixJobs } from '../node/module.f.mjs'
import {
    flakePath,
    flakeText,
    generatedDirectory,
    nixDevelop,
    nixDevelopAll,
    nixFlakes,
    nixInstall,
    nixVersionCheckStep,
    nodeVersionCheck,
} from './module.f.mjs'

const { commit } = nixpkgs

/** @type {NixJob} */
const plain = {
    id: 'node24',
    system: 'aarch64-linux',
    packages: ['nodejs_24'],
}

/** @type {NixJob} */
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

/** @type {(jobs: readonly NixJob[], id: string) => string} */
const generated = (jobs, id) => {
    const written = ioStep(
        nixFlakes(jobs),
        () => readUtf8File(`${generatedDirectory}/${id}/flake.nix`))
    const [, [tag, result]] = virtual(emptyState)(written)
    assert(tag === 'ok', result)
    return result
}

export const proof = {
    flakeText: {
        plain: () => assertEq(flakeText(plain), plainFlake),
        shellHook: () => assertEq(flakeText(withShellHook), shellHookFlake),
    },
    nixFlakes: {
        write: () => assertEq(generated([plain], plain.id), plainFlake),
        every: () => {
            for (const job of nodeNixJobs) {
                assertEq(generated(nodeNixJobs, job.id), flakeText(job))
            }
        },
        nodeShellHook: () => {
            const [node22] = nodeNixJobs
            assert(node22.shellHook !== undefined, 'expected a Node 22 shell hook')
            assert(
                generated(nodeNixJobs, node22.id).includes('$HOME/.npm-global'),
                'expected the Node 22 global installation prefix')
        },
        packages: () => {
            for (const { id, packages } of nodeNixJobs) {
                assertEq(packages.length, 1)
                assertEq(packages[0], `nodejs_${id.slice('node'.length)}`)
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
        nixDevelop: () => assertEq(
            nixDevelop(plain.id, 'node --version'),
            'nix develop ./nix/generated/node24 --command node --version'),
        nixDevelopAll: {
            sequence: () => assertEq(
                nixDevelopAll(plain.id, ['npm ci', 'node --test']),
                `nix develop ./nix/generated/node24 --command bash -euo pipefail -c 'npm ci && node --test'`),
            // A command carrying its own quote must not end the outer one: the
            // shell has to see the script back exactly as it was written.
            quote: () => assertEq(
                nixDevelopAll(plain.id, [`printf '%s' 'a b'`]),
                `nix develop ./nix/generated/node24 --command bash -euo pipefail -c 'printf '\\''%s'\\'' '\\''a b'\\'''`),
        },
        nodeVersionCheck: () => assertEq(
            nodeVersionCheck('24.19.0'),
            `test "$(node --version)" = v24.19.0`),
        // The check a job that has not migrated yet makes: the same command a
        // migrated job runs first, in the same shell, with nothing after it.
        nixVersionCheckStep: () => {
            const step = nixVersionCheckStep(plain.id, '24.19.0')
            assertEq(step.type, 'test')
            assertEq(
                step.type === 'test' ? step.step.run : undefined,
                `nix develop ./nix/generated/node24 --command bash -euo pipefail -c 'test "$(node --version)" = v24.19.0'`)
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
