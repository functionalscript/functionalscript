/**
 * Pixi CI execution using the checkout's committed manifest and lock.
 * @module
 * @import { Job, Jobs, Step } from '../common/types.ts'
 */
import { actions, bun, node, pixiBun, pixiTypescript, pixiWasmer, rust, spidermonkey, typescript, wasmer, wasmtime } from '../config/module.f.js'
import { wasmTargets } from '../rust/module.f.mjs'

/** @type {(command: string) => string} */
export const pixiDevelop = command => `pixi run --locked --environment ci ${command}`

import { commandPrefix as oldPrefix } from '../environment/module.f.mjs'
const nodeCheck = `test "$(node --version)" = "v${node}"`

/** @type {(step: Step, platform: boolean) => readonly Step[]} */
const migrateStep = (step, platform) => {
    if (step.uses?.startsWith('dtolnay/rust-toolchain@') === true
        || step.uses?.startsWith('actions/checkout@') === true
        || (platform && step.uses?.startsWith('actions/setup-node@') === true)) { return [] }
    if (step.run === undefined || step['working-directory'] !== undefined) { return [step] }
    if (platform && !step.run.includes(oldPrefix) && step.run !== nodeCheck) {
        return [{
            ...step,
            run: pixiDevelop('bash -e -c "$FJS_CI_RUN"'),
            env: { ...step.env, FJS_CI_RUN: step.run },
            shell: 'bash',
        }]
    }
    const run = step.run.includes(oldPrefix)
        ? step.run.split(oldPrefix).join(pixiDevelop(''))
            .replace(`Version ${typescript.version}`, `Version ${pixiTypescript}`)
            .replace(`= "${bun}"`, `= "${pixiBun}"`)
            .replace(`wasmer ${wasmer}`, `wasmer ${pixiWasmer}`)
            .replace(pixiDevelop('wasmtime --version'), `${pixiDevelop('wasmtime --version')} | cut -d ' ' -f 1-2`)
        : step.run === nodeCheck
            ? `test "$(${pixiDevelop('node --version')})" = "v${node}"`
            : step.run
    return [{ ...step, run, shell: 'bash' }]
}

/** @type {(id: string, job: Job, hasRust: boolean) => Job} */
const migrateJob = (id, job, hasRust) => {
    const platform = id.startsWith('ubuntu-') || id.startsWith('macos-') || id.startsWith('windows-')
    const armLinux = id === 'ubuntu-arm'
    const targets = armLinux ? wasmTargets
        : id === 'ubuntu-intel' ? ['i686-unknown-linux-gnu']
            : id === 'windows-intel' ? ['i686-pc-windows-msvc'] : []
    return {
        ...job,
        steps: [
            ...(hasRust && platform ? [{
                uses: `dtolnay/rust-toolchain@${rust}`,
                with: { components: 'rustfmt,clippy', ...(targets.length === 0 ? {} : { targets: targets.join(',') }) },
            }] : []),
            { uses: `actions/checkout@${actions['actions/checkout']}` },
            {
                uses: `prefix-dev/setup-pixi@${actions['prefix-dev/setup-pixi']}`,
                with: { 'pixi-version': 'v0.83.0', environments: 'ci', locked: 'true', cache: 'true' },
            },
            { run: pixiDevelop(`npm install --prefix .pixi/ci-tools/npm typescript@${pixiTypescript} bun@${pixiBun}`), shell: 'bash' },
            ...(hasRust && id === 'ubuntu-intel' ? [{
                run: 'sudo apt-get update && sudo apt-get install -y gcc-multilib libc6-dev-i386',
                shell: 'bash',
            }] : []),
            ...(armLinux ? [
                ...(hasRust ? [{
                    run: pixiDevelop(`sh fjs/ci/pixi/install-supplements.sh wasmtime ${wasmtime}`),
                    shell: 'bash',
                }] : []),
                {
                    run: pixiDevelop(`sh fjs/ci/pixi/install-supplements.sh spidermonkey ${spidermonkey.version}`),
                    shell: 'bash',
                },
            ] : []),
            ...job.steps.flatMap(step => migrateStep(step, platform)),
        ],
    }
}

/** @type {(jobs: Jobs, hasRust: boolean) => Jobs} */
export const pixiJobs = (jobs, hasRust) => Object.fromEntries(
    Object.entries(jobs).flatMap(([id, job]) => job === undefined ? [] : [[id, migrateJob(id, job, hasRust)]]))
