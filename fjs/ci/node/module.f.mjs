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

/**
 * The last job still installing its runtime with `setup-node`. Its version check
 * comes before `npm ci` rather than after: `npm ci` runs `preinstall`/`install`/
 * `postinstall` hooks from the project and its dependencies, so a runner handed
 * a different patch release would execute that code on the wrong Node and could
 * fail there instead of on the diagnostic written for it.
 *
 * That is why this job does not reuse `nodeInstall`. The platform matrix does,
 * and gets no check — its Windows jobs run `run` steps under PowerShell, where
 * this POSIX spelling would not survive.
 *
 * @type {(version: string) => readonly MetaStep[]}
 */
const node22Steps = version => [
    install(installNode(node.node22)),
    nodeVersionStep('node --version', node.node22),
    test({ run: 'npm ci' }),
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

/**
 * The generated-file job, migrated. Its commands run on the pinned Node like
 * Node 24's, with two differences that come from what this job does rather than
 * from Nix.
 *
 * `npm run ci-update` and the drift check it feeds run **last**, after every
 * other command. The check compares the working tree against what the generator
 * produces, so putting it at the end makes it the last word: any file an earlier
 * step wrote is in the comparison. Nothing those steps leave behind is tracked —
 * `npm pack`'s tarball and the declarations its `prepack` emits are ignored, as
 * is the `flake.lock` Nix writes beside a flake it enters — so the check sees
 * generator output and nothing else.
 *
 * The drift check itself is not a Nix command. `git` is the runner's tool, as it
 * is for a `setup-node` job, and a step names the flake only when it needs
 * something the flake pins.
 *
 * @type {readonly MetaStep[]}
 */
const node26NixSteps = [
    nixInstall,
    nodeVersionStep(nixDevelop(jobId(node.default), 'node --version'), node.default),
    ...['npm ci', 'npx tsc', 'npm run cov', 'npm pack', 'npm run ci-update'].map(
        command => test({ run: nixDevelop(jobId(node.default), command) })),
    test({ run: 'git add -A && git diff --cached --exit-code' }),
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
    [jobId(node.default)]: nodeJob(node26NixSteps),
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
