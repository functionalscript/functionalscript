/**
 * Proofs for generated CI flakes.
 *
 * @module
 */
import { assert, assertEq } from '../../asserts/module.f.ts'
import { step } from '../../effects/module.f.ts'
import { readUtf8File } from '../../effects/node/module.f.ts'
import { emptyState, virtual } from '../../effects/node/virtual/module.f.ts'
import { nixpkgs } from '../config/module.f.ts'
import { nodeNixJobs } from '../node/module.f.ts'
import {
    flakePath,
    flakeText,
    generatedDirectory,
    nixDevelop,
    nixFlakes,
    nixInstall,
    type NixJob,
} from './module.f.ts'

const { commit } = nixpkgs

const plain: NixJob = {
    id: 'node24',
    system: 'aarch64-linux',
    packages: [{ attribute: 'nodejs_24', version: '24.18.0' }],
}

const withShellHook: NixJob = {
    ...plain,
    id: 'node22',
    packages: [{ attribute: 'nodejs_22', version: '22.23.1' }],
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
        assert pkgs.nodejs_24.version == "24.18.0";
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
        assert pkgs.nodejs_22.version == "22.23.1";
        pkgs.mkShell {
            packages = [ pkgs.nodejs_22 ];
            shellHook = ''
                export NPM_CONFIG_PREFIX="$HOME/.npm-global"
            '';
        };
    };
}
`

const generated = (jobs: readonly NixJob[], id: string): string => {
    const written = step(
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
                const [{ attribute, version }] = packages
                const nodeMajor = id.slice('node'.length)
                assertEq(attribute, `nodejs_${nodeMajor}`)
                // The asserted version must be the one the rest of CI installs.
                assertEq(version.split('.')[0], nodeMajor)
            }
        },
        // Job data only ever reaches quotable positions, so an unusual package
        // name is escaped rather than rejected.
        quotedPackage: () => assert(
            flakeText({
                ...plain,
                packages: [{ attribute: 'not an identifier', version: '1.2.3' }],
            }).includes('pkgs."not an identifier"'),
            'expected a quoted attribute name'),
        // Every package contributes its own assertion.
        multiplePackages: () => {
            const text = flakeText({
                ...plain,
                packages: [
                    { attribute: 'nodejs_24', version: '24.18.0' },
                    { attribute: 'git', version: '2.51.0' },
                ],
            })
            assert(text.includes('assert pkgs.nodejs_24.version == "24.18.0";'), text)
            assert(text.includes('assert pkgs.git.version == "2.51.0";'), text)
            assert(text.includes('[ pkgs.nodejs_24 pkgs.git ]'), text)
        },
    },
    workflow: {
        // The path a workflow passes to `nix develop` must be the directory the
        // generator wrote the flake into.
        flakePath: () => assertEq(flakePath(plain), `./${generatedDirectory}/node24`),
        nixDevelop: () => assertEq(
            nixDevelop(plain, 'node --version'),
            'nix develop ./nix/generated/node24 --command node --version'),
        nixInstall: () => {
            assertEq(nixInstall.type, 'install')
            assert(
                nixInstall.type === 'install'
                && nixInstall.step.uses?.startsWith('cachix/install-nix-action@') === true,
                'expected the pinned Nix installer action')
        },
    },
}
