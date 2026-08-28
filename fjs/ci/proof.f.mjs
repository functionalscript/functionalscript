/**
 * @import { MetaStep, Os, GitHubAction } from './common/types.ts'
 * @import { Dir, State } from '../effects/node/virtual/types.ts'
 * @import { Unknown } from '../djs/types.ts'
 */

import { exitCode } from '../effects/node/module.f.mjs'
import { ci, main } from './module.f.mjs'
import { functionalscript, node } from './config/module.f.mjs'
import { nodeNixJobs } from './node/module.f.mjs'
import { utf8, utf8ToString } from '../text/module.f.mjs'
import { empty as emptyVec } from '../types/bit_vec/module.f.mjs'
import { test, ubuntu, parseGitHubAction } from './common/module.f.mjs'
import { assert, assertEq } from '../asserts/module.f.mjs'
import { emptyState, virtual } from '../effects/node/virtual/module.f.mjs'
import { unwrap } from '../types/result/module.f.mjs'
import { definedValues } from '../types/object/module.f.mjs'
import { parse as jsonParse } from '../media/json/module.f.mjs'

/** @type {(cmd: string) => (gha: GitHubAction) => boolean} */
const hasRun = cmd => gha =>
    definedValues(gha.jobs).some(job => job.steps.some(step => step.run?.includes(cmd)))

/** @type {(jobId: string, cmd: string) => (gha: GitHubAction) => boolean} */
const hasRunInJob = (jobId, cmd) => gha =>
    gha.jobs[jobId]?.steps.some(step => step.run?.includes(cmd)) ?? false

/** @type {(jobId: string, cmd: string) => (gha: GitHubAction) => boolean} */
const hasExactRunInJob = (jobId, cmd) => gha =>
    gha.jobs[jobId]?.steps.some(step => step.run === cmd) ?? false

const makeState = (/** @type {boolean} */ rust, /** @type {string | undefined} */ packageJson) => ({
    ...emptyState,
    root: {
        '.github': { workflows: {} },
        ...(packageJson !== undefined ? { 'package.json': [utf8(packageJson)] } : {}),
        ...(rust ? { 'Cargo.toml': [emptyVec] } : {}),
    },
})

/** @type {(dir: Dir, name: string) => Dir} */
const subDir = (dir, name) => {
    const entity = dir[name]
    // `Array.isArray` narrows to `any[]`, which `readonly Vec[]` is not assignable
    // to, so its negative branch never removes a `readonly` array from a union.
    // `instanceof Array` does, so this `assert` narrows `entity` to `Dir`.
    assert(typeof entity === 'object' && !(entity instanceof Array), entity)
    return entity
}

/** @type {(dir: Dir, name: string) => string} */
const text = (dir, name) => {
    const file = dir[name]
    assert(!(!Array.isArray(file) || file.length === 0), file)
    return utf8ToString(file[0])
}

/** @type {(dir: Dir, names: readonly string[]) => Dir} */
const path = (dir, names) => names.reduce(subDir, dir)

/** @type {(state: State) => GitHubAction} */
const workflow = state => {
    const workflows = path(state.root, ['.github', 'workflows'])
    return unwrap(parseGitHubAction(unwrap(jsonParse(text(workflows, 'ci.yml')))))
}

/** @type {(state: State, id: string) => string} */
const flake = (state, id) =>
    text(path(state.root, ['nix', 'generated', id]), 'flake.nix')

/** @type {(rust: boolean, nodeExtra?: (o: Os) => readonly MetaStep[]) => GitHubAction} */
const run = (rust, nodeExtra = () => []) => {
    const [state, result] = virtual(makeState(rust, undefined))(ci({ nodeExtra }))
    assertEq(exitCode(result), 0)
    return workflow(state)
}

/** @type {(packageJson?: string) => GitHubAction} */
const runDefault = packageJson => {
    const [state, result] = virtual(makeState(false, packageJson))(main())
    assertEq(exitCode(result), 0)
    return workflow(state)
}

export const proof = {
    matrixShape: () => {
        const gha = run(true)
        assertEq(Object.keys(gha.jobs).length, 13, 'expected 13 CI jobs')
        assertEq(gha.permissions.contents, 'read', 'expected read-only contents permission')
        assertEq(Object.keys(gha.permissions).length, 1, 'expected least-privilege workflow permissions')
        assert(hasRunInJob('ubuntu-intel', 'cargo test --target i686-unknown-linux-gnu')(gha), 'expected Ubuntu Intel i686 check')
        assert(hasRunInJob('ubuntu-intel', 'cargo test --target i686-unknown-linux-gnu --release')(gha), 'expected Ubuntu Intel i686 release check')
        assert(hasRunInJob('ubuntu-intel', 'cargo clippy --target i686-unknown-linux-gnu -- -D warnings')(gha), 'expected Ubuntu Intel i686 lint')
        assert(hasRunInJob('ubuntu-intel', 'cargo clippy --target i686-unknown-linux-gnu --release -- -D warnings')(gha), 'expected Ubuntu Intel i686 release lint')
        assert(hasRunInJob('ubuntu-arm', 'cargo test --release')(gha), 'expected native platform Rust release check')
        assert(hasRunInJob('ubuntu-arm', 'cargo clippy -- -D warnings')(gha), 'expected native platform Rust lint')
        assert(hasRunInJob('ubuntu-arm', 'cargo clippy --release -- -D warnings')(gha), 'expected native platform Rust release lint')
        assert(hasRunInJob('wasm', 'cargo test --target wasm32-wasip1 --release')(gha), 'expected target-specific WASM release check')
        assert(hasRunInJob('wasm', 'cargo clippy --target wasm32-wasip1 -- -D warnings')(gha), 'expected target-specific WASM Rust lint')
        assert(hasRunInJob('wasm', 'cargo clippy --target wasm32-wasip1 --release -- -D warnings')(gha), 'expected target-specific WASM release lint')
        // Wasmtime 47 removed wasi-threads: the threads target must run under
        // Wasmer only, while Clippy (no runner) stays.
        assert(hasRunInJob('wasm', 'cargo test --target wasm32-wasip1-threads --config .cargo/config.wasmer.toml')(gha), 'expected Wasmer WASM threads check')
        assert(hasRunInJob('wasm', 'cargo clippy --target wasm32-wasip1-threads -- -D warnings')(gha), 'expected WASM threads lint')
        assert(!hasExactRunInJob('wasm', 'cargo test --target wasm32-wasip1-threads')(gha), 'unexpected Wasmtime WASM threads check')
        assert(!hasExactRunInJob('wasm', 'cargo test --target wasm32-wasip1-threads --release')(gha), 'unexpected Wasmtime WASM threads release check')
        assert(hasRunInJob('node22', 'fjs test')(gha), 'expected Node 22 FunctionalScript smoke test')
        assert(hasRunInJob('node26', 'npm pack')(gha), 'expected Node 26 package check')
        assert(hasRunInJob('node26', 'npm run ci-update')(gha), 'expected Node 26 workflow regeneration')
        assert(hasRunInJob('node26', 'git add -A && git diff --cached --exit-code')(gha), 'expected Node 26 generated-file drift check')
        // Both halves of the `@module` rule, asserted separately: a guard that
        // silently stopped being generated is the failure it exists to prevent.
        assert(hasRunInJob('node26', 'grep -rl @module')(gha), 'expected Node 26 stray `@module` check')
        assert(hasRunInJob('node26', 'xargs grep -L @module')(gha), 'expected Node 26 missing `@module` check')
        assert(!hasRun('npm publish --dry-run')(gha), 'unexpected npm publish dry-run')
        for (const id of /** @type {const} */ ([
            'ubuntu-intel',
            'ubuntu-arm',
            'macos-intel',
            'macos-arm',
            'windows-intel',
            'windows-arm',
            'node22',
            'node24',
            'node26',
        ])) {
            assert(hasRunInJob(id, 'npm ci')(gha), `expected npm ci in ${id}`)
        }
        assert(!hasRunInJob('deno', 'npm ci')(gha), 'unexpected npm ci in deno job')
        assert(!hasRunInJob('bun', 'npm ci')(gha), 'unexpected npm ci in bun job')
    },
    rust: () => {
        assert(hasRun('cargo')(run(true)), 'expected Rust steps')
    },
    noRust: () => {
        assert(!hasRun('cargo')(run(false)), 'unexpected Rust steps')
    },
    extra: {
        allOs: () => {
            const cmd = 'echo hello'
            const gha = run(false, () => [test({ run: cmd })])
            for (const o of /** @type {const} */ (['ubuntu', 'macos', 'windows'])) {
                for (const a of /** @type {const} */ (['intel', 'arm'])) {
                    assert(hasRunInJob(`${o}-${a}`, cmd)(gha), `missing extra step in ${o}-${a}`)
                }
            }
        },
        osSpecific: () => {
            const gha = run(false, o => o === 'ubuntu' ? [test({ run: 'echo ubuntu-only' })] : [])
            for (const a of /** @type {const} */ (['intel', 'arm'])) {
                assert(hasRunInJob(`ubuntu-${a}`, 'echo ubuntu-only')(gha), `missing step in ubuntu-${a}`)
                assert(!hasRunInJob(`macos-${a}`, 'echo ubuntu-only')(gha), `unexpected step in macos-${a}`)
                assert(!hasRunInJob(`windows-${a}`, 'echo ubuntu-only')(gha), `unexpected step in windows-${a}`)
            }
        },
    },
    defaultSetup: {
        functionalscriptPackage: () => {
            const gha = runDefault('{"name":"functionalscript"}')
            assert(hasRun('fjs test')(gha), 'expected fjs self-test')
            assert(hasRun(`deno run -A --minimum-dependency-age=0 npm:functionalscript@${functionalscript} test`)(gha), 'expected deno self-test')
            assert(hasRun(`bunx functionalscript@${functionalscript} test`)(gha), 'expected bun self-test')
        },
        otherPackage: () => {
            const gha = runDefault('{"name":"other-package"}')
            assert(hasRun(`deno run -A --minimum-dependency-age=0 npm:functionalscript@${functionalscript} test`)(gha), 'expected canonical deno self-test')
            assert(hasRun(`bunx functionalscript@${functionalscript} test`)(gha), 'expected canonical bun self-test')
        },
        configuredPackageVersion: () => {
            const gha = runDefault('{"name":"other-package","version":"1.2.3"}')
            assert(hasRun(`npm install -g functionalscript@${functionalscript}`)(gha), 'expected configured-version platform install')
            assert(hasRun(`deno install -g -A --minimum-dependency-age=0 npm:functionalscript@${functionalscript}`)(gha), 'expected configured-version deno install cache')
            assert(hasRun('deno install --frozen')(gha), 'expected deno lock install')
            assert(hasRun(`deno run -A --minimum-dependency-age=0 npm:functionalscript@${functionalscript} test`)(gha), 'expected configured-version deno install')
            assert(hasRun('deno task cov')(gha), 'expected deno coverage task')
            assert(hasRun(`bun install -g functionalscript@${functionalscript}`)(gha), 'expected configured-version bun cache')
            assert(hasRun('bun install --frozen-lockfile')(gha), 'expected bun lock install')
            assert(hasRun(`bunx functionalscript@${functionalscript} test`)(gha), 'expected configured-version bun install')
        },
        missingPackageJson: () => {
            const gha = runDefault()
            assert(hasRun(`npm install -g functionalscript@${functionalscript}`)(gha), 'expected configured-version install')
        },
    },
    nixFlakes: () => {
        const [state, result] = virtual(makeState(false, undefined))(main())
        assertEq(exitCode(result), 0)
        for (const { id, packages } of nodeNixJobs) {
            const [nodePackage] = packages
            assert(
                flake(state, id).includes(`pkgs.${nodePackage}`),
                `expected ${nodePackage} in the ${id} flake`)
        }
    },
    nixFlakeJob: () => {
        const gha = run(false)
        const job = gha.jobs['nix-flakes']
        assert(job !== undefined, 'expected the temporary flake job')
        assert(
            job.steps.some(step => step.uses?.startsWith('cachix/install-nix-action@') === true),
            'expected a pinned Nix installer')
        // Exactly one check per unmigrated flake: none goes unchecked, and no
        // check outlives the flake it was written for. A migrated job checks its
        // own flake by running through it, so it is not covered here.
        assertEq(job.steps.filter(step => step.run !== undefined).length, nodeNixJobs.length)
        for (const { id } of nodeNixJobs) {
            assert(
                hasRunInJob('nix-flakes', `nix develop ./nix/generated/${id} --command node --version`)(gha),
                `expected the ${id} flake to be instantiated`)
        }
        // Since the flakes no longer assert their own version, this job is the
        // only place the Nix runtime is tied to the version `setup-node` installs.
        for (const version of [node.node22, node.node24, node.default]) {
            assert(
                hasRunInJob('nix-flakes', `= v${version}`)(gha),
                `expected the flake job to check Node ${version}`)
        }
        // The canonical Node jobs keep their current runtime setup until they
        // are migrated one at a time.
        for (const { id } of nodeNixJobs) {
            assert(!hasRunInJob(id, 'nix develop')(gha), `unexpected nix develop in ${id}`)
        }
    },
    ubuntu: () => {
        const job = ubuntu([test({ run: 'echo hi' })])
        assert(job['runs-on'] !== undefined, 'expected runs-on')
        assert(job.steps.length > 0, 'expected steps')
    },
    jobNeeds: () => {
        const steps = /** @type {const} */ ([{ run: 'echo hi' }])
        /** @type {(jobs: Unknown) => Unknown} */
        const action = jobs => ({
            name: 'test',
            on: {},
            permissions: { contents: 'read' },
            jobs,
        })
        // Modelled, so a job that waits for another survives the round-trip.
        // Without this a consuming job could only reach the workflow by being
        // emitted past the schema, which `parseGitHubAction` would then reject.
        const ordered = unwrap(parseGitHubAction(action({
            pack: { 'runs-on': 'ubuntu-latest', steps },
            check: { 'runs-on': 'ubuntu-latest', needs: ['pack'], steps },
        })))
        assertEq(ordered.jobs.check?.needs?.[0], 'pack')
        assertEq(ordered.jobs.check?.needs?.length, 1)
        // Optional: the independent jobs, which is all of them today, still parse.
        assertEq(unwrap(parseGitHubAction(action({
            pack: { 'runs-on': 'ubuntu-latest', steps },
        }))).jobs.pack?.needs, undefined)
        // Constrained, not merely accepted. GitHub also allows a bare scalar
        // (`needs: pack`); this generator emits the list form only, so the
        // scalar is drift rather than an alternative spelling — the same reason
        // these schemas are closed.
        assertEq(parseGitHubAction(action({
            check: { 'runs-on': 'ubuntu-latest', needs: 'pack', steps },
        }))[0], 'error')
        // Dormant until something orders itself: the first consumer is the
        // packed-artifact check in `fjs/ci/todo/f-mjs-package-support.md`.
        assert(
            definedValues(run(false).jobs).every(job => job.needs === undefined),
            'unexpected job ordering in the generated workflow')
    },
}
