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
    nixDevelopAll,
    nixFlakes,
    nixInstall,
    ociLoad,
    ociRunAll,
    type NixJob,
} from './module.f.ts'

const { commit } = nixpkgs

const plain: NixJob = {
    id: 'node24',
    system: 'aarch64-linux',
    packages: ['nodejs_24'],
}

const withShellHook: NixJob = {
    ...plain,
    id: 'node22',
    packages: ['nodejs_22'],
    shellHook: `export NPM_CONFIG_PREFIX="$HOME/.npm-global"`,
}

const withOci: NixJob = {
    ...plain,
    id: 'browsers',
    env: { BROWSERS: ['pkgs', 'playwright-driver', 'browsers'] },
    oci: {
        name: 'functionalscript-browsers',
        contents: [['bashInteractive'], ['dockerTools', 'binSh']],
        workDirectory: 'workspace',
    },
}

const plainFlake = `{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/${commit}";
    outputs = { nixpkgs, ... }: let
        pkgs = import nixpkgs {
            system = "aarch64-linux";
        };
    in
    {
        devShells.aarch64-linux.default = pkgs.mkShell {
            packages = [ pkgs.nodejs_24 ];
        };
    };
}
`

const shellHookFlake = `{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/${commit}";
    outputs = { nixpkgs, ... }: let
        pkgs = import nixpkgs {
            system = "aarch64-linux";
        };
    in
    {
        devShells.aarch64-linux.default = pkgs.mkShell {
            packages = [ pkgs.nodejs_22 ];
            shellHook = ''
                export NPM_CONFIG_PREFIX="$HOME/.npm-global"
            '';
        };
    };
}
`

const ociFlake = `{
    inputs.nixpkgs.url = "github:NixOS/nixpkgs/${commit}";
    outputs = { nixpkgs, ... }: let
        pkgs = import nixpkgs {
            system = "aarch64-linux";
        };
    in
    {
        devShells.aarch64-linux.default = pkgs.mkShell {
            packages = [ pkgs.nodejs_24 ];
            BROWSERS = pkgs.playwright-driver.browsers;
        };
        packages.aarch64-linux.oci = pkgs.dockerTools.streamLayeredImage {
            name = "functionalscript-browsers";
            tag = "${commit}";
            contents = [ pkgs.nodejs_24 pkgs.bashInteractive pkgs.dockerTools.binSh ];
            config = {
                Env = [ "BROWSERS=\${pkgs.playwright-driver.browsers}" "PATH=/bin:/usr/bin" "HOME=/tmp" ];
                WorkingDir = "/workspace";
                Cmd = [ "/bin/sh" ];
            };
            extraCommands = ''
                mkdir -p tmp workspace
                chmod 1777 tmp
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
        // The image and the shell come from one declaration: the job's packages
        // and environment reach both, and only the container-specific parts —
        // its own `PATH` and `HOME`, and the directories it writes to — are
        // added by the generator.
        oci: () => assertEq(flakeText(withOci), ociFlake),
        // A job without an image has no `packages` output at all.
        noOci: () => assert(
            !flakeText(plain).includes('packages.aarch64-linux'),
            'expected no image output'),
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
        ociLoad: () => assertEq(
            ociLoad(withOci.id),
            '"$(nix build ./nix/generated/browsers#oci --no-link --print-out-paths)" | docker load'),
        ociRunAll: () => {
            const { oci } = withOci
            assert(oci !== undefined, 'expected an image')
            assertEq(
                ociRunAll(oci, ['npm ci', 'npx playwright test']),
                `docker run --rm --ipc=host --volume "$PWD:/workspace" functionalscript-browsers:${commit} bash -euo pipefail -c 'npm ci && npx playwright test'`)
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
