/**
 * CI step builders for Node.js: setup-node installation, platform smoke tests,
 * per-version canonical jobs.
 *
 * @module
 *
 * @import { Job, Jobs, MetaStep, Step } from '../common/types.ts'
 * @import { NixJob } from '../nix/types.ts'
 */

import { node } from '../config/module.f.mjs'
import { install, test, ubuntuArm, uses } from '../common/module.f.mjs'
import { nixDevelop, nixInstall } from '../nix/module.f.mjs'

/**
 * Name of the CI artifact carrying the `npm pack` tarball. The producing step
 * is below; a consuming job downloads it by this name.
 */
export const packageArtifact = /** @type {const} */ ('package-tarball')

/** @type {(v: string) => string} */
export const major = v => v.split('.')[0]

/** @type {(version: string) => string} */
const jobId = version => `node${major(version)}`

/**
 * The job that packs the tarball and uploads it. A consuming job names this in
 * `needs` rather than repeating the id.
 */
export const packageJobId = jobId(node.default)

/** @type {(v: string) => Step} */
const installNode = v =>
    uses('actions/setup-node', { 'node-version': v })

/** @type {(v: string) => readonly MetaStep[]} */
const nodeInstall = v => [
    install(installNode(v)),
    test({ run: 'npm ci' }),
]

/** @type {(version: string) => (extra: readonly MetaStep[]) => readonly MetaStep[]} */
export const basicNode = version => extra => [
    ...nodeInstall(version),
    ...extra,
]

/** @type {(version: string) => MetaStep} */
const fjsGlobalInstall = version =>
    install({ run: `npm install -g functionalscript@${version}` })

/**
 * Asserts that the Node a job is about to run on is the version configured for
 * it, whichever way the job got that runtime: `command` is `node --version` for
 * a job `setup-node` installs into, and the same through `nix develop` for a
 * job running in its generated flake.
 *
 * Both need it, for the same reason and against the same recorded value. A
 * `setup-node` job can be handed a different patch release than the one
 * `fjs/ci/config/module.f.mjs` names, and a migrated job's flake resolves its
 * package from the pinned Nixpkgs commit, which the configuration only claims
 * provides that version. Neither claim checks itself, and a job that quietly
 * tests on another runtime reports a green result about something nobody
 * asked for.
 *
 * The jobs that run this are the Ubuntu ones, where the step is a POSIX shell
 * command. The platform matrix installs Node too, but its Windows jobs run
 * `run` steps under PowerShell, so this spelling does not belong there.
 *
 * @type {(command: string, version: string) => MetaStep}
 */
const nodeVersionStep = (command, version) =>
    test({ run: `test "$(${command})" = v${version}` })

/** @type {(version: string) => readonly MetaStep[]} */
export const platformNodeSteps = version => [
    ...nodeInstall(node.default),
    fjsGlobalInstall(version),
    test({ run: 'fjs test' }),
]

/** @type {(version: string) => readonly MetaStep[]} */
const node22Steps = version => [
    ...nodeInstall(node.node22),
    nodeVersionStep('node --version', node.node22),
    fjsGlobalInstall(version),
    test({ run: 'fjs test' }),
    test({ run: 'node --test' }),
]

/**
 * The first job migrated off `setup-node`: it runs through its own generated
 * flake, so the runtime it tests on is the pinned Nixpkgs snapshot rather than
 * whatever the runner installs.
 *
 * Its commands and their order are the ones it had, each still its own step
 * (root `AGENTS.md` §7) and each entering the shell again — behind the same
 * version check its `setup-node` siblings make, against the same recorded
 * value, so the migration is visible as a change of runtime rather than a
 * change of what CI guarantees.
 *
 * @type {readonly MetaStep[]}
 */
const node24NixSteps = [
    nixInstall,
    nodeVersionStep(nixDevelop(jobId(node.node24), 'node --version'), node.node24),
    ...['npm ci', 'node --test'].map(
        command => test({ run: nixDevelop(jobId(node.node24), command) })),
]

/** @type {readonly MetaStep[]} */
const node26Steps = [
    ...nodeInstall(node.default),
    nodeVersionStep('node --version', node.default),
    test({ run: 'npm run ci-update' }),
    test({ run: 'git add -A && git diff --cached --exit-code' }),
    // No authored `.mjs` may contain a file-scope JSDoc `@typedef` (root
    // `AGENTS.md`); `tsc` accepts one silently, so the prohibition needs its
    // own gate.
    test({ run: "! grep -rnE '^(/\\*\\*.*@typedef|\\s\\* *@typedef)' --include='*.mjs' --exclude-dir=node_modules ." }),
    test({ run: 'npx tsc' }),
    test({ run: 'npm run cov' }),
    test({ run: 'npm pack' }),
    // Hands the tarball to a job that has no checkout, which is the only place
    // the package can be checked as a consumer sees it. `if-no-files-found`
    // must be `error`: the default warns and uploads nothing, so a consuming
    // job would fail later on a missing artifact rather than here on the real
    // cause.
    test(uses('actions/upload-artifact', {
        name: packageArtifact,
        path: '*.tgz',
        'if-no-files-found': 'error',
    })),
]

/** @type {(steps: readonly MetaStep[]) => Job} */
const nodeJob = steps => ubuntuArm(steps)

/** @type {(version: string) => Jobs} */
export const nodeVersionJobs = version => ({
    [jobId(node.node22)]: nodeJob(node22Steps(version)),
    [jobId(node.node24)]: nodeJob(node24NixSteps),
    [jobId(node.default)]: nodeJob(node26Steps),
})

// The canonical Node jobs run on the Ubuntu ARM runner.
export const nixSystem = /** @type {const} */ ('aarch64-linux')

// Keeps `npm install -g functionalscript` writable and puts the installed `fjs`
// on `PATH` for the rest of the same `nix develop` invocation.
const npmGlobalShellHook = /** @type {const} */ (`export NPM_CONFIG_PREFIX="$HOME/.npm-global"
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
mkdir -p "$NPM_CONFIG_PREFIX"`)

/** @type {(version: string) => NixJob} */
const nixJob = version => ({
    id: jobId(version),
    system: nixSystem,
    packages: [`nodejs_${major(version)}`],
})

/** Generated development environments for the canonical Node jobs.
 *
 * @type {readonly NixJob[]}
 */
export const nodeNixJobs = [
    { ...nixJob(node.node22), shellHook: npmGlobalShellHook },
    nixJob(node.node24),
    nixJob(node.default),
]

export const nodeMainSteps = platformNodeSteps
