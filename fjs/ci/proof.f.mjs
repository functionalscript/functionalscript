/** @import { Dir, State } from '../effects/node/virtual/types.ts'
 * @import { GitHubAction, MetaStep, Os, Architecture } from './common/types.ts'
 */
import { ci, main } from './module.f.mjs'
import { main as ownMain, packageConsumer } from './self/module.f.mjs'
import { assert, assertEq, assertStructurallySame } from '../asserts/module.f.js'
import { exitCode, ioError, nodeCommands } from '../effects/node/module.f.mjs'
import { emptyState, virtualAt, virtualOperationMap } from '../effects/node/virtual/module.f.mjs'
import { partialRun } from '../effects/mock/module.f.mjs'
import { utf8ToString } from '../text/utf8/module.f.mjs'
import { error, unwrap } from '../types/result/module.f.js'
import { parse as jsonParse } from '../media/json/module.f.mjs'
import { install, test, parseGitHubAction, uses } from './common/module.f.mjs'
import { images, jobTimeout, node, typescript } from './config/module.f.js'
import { rustPlatformCommands, wasmTargets } from './rust/module.f.mjs'
import { empty } from '../types/bit_vec/module.f.js'
import { definedEntries } from '../types/object/module.f.js'
import { coverageSyncFlag, packageJobId } from './node/module.f.mjs'
/** @type {(root: Dir, names: readonly string[]) => Dir} */
const directory = (root, names) => names.reduce((dir, name) => {
    const value = dir[name]
    assert(typeof value === 'object' && !(value instanceof Array))
    return value
}, root)
/** @type {(state: State, name: string) => GitHubAction} */
const workflow = (state, name) => {
    const value = directory(state.root, ['.github', 'workflows'])[name]
    assert(Array.isArray(value) && value[0] !== undefined)
    return unwrap(parseGitHubAction(unwrap(jsonParse(utf8ToString(value[0])))))
}
/** @type {(rust: boolean, extra?: (o: Os, a: Architecture) => readonly MetaStep[], smart?: boolean) => GitHubAction} */
const generate = (rust, extra = () => [], smart = false) => {
    const [state, result] = virtualAt(rust ? { 'Cargo.toml': [empty] } : {})(ci({ nodeExtra: extra, smart }))
    assertEq(exitCode(result), 0)
    assertEq(Object.keys(state.root).filter(name => name.startsWith('gen.')).length, 0)
    return workflow(state, 'gen.ci.yml')
}
/** @type {(gha: GitHubAction, id: string, fragment: string) => boolean} */
const has = (gha, id, fragment) => gha.jobs[id]?.steps.some(step => (step.env?.FJS_CI_RUN ?? step.run)?.includes(fragment)) === true
export const proof = {
    matrix: () => {
        const gha = generate(true)
        assertEq(Object.keys(gha.jobs).length, 12)
        assertEq(gha.permissions.contents, 'read')
        assertEq(gha.concurrency?.['cancel-in-progress'], true)
        for (const o of /** @type {const} */ (['ubuntu', 'macos', 'windows'])) {
            for (const a of /** @type {const} */ (['intel', 'arm'])) {
                const id = `${o}-${a}`
                const job = gha.jobs[id]
                assert(job !== undefined)
                assertEq(job['runs-on'], images[o][a])
                assertEq(job['timeout-minutes'], jobTimeout)
                assert(job.steps.some(step => step.uses?.startsWith('jdx/mise-action@')))
                assert(!job.steps.some(step => step.uses?.startsWith('cachix/')))
                for (const command of rustPlatformCommands) { assert(has(gha, id, command), `${id}: ${command}`) }
                assertEq(has(gha, id, 'node --test ./fjs/emergent_testing/js-only.mjs'), a === 'arm')
            }
        }
        assert(has(gha, 'ubuntu-intel', '--target i686-unknown-linux-gnu'))
        assert(has(gha, 'windows-intel', '--target i686-pc-windows-msvc'))
        for (const target of wasmTargets) { assert(has(gha, 'ubuntu-arm', `--target ${target}`), target) }
        assert(has(gha, 'ubuntu-arm', 'cargo fmt -- --check'))
        assertEq(gha.jobs.spidermonkey?.['runs-on'], images.ubuntu.arm)
        for (const id of Object.keys(gha.jobs).filter(id => id !== 'spidermonkey')) {
            assert(!has(gha, id, 'spidermonkey'), id)
            assert(!has(gha, id, 'npm run sm '), id)
        }
        assert(!has(gha, 'spidermonkey', 'cargo '))
        assert(has(gha, 'spidermonkey', 'npm run sm c'))
        assert(has(gha, 'spidermonkey', 'npm run sm t'))
        for (const command of ['tsc', 'npm start deps', 'npm start compile', 'npm start t', 'npm pack', 'npm run gen', 'git diff --cached --exit-code']) { assert(has(gha, 'node', command), command) }
        assert(has(gha, 'deno', 'deno test -A ./fjs/emergent_testing/fjs-only.mjs'))
        assert(has(gha, 'bun', 'bun test --timeout 30000 ./fjs/emergent_testing/fjs-only.mjs'))
    },
    noRust: () => {
        const gha = generate(false)
        for (const id of Object.keys(gha.jobs)) { assert(!has(gha, id, 'cargo '), id) }
        assert(has(gha, 'spidermonkey', 'npm run sm t'))
    },
    injected: () => {
        for (const command of ['printenv FOO', 'echo "env ready"', 'env FOO=value node extra.mjs', 'echo "$(env node --version)"', 'echo "${{ matrix.name }}"', 'false; echo done', 'cd dir && node extra.mjs', 'NODE_OPTIONS=x node extra.mjs']) {
            for (const kind of [test, install]) {
                const gha = generate(false, (o, a) => [kind({ run: `${command} # ${o}-${a}`, env: { EXTRA: 'kept' } }), test(uses('actions/cache')), { type: 'rust' }])
                for (const o of /** @type {const} */ (['ubuntu', 'macos', 'windows'])) {
                    for (const a of /** @type {const} */ (['intel', 'arm'])) {
                        const id = `${o}-${a}`
                        const steps = gha.jobs[id]?.steps
                        assert(steps !== undefined)
                        const index = steps.findIndex(step => step.env?.FJS_CI_RUN === `${command} # ${id}`)
                        const checkout = steps.findIndex(step => step.uses?.startsWith('actions/checkout@'))
                        assert(index > checkout && checkout >= 0, id)
                        assertEq(steps[index]?.env?.EXTRA, 'kept')
                        assert(steps[index]?.run?.includes('bash -e -c "$FJS_CI_RUN"') === true)
                        assert(steps.some(step => step.uses?.startsWith('actions/cache@')))
                    }
                }
            }
        }
    },
    packageAndPublish: () => {
        const [state, result] = virtualAt({})(ownMain())
        assertEq(exitCode(result), 0)
        const gha = workflow(state, 'gen.ci.yml')
        const steps = gha.jobs[packageJobId]?.steps
        assert(steps !== undefined)
        assert(steps.some(step => step['working-directory'] !== undefined && step.run?.includes(packageConsumer.module)))
        for (const step of steps.filter(step => step['working-directory'] !== undefined)) {
            assert(!step.run?.startsWith('mise ') && !step.run?.startsWith('pixi '))
        }
        assert(steps.some(step => step.uses?.startsWith('actions/setup-node@') && step.with?.['package-manager-cache'] === 'false'))
        const pub = workflow(state, 'gen.npm-publish.yml')
        assert(Object.keys(pub.jobs).length > 0)
        assert(JSON.stringify(pub).includes(node))
        assert(JSON.stringify(pub).includes(typescript.version))
    },
    defaultsAndSmart: () => {
        const [state, result] = virtualAt({})(main())
        assertEq(exitCode(result), 0)
        assertEq(Object.keys(workflow(state, 'gen.ci.yml').jobs).length, 12)
        assert(has(generate(true, () => [], true), 'node', 'ci init'))
        const [, queued] = virtualAt({})(ci({ nodeExtra: () => [], mergeQueueOnly: ['macos'] }))
        assertEq(exitCode(queued), 0)
    },
    artifactConsumer: () => {
        for (const smart of [false, true]) {
            const gha = generate(true, () => [], smart)
            const producer = gha.jobs.node
            const consumer = gha.jobs[packageJobId]
            assert(producer !== undefined && consumer !== undefined)
            assertStructurallySame(consumer.needs, ['node'])
            assertEq(consumer['runs-on'], images.ubuntu.arm)
            assertEq(consumer['timeout-minutes'], jobTimeout)
            assertEq(consumer.if, undefined)
            assertEq(consumer.permissions, undefined)
            assert(consumer.steps.every(step => step.if === undefined && step['continue-on-error'] === undefined))
            assert(!consumer.steps.some(step => step.uses?.startsWith('actions/checkout@') || step.uses?.startsWith('jdx/mise-action@')))
            assert(!has(gha, packageJobId, 'ci init'))
            assert(!has(gha, packageJobId, 'npm pack'))
            assert(!has(gha, 'node', ' good.mts'))
            assert(!producer.steps.some(step => step['working-directory'] !== undefined || step.uses?.startsWith('actions/setup-node@')))
            assert(!has(gha, 'node', 'ci report package'))

            const pack = producer.steps.findIndex(step => step.run?.startsWith('mise exec -- npm pack '))
            const drift = producer.steps.findIndex(step => step.run === 'git add -A && git diff --cached --exit-code')
            const upload = producer.steps.findIndex(step => step.uses?.startsWith('actions/upload-artifact@'))
            assert(pack >= 0 && pack < drift && drift < upload)
            const productionSteps = producer.steps.filter(step => step.run === 'mise exec -- npm ci' || step.run?.includes('tsc --version') || step.run?.startsWith('mkdir ') || step.run?.startsWith('mise exec -- npm pack ') || step.uses?.startsWith('actions/upload-artifact@'))
            assertEq(productionSteps.length, 5)
            for (const step of productionSteps) {
                assertEq(step.if, undefined)
                assertEq(step['continue-on-error'], undefined)
            }
            const artifact = producer.steps[upload]
            assert(artifact !== undefined)
            assertEq(artifact.with?.name, 'package-tarball')
            assertEq(artifact.with?.path, '${{ runner.temp }}/consumer/*.tgz')
            assertEq(artifact.with?.['if-no-files-found'], 'error')
            const setup = consumer.steps[0]
            const download = consumer.steps[1]
            assert(setup?.uses?.startsWith('actions/setup-node@') === true)
            assertEq(setup.with?.['node-version'], node)
            assertEq(setup.with?.['package-manager-cache'], 'false')
            assert(download?.uses?.startsWith('actions/download-artifact@') === true)
            assertEq(download.with?.name, artifact.with?.name)
            assertEq(download.with?.path, '${{ runner.temp }}/consumer')
            assert(has(gha, packageJobId, `typescript@${typescript.version}`))
            assert(has(gha, packageJobId, 'npx tsc'))
            for (const step of consumer.steps.filter(step => step.run !== undefined)) {
                assertEq(step['working-directory'], download.with?.path)
                assert(!step.run?.startsWith('mise '))
            }
        }
    },
    uncachedCoverage: () => {
        for (const smart of [false, true]) {
            const gha = generate(true, () => [], smart)
            const cov = gha.jobs.cov
            assert(cov !== undefined)
            assertEq(cov['runs-on'], images.ubuntu.arm)
            assertEq(cov['timeout-minutes'], jobTimeout)
            assertEq(cov.if, undefined)
            assertEq(cov.needs, undefined)
            assertStructurallySame(cov.permissions, smart ? { contents: 'write' } : undefined)
            assert(cov.steps[0]?.uses?.startsWith('actions/checkout@') === true)
            assert(cov.steps[1]?.uses?.startsWith('jdx/mise-action@') === true)
            assertEq(cov.steps[1]?.with?.install_args, '--locked')
            assertStructurallySame(cov.steps.slice(2).map(step => step.run), [
                `test "$(mise exec -- node --version)" = "v${node}"`,
                'mise exec -- npm ci',
                smart ? `mise exec -- npm start -- cov node ${coverageSyncFlag}` : 'mise exec -- npm start cov node',
            ])
            assert(cov.steps.every(step => step.if === undefined && step['continue-on-error'] === undefined))
            const coverageJobs = definedEntries(gha.jobs).flatMap(([id, job]) =>
                job.steps.flatMap(step => step.run?.startsWith(smart ? 'mise exec -- npm start -- cov node' : 'mise exec -- npm start cov node') ? [id] : []))
            assertStructurallySame(coverageJobs, ['cov'])
            assert(has(gha, 'node', 'npm start t'))
            assert(!has(gha, 'node', 'npm run cov'))
            assertEq(has(gha, 'node', 'ci report suite'), smart)
            assert(!has(gha, 'node', 'ci report coverage'))
        }
        assertStructurallySame(generate(false).jobs.cov, generate(true).jobs.cov)
    },
    // A `Cargo.toml` the host will not describe may well be there: the
    // command fails rather than writing a workflow without the Rust jobs.
    unreadableCargoToml: () => {
        const denied = partialRun(nodeCommands)({
            ...virtualOperationMap,
            access: () => state => [state, error(ioError({ code: 'EACCES', message: 'permission denied' }))],
        })
        const [state, result] = denied(emptyState)(main())
        assertEq(exitCode(result), 1)
        assertEq(state.stderr, 'permission denied\n')
        assertEq(Object.keys(state.root).length, 0)
    },
}
