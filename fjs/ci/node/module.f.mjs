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
import { nixInstall, nixVersionCheckStep } from '../nix/module.f.mjs'

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

/** @type {(version: string) => readonly MetaStep[]} */
export const platformNodeSteps = version => [
    ...nodeInstall(node.default),
    fjsGlobalInstall(version),
    test({ run: 'fjs test' }),
]

/** @type {(version: string) => readonly MetaStep[]} */
const node22Steps = version => [
    ...nodeInstall(node.node22),
    fjsGlobalInstall(version),
    test({ run: 'fjs test' }),
    test({ run: 'node --test' }),
]

/** @type {readonly MetaStep[]} */
const node24Steps = [
    ...nodeInstall(node.node24),
    test({ run: 'node --test' }),
]

/** @type {readonly MetaStep[]} */
const packListing = /** @type {const} */ ('pack.json')

/**
 * Fails if the package ships a generated `private.d.ts`.
 *
 * `node` rather than a text search over the listing: the paths arrive as JSON
 * and are compared as whole filenames, so nothing here can mistake a path that
 * merely contains the name for one that ends in it. Root `AGENTS.md` §6 asks
 * for a tool that parses what it checks; here that tool is the runtime this
 * repository is written in, already running in every job.
 */
const noPackedPrivateDeclarations = `node -e "const f=JSON.parse(require('fs').readFileSync('${packListing}','utf8'))[0].files.map(x=>x.path).filter(x=>x.endsWith('private.d.ts'));if(f.length!==0){console.error('packed private declarations:',f);process.exit(1)}"`

const node26Steps = [
    ...nodeInstall(node.default),
    test({ run: 'npm run ci-update' }),
    test({ run: 'git add -A && git diff --cached --exit-code' }),
    // No authored `.mjs` may contain a file-scope JSDoc `@typedef` (root
    // `AGENTS.md`); `tsc` accepts one silently, so the prohibition needs its
    // own gate.
    test({ run: "! grep -rnE '^(/\\*\\*.*@typedef|\\s\\* *@typedef)' --include='*.mjs' --exclude-dir=node_modules ." }),
    test({ run: 'npx tsc' }),
    test({ run: 'npm run cov' }),
    // `--json` so the assertion below reads npm's own account of what it packed
    // rather than re-deriving it. The tarball is still written; only `--dry-run`
    // suppresses that.
    test({ run: `npm pack --json > ${packListing}` }),
    // The complement to the packed-declaration type-check, which cannot see
    // this: with `private.d.ts` shipped, every reference to it resolves and the
    // type-check is green. The two fail on opposite inputs, so neither stands
    // in for the other. Measured both ways before this landed.
    test({ run: noPackedPrivateDeclarations }),
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
    [jobId(node.node24)]: nodeJob(node24Steps),
    [jobId(node.default)]: nodeJob(node26Steps),
})

// The canonical Node jobs run on the Ubuntu ARM runner.
export const nixSystem = /** @type {const} */ ('aarch64-linux')

// Keeps `npm install -g functionalscript` writable and puts the installed `fjs`
// on `PATH` for the rest of the same `nix develop` invocation.
const npmGlobalShellHook = /** @type {const} */ (`export NPM_CONFIG_PREFIX="$HOME/.npm-global"
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
mkdir -p "$NPM_CONFIG_PREFIX"`)

// Versions of the canonical Node jobs, in job order.
const nixVersions = /** @type {const} */ ([node.node22, node.node24, node.default])

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

/**
 * Version-check steps for the canonical Node jobs' generated flakes, one per
 * job. Collected into the shared temporary `nix-flakes` job in
 * `fjs/ci/module.f.mjs`.
 *
 * @type {readonly MetaStep[]}
 */
export const nodeNixVersionSteps =
    nixVersions.map(version => nixVersionCheckStep(jobId(version), version))

/**
 * Temporary job that instantiates every generated flake.
 *
 * Nothing else in CI evaluates the generated files, so a broken flake — or one
 * whose snapshot moved to a different Node — would only surface once a real job
 * started using it. It deliberately stays separate from the canonical Node jobs:
 * those keep their current `setup-node` runtime until they are migrated one at a
 * time. When the last one migrates and this job goes away, each migrated job
 * must check its own Node version inside the `nix develop` invocation, or the
 * guarantee is lost.
 *
 * @type {Job}
 */
export const nodeNixFlakeJob = ubuntuArm([
    nixInstall,
    ...nodeNixVersionSteps,
])

export const nodeMainSteps = platformNodeSteps
