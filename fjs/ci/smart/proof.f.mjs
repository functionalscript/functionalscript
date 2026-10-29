/**
 * @import { Job, Step } from '../common/types.ts'
 */

import { assert, assertEq, assertOk, assertStructurallySame } from '../../asserts/module.f.js'
import { parse } from '../../rtti/parse/module.f.mjs'
import { checks, checksSchema, platform, platformSchema, smartJobs } from './module.f.mjs'
import { uses } from '../common/module.f.mjs'
import { installNode } from '../node/module.f.mjs'
import { jobTimeout } from '../config/module.f.js'

/** @type {(steps: readonly Step[], image?: string) => Job} */
const job = (steps, image = 'ubuntu-26.04-arm') => ({
    'runs-on': image,
    'timeout-minutes': jobTimeout,
    steps,
})

/** @type {(steps: readonly Step[], id?: string) => Job} */
const cached = (steps, id = 'node26') => {
    const result = smartJobs({ [id]: job(steps) })[id]
    assert(result !== undefined)
    return result
}

/** @type {(source: Job, run: string) => Step} */
const stepWith = (source, run) => {
    const result = source.steps.find(step => step.run === run)
    assert(result !== undefined, run)
    return result
}

const mise = uses('jdx/mise-action')
const nodeVersion = /** @type {const} */ ({ run: 'test "$(mise exec -- node --version)" = "v26.13.0"' })
const tscVersion = /** @type {const} */ ({ run: 'test "$(mise exec -- tsc --version)" = "Version 7.0.2"' })
const install = /** @type {const} */ ({ run: 'mise exec -- npm ci' })
const suite = /** @type {const} */ ({ run: 'mise exec -- node --test ./fjs/emergent_testing/js-only.mjs' })
const compile = /** @type {const} */ ({ run: 'mise exec -- npm start compile' })
const tsc = /** @type {const} */ ({ run: 'mise exec -- tsc' })
const coverage = /** @type {const} */ ({ run: 'mise exec -- npm run cov' })
const pack = /** @type {const} */ ({ run: 'mise exec -- npm pack --pack-destination "$RUNNER_TEMP/consumer"' })
const rustVersion = /** @type {const} */ ({ run: `test "$(mise exec -- rustc --version | cut -d' ' -f1,2)" = "rustc 1.99.1"`, shell: 'bash' })
const multilib = /** @type {const} */ ({ run: 'sudo apt-get update && sudo apt-get install -y gcc-multilib libc6-dev-i386', shell: 'bash' })
const spidermonkeyLock = /** @type {const} */ ({ run: 'mise -E spidermonkey lock http:spidermonkey --platform linux-arm64', shell: 'bash' })
const spidermonkeyInstall = /** @type {const} */ ({ run: 'mise -E spidermonkey install --locked http:spidermonkey', shell: 'bash' })
const consumer = /** @type {const} */ ({ run: 'node good.mts', 'working-directory': '${{ runner.temp }}/consumer' })

export const proof = /** @type {const} */ ({
    platform: () => {
        for (const [image, expected] of /** @type {const} */ ([
            ['ubuntu-26.04', { os: 'ubuntu', version: '26.04', architecture: 'x64' }],
            ['ubuntu-26.04-arm', { os: 'ubuntu', version: '26.04', architecture: 'arm64' }],
            ['macos-26', { os: 'macos', version: '26', architecture: 'arm64' }],
            ['macos-26-intel', { os: 'macos', version: '26', architecture: 'x64' }],
            ['windows-11-arm', { os: 'windows', version: '11', architecture: 'arm64' }],
            ['windows-2025', { os: 'windows', version: '2025', architecture: 'x64' }],
        ])) {
            assertStructurallySame(platform(image), expected)
            assertOk(parse(platformSchema)(expected))
        }
    },
    /** Commands and shared prerequisites keep their original execution order. */
    checks: () => {
        const source = job([uses('actions/checkout'), mise, nodeVersion, tscVersion, install, tsc, compile, coverage, pack, consumer])
        const result = checks('node26', source)
        assertStructurallySame(result, [
            { id: 'tsc', rung: 'ts', steps: [mise, nodeVersion, tscVersion, install, tsc] },
            { id: 'compile', rung: 'fjs', steps: [mise, nodeVersion, install, compile] },
            { id: 'coverage', rung: 'js', steps: [mise, nodeVersion, install, coverage] },
            { id: 'package', rung: 'ts', steps: [mise, nodeVersion, tscVersion, install, pack, consumer] },
        ])
        assertOk(parse(checksSchema)(result))
    },
    /** mise supplies Node before init; cache hits still skip check prerequisites. */
    bootstrap: () => {
        const source = cached([mise, installNode(), uses('actions/checkout'), nodeVersion, install, suite])
        assertStructurallySame(source.permissions, { contents: 'write' })
        assertStructurallySame(source.steps[0], uses('actions/checkout', { 'fetch-depth': '1' }))
        assertStructurallySame(source.steps[1], mise)
        assertEq(source.steps.filter(step => step.uses?.startsWith('actions/setup-node@')).length, 0)
        assertEq(source.steps.find(step => step.id === 'init')?.run, 'mise exec -- npm start ci init')
        assertEq(source.steps.find(step => step.uses === mise.uses)?.if, undefined)
        assert(source.steps.indexOf(mise) < source.steps.findIndex(step => step.id === 'init'))
        assertEq(stepWith(source, install.run).if, "steps.init.outputs.hit-suite != 'true'")
        assertEq(stepWith(source, suite.run).if, "steps.init.outputs.hit-suite != 'true'")
        assertEq(stepWith(source, 'mise exec -- npm start ci report suite').if, "steps.init.outputs.hit-suite != 'true'")
        assertEq(stepWith(source, 'git fetch --depth 1 origin build-cache:build-cache build-cache:refs/remotes/origin/build-cache')['continue-on-error'], true)
        const publish = stepWith(source, 'mise exec -- npm start ci publish')
        assertEq(publish['continue-on-error'], true)
        assert(publish.if?.includes('always()') === true)
        assert(publish.if?.includes("steps.init.outcome == 'success'") === true)
        assert(publish.if?.includes("github.actor != 'dependabot[bot]'") === true)
        assert(publish.if?.includes('github.event.pull_request.head.repo.full_name == github.repository') === true)
        assertStructurallySame(publish.env, {
            GIT_AUTHOR_NAME: 'github-actions[bot]',
            GIT_AUTHOR_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
            GIT_COMMITTER_NAME: 'github-actions[bot]',
            GIT_COMMITTER_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
        })
        assertEq(source.steps.at(-1), publish)
    },
    /** A cache failure leaves the remaining checks strict and able to run. */
    cacheFailuresDoNotStopChecks: () => {
        const source = cached([{ run: 'cargo test' }, suite], 'ubuntu-intel')
        const rust = stepWith(source, 'cargo test')
        const report = stepWith(source, 'mise exec -- npm start ci report rust')
        const next = stepWith(source, suite.run)
        const bootstrap = stepWith(source, 'mise exec -- npm start ci init')
        assertEq(bootstrap['continue-on-error'], true)
        assertEq(report['continue-on-error'], true)
        assertStructurallySame(report.env, {
            GIT_AUTHOR_NAME: 'github-actions[bot]',
            GIT_AUTHOR_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
        })
        assert(source.steps.indexOf(rust) < source.steps.indexOf(report))
        assert(source.steps.indexOf(report) < source.steps.indexOf(next))
        assertEq(rust['continue-on-error'], undefined)
        assertEq(next['continue-on-error'], undefined)
        assertEq(next.if, "steps.init.outputs.hit-suite != 'true'")
        assert(source.steps.every(step => !step.run?.startsWith('git config user.')))
        assert(source.steps.filter(step => step.run?.startsWith('mise exec -- npm start ci report '))
            .every(step => step['continue-on-error'] === true))
    },
    /** A partial hit cannot skip npm ci when another dependent check misses. */
    sharedInstallAndPackage: () => {
        const source = cached([
            mise, install, tsc, compile, coverage,
            { run: 'mkdir "$RUNNER_TEMP/consumer"' }, pack,
            installNode({ 'package-manager-cache': 'false' }), consumer,
        ])
        const gate = /** @type {const} */ ("steps.init.outputs.hit-tsc != 'true' || steps.init.outputs.hit-compile != 'true' || steps.init.outputs.hit-coverage != 'true' || steps.init.outputs.hit-package != 'true'")
        assertEq(stepWith(source, install.run).if, gate)
        for (const run of ['mkdir "$RUNNER_TEMP/consumer"', pack.run, consumer.run]) {
            assertEq(stepWith(source, run).if, "steps.init.outputs.hit-package != 'true'")
        }
        assertEq(source.steps.find(step => step.uses?.startsWith('actions/setup-node@') && step.if !== undefined)?.if, "steps.init.outputs.hit-package != 'true'")
        assertEq(source.steps.find(step => step.id === 'init')?.env, undefined)
        assert(checks('node26', job([consumer]))[0]?.steps[0]?.['working-directory'] === '${{ runner.temp }}/consumer')
        assertEq(source.steps.filter(step => step.run === 'mise exec -- npm start ci report package').length, 1)
    },
    /** Uncached generator and injected demo work still gets its mise environment. */
    uncachedShell: () => {
        const source = cached([
            mise, nodeVersion, suite,
            { run: 'mise exec -- npm run gen' },
            { run: 'mise -E spidermonkey exec -- custom-generator' },
            { run: 'mise exec -- bash -e -c "$FJS_CI_RUN"', env: { FJS_CI_RUN: 'sh ./nanvm/demos/gen.build.sh' } },
            { run: 'git add -A && git diff --cached --exit-code' },
        ])
        assertEq(source.steps.find(step => step.uses === mise.uses)?.if, undefined)
        assertEq(stepWith(source, nodeVersion.run).if, undefined)
        assertEq(stepWith(source, 'mise exec -- npm run gen').if, undefined)
        assertEq(stepWith(source, 'mise -E spidermonkey exec -- custom-generator').if, undefined)
        assertEq(stepWith(source, 'git add -A && git diff --cached --exit-code').if, undefined)
        assertEq(source.steps.filter(step => step.run?.startsWith('mise exec -- npm start ci report ')).length, 1)
    },
    /** Rust and SpiderMonkey never inherit the JavaScript suite's success. */
    independentChecks: () => {
        const rustToolchain = uses('dtolnay/rust-toolchain', { components: 'rustfmt,clippy' })
        const source = cached([
            mise, rustToolchain, rustVersion, multilib, spidermonkeyLock, spidermonkeyInstall, nodeVersion,
            { run: 'test "$(mise exec -- wasmtime --version)" = "wasmtime 50.0.0"' },
            { run: 'test "$(mise exec -- wasmer --version)" = "wasmer 7.5.0"' },
            { run: 'test "$(mise -E spidermonkey exec -- js --version)" = "JavaScript-C153.6.0"' },
            install, { run: 'cargo test' }, { run: 'cargo clippy -- -D warnings' },
            suite, { run: 'node --test ./fjs/emergent_testing/js-only.mjs' },
            { run: 'mise -E spidermonkey exec -- npm run sm c' }, { run: 'mise -E spidermonkey exec -- npm run sm t' },
        ], 'ubuntu-arm')
        assertEq(stepWith(source, rustVersion.run).if, "steps.init.outputs.hit-rust != 'true'")
        assertEq(stepWith(source, multilib.run).if, "steps.init.outputs.hit-rust != 'true'")
        assertEq(stepWith(source, spidermonkeyLock.run).if, "steps.init.outputs.hit-spidermonkey-compile != 'true' || steps.init.outputs.hit-spidermonkey-suite != 'true'")
        assertEq(stepWith(source, spidermonkeyInstall.run).if, "steps.init.outputs.hit-spidermonkey-compile != 'true' || steps.init.outputs.hit-spidermonkey-suite != 'true'")
        assertEq(source.steps.find(step => step.uses === rustToolchain.uses)?.if, "steps.init.outputs.hit-rust != 'true'")
        assertEq(stepWith(source, 'cargo test').if, "steps.init.outputs.hit-rust != 'true'")
        assertEq(stepWith(source, 'mise -E spidermonkey exec -- npm run sm c').if, "steps.init.outputs.hit-spidermonkey-compile != 'true'")
        assertEq(stepWith(source, 'mise -E spidermonkey exec -- npm run sm t').if, "steps.init.outputs.hit-spidermonkey-suite != 'true'")
        assertEq(stepWith(source, install.run).if, "steps.init.outputs.hit-suite != 'true'")
        assertEq(stepWith(source, 'node --test ./fjs/emergent_testing/js-only.mjs').if, "steps.init.outputs.hit-suite != 'true'")
        assertEq(source.steps.filter(step => step.run === 'mise exec -- npm start ci report suite').length, 1)
    },
    /** Each alternative engine groups its install, pin verification and coverage. */
    engines: () => {
        for (const id of ['deno', 'bun']) {
            const source = cached([mise, uses('actions/checkout'), { run: `${id} install` }, { run: `${id} test` }], id)
            assertEq(stepWith(source, `${id} install`).if, "steps.init.outputs.hit-suite != 'true'")
            assertEq(source.steps.filter(step => step.run === 'mise exec -- npm start ci report suite').length, 1)
        }
    },
    /** An unclassified operation runs and certifies nothing. */
    unknown: () => {
        const source = cached([{ run: 'custom-command' }, {}])
        assertEq(stepWith(source, 'custom-command').if, undefined)
        assertEq(source.steps.filter(step => step.run?.startsWith('mise exec -- npm start ci report ')).length, 0)
        assertStructurallySame(checks('empty', job([])), [])
        assertStructurallySame(smartJobs({}), {})
    },
})
