/** @import { Job, Jobs } from '../common/types.ts' */
import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { definedEntries } from '../../types/object/module.f.mjs'
import { jobTimeout } from '../config/module.f.js'
import { miseDevelop, miseInstall, miseJobs, miseSteps, miseVersionStep, spiderMonkeyDevelop, spiderMonkeyInstall } from './module.f.mjs'

/** @type {Job} */
const source = {
    'runs-on': 'ubuntu-26.04',
    'timeout-minutes': jobTimeout,
    steps: [
        { uses: 'dtolnay/rust-toolchain@1.99.1' },
        { uses: 'actions/setup-node@v1', with: { 'node-version': '26.13.0' } },
        { uses: 'actions/cache@v1' },
        { uses: 'actions/checkout@v1' },
        { run: 'env cargo test' },
        { run: 'test "$(env wasmtime --version)" = "wasmtime 50.0.0"' },
        { run: 'test "$(env js --version)" = "JavaScript-C140.17.0"' },
        { run: 'env npm run sm t' },
        { run: 'test "$(node --version)" = "v26.13.0"' },
        ...['cargo test', 'npm ci', 'node --test', 'npm start test', 'tsc', 'git diff', 'mkdir consumer'].map(run => ({ run })),
        { run: 'echo extra && node extra.mjs', env: { EXTRA: 'kept' } },
        { uses: 'actions/setup-node@v1', with: { 'package-manager-cache': 'false' } },
        { run: 'node consumer.mjs', 'working-directory': '../consumer' },
    ],
}

export const proof = {
    callerTextIsPreserved: () => {
        for (const script of ['printenv FOO', 'echo "env ready"', 'echo "$(env node --version)"']) {
            const migrated = miseJobs({ 'windows-arm': { ...source, steps: [
                { uses: 'actions/checkout@v1' }, { run: script },
            ] } }, false)
            const step = migrated['windows-arm']?.steps.find(step => step.env?.FJS_CI_RUN === script)
            assertEq(step?.run, miseDevelop('bash -e -c "$FJS_CI_RUN"'))
        }
    },
    wrapper: () => {
        assertEq(miseDevelop('node --version'), 'mise exec -- node --version')
        assertEq(spiderMonkeyDevelop('js --version'), 'mise -E spidermonkey exec -- js --version')
        assertEq(miseInstall.type, 'test')
        assertEq(spiderMonkeyInstall.type, 'test')
        assertStructurallySame(miseSteps(['npm ci']), [{ type: 'test', step: { run: 'mise exec -- npm ci', shell: 'bash' } }])
        assertStructurallySame(miseVersionStep('node --version', 'v26.13.0'), { type: 'test', step: { run: 'test "$(mise exec -- node --version)" = "v26.13.0"', shell: 'bash' } })
    },
    migration: () => {
        /** @type {Jobs} */
        const jobs = { 'ubuntu-intel': source, 'ubuntu-arm': source, 'windows-arm': source, node26: source }
        const migrated = miseJobs(jobs, true)
        for (const [id, job] of definedEntries(migrated)) {
            const steps = job.steps
            assertEq(steps.filter(s => s.uses?.startsWith('jdx/mise-action@')).length, 1)
            assert(!steps.some(s => s.uses?.startsWith('cachix/') || s.uses?.startsWith('dtolnay/')))
            assertEq(steps[0]?.uses, 'actions/cache@v1')
            assertEq(steps[1]?.uses, 'actions/checkout@v1')
            assert(steps.some(s => s.run === 'mise exec -- cargo test'))
            assert(steps.some(s => s.run === 'mise -E spidermonkey exec -- npm run sm t'))
            assert(steps.some(s => s.run?.includes("wasmtime --version | cut -d' ' -f1,2")))
            assert(steps.some(s => s.run === 'test "$(mise exec -- node --version)" = "v26.13.0"'))
            assert(steps.some(s => s.run === 'git diff'))
            assert(steps.some(s => s.run === 'mkdir consumer'))
            assert(steps.some(s => s.env?.FJS_CI_RUN === 'echo extra && node extra.mjs' && s.env.EXTRA === 'kept'))
            assert(steps.some(s => s.run === 'node consumer.mjs' && s['working-directory'] === '../consumer'))
            assertEq(steps.filter(s => s.uses?.startsWith('actions/setup-node@')).length, 1)
            assertEq(steps.some(s => s.run?.includes('gcc-multilib')), id === 'ubuntu-intel')
            assertEq(steps.some(s => s.run?.includes('rustc --version')), id.includes('-'))
            assertEq(steps.some(s => s.run === 'mise -E spidermonkey install --locked http:spidermonkey'), id === 'ubuntu-arm')
        }
        const noRust = miseJobs({ 'ubuntu-intel': source }, false)
        assert(!noRust['ubuntu-intel']?.steps.some(s => s.run?.includes('gcc-multilib')))
    },
}
