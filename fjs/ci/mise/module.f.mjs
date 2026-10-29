/** Shared mise setup and one-command CI execution. @module
 * @import { Job, Jobs, MetaStep, Step } from '../common/types.ts'
 */

import { definedEntries } from '../../types/object/module.f.mjs'
import { node, rust as rustVersion } from '../config/module.f.js'
import { test, uses } from '../common/module.f.mjs'
import { commandPrefix } from '../environment/module.f.mjs'

/** Keep rustup's toolchains and Cargo proxies inside the cached mise tree.
 * The sibling directory stays outside the checkout on every runner platform.
 */
export const miseEnvironment = /** @type {const} */ ({
    MISE_DATA_DIR: '${{ github.workspace }}-mise',
    MISE_RUSTUP_HOME: '${{ github.workspace }}-mise/rustup',
    MISE_CARGO_HOME: '${{ github.workspace }}-mise/cargo',
})

/** Setup reads the checkout's committed baseline lock. */
export const miseInstall = /** @type {const} */ ({ type: 'test', step: {
    ...uses('jdx/mise-action', {
        version: '2026.10.19',
        install_args: '--locked',
        cache: 'true',
        cache_key_prefix: 'mise-rust-v1',
        cache_max_age_days: '0',
        env: 'false',
        add_shims_to_path: 'false',
    }),
    // The action renames its download into place; Windows needs the same drive.
    env: { TEMP: '${{ runner.temp }}', TMP: '${{ runner.temp }}' },
} })

/** @type {(command: string) => string} */
export const miseDevelop = command => `mise exec -- ${command}`

/** @type {(commands: readonly string[]) => readonly MetaStep[]} */
export const miseSteps = commands => commands.map(command => test({ run: miseDevelop(command), shell: 'bash' }))

/** @type {(command: string, expected: string) => MetaStep} */
export const miseVersionStep = (command, expected) =>
    test({ run: `test "$(${miseDevelop(command)})" = "${expected}"`, shell: 'bash' })

/** SpiderMonkey's publisher manifest is verified at install, outside the baseline lock. */
export const spiderMonkeyInstall = /** @type {const} */ ({ type: 'test', step: {
    run: 'mise -E spidermonkey install --locked http:spidermonkey',
    shell: 'bash',
} })

/** @type {(command: string) => string} */
export const spiderMonkeyDevelop = command => `mise -E spidermonkey exec -- ${command}`

/** @type {(step: Step, action: string) => boolean} */
const action = (step, name) => step.uses?.startsWith(`${name}@`) === true

/** Setup-node remains only where the packed consumer deliberately leaves the environment. */
/** @type {(step: Step) => boolean} */
const replacedSetup = step => action(step, 'dtolnay/rust-toolchain')
    || action(step, 'actions/setup-node') && step.with?.['package-manager-cache'] !== 'false'

/**
 * Translate the assembler's existing checks without changing their commands.
 * Injected scripts retain their original environment transport and shell.
 * Consumer-directory steps deliberately run outside mise.
 * @type {(step: Step) => Step}
 */
const migratedStep = step => {
    const run = step.run
    if (run === undefined || step['working-directory'] !== undefined) { return step }
    const spiderMonkey = run.includes('js --version') || run.includes('npm run sm ')
    const prefix = spiderMonkey ? spiderMonkeyDevelop('') : miseDevelop('')
    const generated = run.startsWith(commandPrefix) || run.startsWith(`test "$(${commandPrefix}`)
    const translated = generated
        ? run.replaceAll(commandPrefix, prefix)
            // Upstream Wasmtime adds its build id; compare the configured version.
            .replaceAll('wasmtime --version)', "wasmtime --version | cut -d' ' -f1,2)")
        : run === `test "$(node --version)" = "v${node}"`
            ? `test "$(mise exec -- node --version)" = "v${node}"`
            : run
    const shell = /** @type {const} */ ({ shell: 'bash' })
    if (translated !== run || run.startsWith('git ') || run.startsWith('mkdir ')) {
        return { ...step, ...shell, run: translated }
    }
    if (['cargo ', 'npm ', 'node ', 'fjs ', 'tsc'].some(command => run.startsWith(command))) {
        return { ...step, ...shell, run: miseDevelop(run) }
    }
    return {
        ...step, ...shell,
        run: miseDevelop('bash -e -c "$FJS_CI_RUN"'),
        env: { ...step.env, FJS_CI_RUN: run },
    }
}

/**
 * CI execution using the checkout's committed tool manifest and lock.
 * @type {(jobs: Jobs, rust: boolean) => Jobs}
 */
export const miseJobs = (jobs, rust) => Object.fromEntries(definedEntries(jobs).map(([id, job]) => {
    const kept = job.steps.filter(step => !replacedSetup(step))
    const checkout = kept.findIndex(step => action(step, 'actions/checkout'))
    const before = kept.slice(0, checkout)
    const after = kept.slice(checkout + 1)
    /** @type {Job} */
    const result = {
        ...job,
        env: { ...job.env, ...miseEnvironment },
        steps: [
            ...before.filter(step => step.run === undefined),
            ...kept.slice(checkout, checkout + 1),
            miseInstall.step,
            ...(id.startsWith('windows-') ? [/** @type {{ readonly step: Step }} */ (miseVersionStep('node --version', `v${node}`)).step] : []),
            ...(rust && id.includes('-') ? [{ run: `test "$(mise exec -- rustc --version | cut -d' ' -f1,2)" = "rustc ${rustVersion}"`, shell: 'bash' }] : []),
            ...(rust && id === 'ubuntu-intel' ? [{
                run: 'sudo apt-get update && sudo apt-get install -y gcc-multilib libc6-dev-i386',
                shell: 'bash',
            }] : []),
            ...(id === 'ubuntu-arm' ? [{ run: 'mise -E spidermonkey lock http:spidermonkey --platform linux-arm64', shell: 'bash' }, spiderMonkeyInstall.step] : []),
            ...before.filter(step => step.run !== undefined).map(migratedStep),
            ...after.map(migratedStep),
        ],
    }
    return [id, result]
}))
