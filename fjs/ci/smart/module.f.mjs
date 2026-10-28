/**
 * Successful-check gates for this repository's CI. The original steps supply
 * both the contract and the steps that run on a miss; shared setup is gated
 * on every check that needs it. Unclassified work keeps running.
 *
 * @module
 *
 * @import { Job, Jobs, Step } from '../common/types.ts'
 * @import { Check, Platform, Rung } from './types.ts'
 */

import { array, or, string } from '../../rtti/module.f.js'
import { definedEntries } from '../../types/object/module.f.mjs'
import { stepSchema, uses } from '../common/module.f.mjs'
import { installNode } from '../node/module.f.mjs'

export const checkSchema = /** @type {const} */ ({
    id: string,
    rung: or('fjs', 'js', 'ts', 'rust'),
    steps: array(stepSchema),
})

export const checksSchema = array(checkSchema)

export const platformSchema = /** @type {const} */ ({
    os: string,
    version: string,
    architecture: string,
})

const shellPrefixes = /** @type {const} */ (['mise exec -- ', 'mise -E spidermonkey exec -- ', 'env '])

const botIdentity = /** @type {const} */ ({
    GIT_AUTHOR_NAME: 'github-actions[bot]',
    GIT_AUTHOR_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
})

/** The command inside an environment wrapper or an injected step. */
/** @type {(step: Step) => string} */
const command = step => {
    const run = step.env?.FJS_CI_RUN ?? step.run ?? ''
    const prefix = shellPrefixes.find(value => run.startsWith(value))
    return prefix === undefined ? run : run.slice(prefix.length)
}

/** @type {(step: Step, action: string) => boolean} */
const isAction = (step, action) => step.uses?.startsWith(`${action}@`) === true

/** @type {(step: Step) => boolean} */
const isEnvironmentSetup = step => isAction(step, 'jdx/mise-action')

/** Each check's terminal work. Installs and version checks are shared below. */
/** @type {(jobId: string, step: Step) => string | undefined} */
const checkId = (jobId, step) => {
    const run = command(step)
    return jobId === 'deno' || jobId === 'bun' ? 'suite'
        : run.startsWith('cargo ') ? 'rust'
        : run === 'node --test ./fjs/emergent_testing/js-only.mjs' ? 'suite'
        : run === 'tsc' ? 'tsc'
        : run === 'npm start compile' ? 'compile'
        : run === 'npm run cov' ? 'coverage'
        : run === 'npm run sm c' ? 'spidermonkey-compile'
        : run === 'npm run sm t' ? 'spidermonkey-suite'
        : step['working-directory'] !== undefined || run.startsWith('mkdir ') || run.startsWith('npm pack ')
            || isAction(step, 'actions/setup-node') && step.with?.['package-manager-cache'] === 'false'
            ? 'package'
            : undefined
}

/** @type {(id: string) => Rung} */
const rung = id => id === 'rust' ? 'rust'
    : id === 'tsc' || id === 'package' ? 'ts'
    : id === 'compile' || id === 'spidermonkey-compile' ? 'fjs'
    : 'js'

/**
 * Which checks require a step. The command strings are generated operations,
 * not source code: this adapter does not inspect the files a command reads.
 *
 * @type {(jobId: string, ids: readonly string[], step: Step) => readonly string[]}
 */
const dependencies = (jobId, ids, step) => {
    const own = checkId(jobId, step)
    const run = command(step)
    return own !== undefined ? [own]
        : run === 'npm ci' ? ids.filter(id => id !== 'rust' && !id.startsWith('spidermonkey-'))
        : isAction(step, 'dtolnay/rust-toolchain') || run.includes('rustc --version') || run.includes('wasmtime --version') || run.includes('wasmer --version')
            || run === 'sudo apt-get update && sudo apt-get install -y gcc-multilib libc6-dev-i386' ? ['rust']
        : run.includes('js --version') || run === 'mise -E spidermonkey install --locked http:spidermonkey'
            || run.startsWith('mise -E spidermonkey lock http:spidermonkey --platform ')
            ? ids.filter(id => id.startsWith('spidermonkey-'))
        : run.includes('tsc --version') ? ids.filter(id => id === 'tsc' || id === 'package')
        : isEnvironmentSetup(step) || run.includes('node --version') ? ids
        : []
}

/** @type {(ids: readonly string[]) => string} */
const misses = ids => ids.map(id => `steps.init.outputs.hit-${id} != 'true'`).join(' || ')

/** @type {(image: string) => Platform} */
export const platform = image => {
    const [os, version] = image.split('-')
    return {
        os,
        version,
        architecture: image.endsWith('-arm') || os === 'macos' && !image.endsWith('-intel') ? 'arm64' : 'x64',
    }
}

/**
 * A check records all of its prerequisites in their execution order. The
 * bootstrap Node and checkout are fixed by the protocol and its tool pins.
 *
 * @type {(jobId: string, job: Job) => readonly Check[]}
 */
export const checks = (jobId, job) => {
    const work = job.steps.filter(step => !isAction(step, 'actions/checkout'))
    const ids = /** @type {const} */ ([...new Set(work.flatMap(step => {
        const id = checkId(jobId, step)
        return id === undefined ? [] : [id]
    }))])
    return ids.map(id => ({
        id,
        rung: rung(id),
        steps: work.filter(step => dependencies(jobId, ids, step).includes(id)),
    }))
}

/** @type {(jobId: string, source: Job) => Job} */
const cachedJob = (jobId, source) => {
    const plan = checks(jobId, source)
    const ids = plan.map(({ id }) => id)
    const work = source.steps.filter(step =>
        !isAction(step, 'actions/checkout')
        && !(isAction(step, 'actions/setup-node') && step.with?.['package-manager-cache'] !== 'false'))
    // The generator drift check and demo rebuild stay uncached. Their environment
    // installation must still run when all of the cacheable checks hit.
    const uncachedShell = work.some(step =>
        shellPrefixes.some(prefix => step.run?.startsWith(prefix) === true) && dependencies(jobId, ids, step).length === 0)
    const gated = work.flatMap((step, index) => {
        const depends = dependencies(jobId, ids, step)
        const condition = depends.length === 0 || uncachedShell && (isEnvironmentSetup(step) || command(step).includes('node --version'))
            ? {} : { if: misses(depends) }
        const own = checkId(jobId, step)
        const last = own !== undefined && !work.slice(index + 1).some(next => checkId(jobId, next) === own)
        return [
            { ...step, ...condition },
            ...(last ? [{
                run: `npm start ci report ${own}`,
                if: misses([own]),
                env: botIdentity,
                'continue-on-error': /** @type {const} */ (true),
            }] : []),
        ]
    })
    return {
        ...source,
        permissions: { contents: 'write' },
        steps: [
            uses('actions/checkout', { 'fetch-depth': '1' }),
            installNode({ 'package-manager-cache': 'false' }),
            {
                run: 'git fetch --depth 1 origin build-cache:build-cache build-cache:refs/remotes/origin/build-cache',
                'continue-on-error': true,
            },
            {
                id: 'init',
                run: 'npm start ci init',
                // Missing hit flags run the checks when lookup is unavailable.
                'continue-on-error': true,
                env: {
                    // Keep GitHub expressions as contract text rather than
                    // substituting the current runner's temporary paths.
                    FJS_CI_CHECKS: JSON.stringify(plan).replaceAll('$', '\\u0024'),
                    FJS_CI_PLATFORM: JSON.stringify(platform(source['runs-on'])),
                },
            },
            ...gated,
            {
                run: 'npm start ci publish',
                if: "always() && steps.init.outcome == 'success' && github.actor != 'dependabot[bot]' && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository)",
                env: {
                    ...botIdentity,
                    GIT_COMMITTER_NAME: botIdentity.GIT_AUTHOR_NAME,
                    GIT_COMMITTER_EMAIL: botIdentity.GIT_AUTHOR_EMAIL,
                },
                'continue-on-error': true,
            },
        ],
    }
}

/** @type {(jobs: Jobs) => Jobs} */
export const smartJobs = jobs => Object.fromEntries(definedEntries(jobs).map(([id, job]) => [id, cachedJob(id, job)]))
