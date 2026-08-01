/**
 * CI step builders for Node.js: setup-node installation, platform smoke tests,
 * per-version canonical jobs.
 *
 * @module
 */
import { node } from '../config/module.f.ts'
import { type Job, type Jobs, type MetaStep, install, test, ubuntuArm, uses } from '../common/module.f.ts'
import { nixDevelop, nixInstall, type NixJob } from '../nix/module.f.ts'

export const major = (v: string): string => v.split('.')[0]

const jobId = (version: string): string => `node${major(version)}`

const installNode = (version: string) =>
    uses('actions/setup-node', { 'node-version': version })

const nodeInstall = (v: string) => [
    install(installNode(v)),
    test({ run: 'npm ci' }),
]

export const basicNode = (version: string) => (extra: readonly MetaStep[]): readonly MetaStep[] => [
    ...nodeInstall(version),
    ...extra,
]

const fjsGlobalInstall = (version: string): MetaStep =>
    install({ run: `npm install -g functionalscript@${version}` })

export const platformNodeSteps = (version: string): readonly MetaStep[] => [
    ...nodeInstall(node.default),
    fjsGlobalInstall(version),
    test({ run: 'fjs t' }),
]

const node22Steps = (version: string): readonly MetaStep[] => [
    ...nodeInstall(node.node22),
    fjsGlobalInstall(version),
    test({ run: 'fjs t' }),
    test({ run: 'node --test' }),
]

const node24Steps: readonly MetaStep[] = [
    ...nodeInstall(node.node24),
    test({ run: 'node --test' }),
]

const node26Steps: readonly MetaStep[] = [
    ...nodeInstall(node.default),
    test({ run: 'npm run ci-update' }),
    test({ run: 'git add -A && git diff --cached --exit-code' }),
    test({ run: 'npx tsc' }),
    test({ run: 'npm run cov' }),
    test({ run: 'npm pack' }),
]

const nodeJob = (steps: readonly MetaStep[]): Job => ubuntuArm(steps)

export const nodeVersionJobs = (version: string): Jobs => ({
    [jobId(node.node22)]: nodeJob(node22Steps(version)),
    [jobId(node.node24)]: nodeJob(node24Steps),
    [jobId(node.default)]: nodeJob(node26Steps),
})

// The canonical Node jobs run on the Ubuntu ARM runner.
const nixSystem = 'aarch64-linux' as const

// Keeps `npm install -g functionalscript` writable and puts the installed `fjs`
// on `PATH` for the rest of the same `nix develop` invocation.
const npmGlobalShellHook = `export NPM_CONFIG_PREFIX="$HOME/.npm-global"
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
mkdir -p "$NPM_CONFIG_PREFIX"` as const

const nixJob = (version: string): NixJob => ({
    id: jobId(version),
    system: nixSystem,
    packages: [{ attribute: `nodejs_${major(version)}`, version }],
})

/** Generated development environments for the canonical Node jobs. */
export const nodeNixJobs: readonly NixJob[] = [
    { ...nixJob(node.node22), shellHook: npmGlobalShellHook },
    nixJob(node.node24),
    nixJob(node.default),
]

// The flake's own assertion covers the package's declared version; this checks
// the shell actually puts that Node on `PATH`, which a wrong `packages` entry
// would break without failing the assertion.
const nodeVersionStep = (job: NixJob): MetaStep => {
    const [{ version }] = job.packages
    return test({ run: `test "$(${nixDevelop(job, 'node --version')})" = v${version}` })
}

/**
 * Temporary job that instantiates every generated flake.
 *
 * Nothing else in CI evaluates the generated files, so a broken flake would
 * only surface once a real job started using one. This job installs Nix and
 * builds each development shell, checking that it provides exactly the Node
 * version `config` pins. It deliberately stays separate from the canonical Node
 * jobs: those keep their current `setup-node` runtime until they are migrated
 * one at a time, and this job is deleted once they all run through
 * `nix develop`.
 */
export const nodeNixFlakeJob: Job = ubuntuArm([
    nixInstall,
    ...nodeNixJobs.map(nodeVersionStep),
])

export const nodeMainSteps = platformNodeSteps
