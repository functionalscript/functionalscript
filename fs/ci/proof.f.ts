import { ci, main } from './module.f.ts'
import { utf8, utf8ToString } from '../text/module.f.ts'
import { empty as emptyVec, isVec } from '../types/bit_vec/module.f.ts'
import { type MetaStep, type Os, test, type GitHubAction, parseGitHubAction } from './common/module.f.ts'
import { assert } from '../asserts/module.f.ts'
import type { State } from '../effects/node/virtual/module.f.ts'
import { emptyState, virtual } from '../effects/node/virtual/module.f.ts'
import { parse as jsonParse } from '../json/module.f.ts'
import { unwrap } from '../types/result/module.f.ts'

const hasRun = (cmd: string) => (gha: GitHubAction): boolean =>
    Object.values(gha.jobs).some(job => job.steps.some(step => step.run?.includes(cmd)))

const hasRunInJob = (jobId: string, cmd: string) => (gha: GitHubAction): boolean =>
    gha.jobs[jobId]?.steps.some(step => step.run?.includes(cmd)) ?? false

const makeState = (rust: boolean, packageJson?: string) => ({
    ...emptyState,
    root: {
        '.github': { workflows: {} },
        ...(packageJson !== undefined ? { 'package.json': utf8(packageJson) } : {}),
        ...(rust ? { 'Cargo.toml': emptyVec } : {}),
    },
})

const workflow = (state: State): GitHubAction => {
    const dotGithub = state.root['.github']
    assert(typeof dotGithub === 'object', dotGithub)
    const workflows = dotGithub['workflows']
    assert(typeof workflows === 'object', workflows)
    const file = workflows['ci.yml']
    assert(isVec(file), file)
    return unwrap(parseGitHubAction(jsonParse(utf8ToString(file))))
}

const run = (rust: boolean, nodeExtra: (o: Os) => readonly MetaStep[] = () => []): GitHubAction => {
    const [state, result] = virtual(makeState(rust))(ci({ version: '0.0.0', nodeExtra }))
    assert(result === 0, result)
    return workflow(state)
}

const runDefault = (packageJson?: string): GitHubAction => {
    const [state, result] = virtual(makeState(false, packageJson))(main())
    assert(result === 0, result)
    return workflow(state)
}

export const proof = {
    matrixShape: () => {
        const gha = run(true)
        assert(Object.keys(gha.jobs).length === 13, 'expected 13 CI jobs')
        assert(hasRunInJob('ubuntu-intel', 'cargo test --target i686-unknown-linux-gnu')(gha), 'expected Ubuntu Intel i686 check')
        assert(hasRunInJob('ubuntu-arm', 'cargo clippy -- -D warnings')(gha), 'expected native platform Rust lint')
        assert(hasRunInJob('wasm', 'cargo clippy --target wasm32-wasip1 -- -D warnings')(gha), 'expected target-specific WASM Rust lint')
        assert(hasRunInJob('node22', 'fjs t')(gha), 'expected Node 22 FunctionalScript smoke test')
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
            for (const o of ['ubuntu', 'macos', 'windows'] as const) {
                for (const a of ['intel', 'arm'] as const) {
                    assert(hasRunInJob(`${o}-${a}`, cmd)(gha), `missing extra step in ${o}-${a}`)
                }
            }
        },
        osSpecific: () => {
            const gha = run(false, o => o === 'ubuntu' ? [test({ run: 'echo ubuntu-only' })] : [])
            for (const a of ['intel', 'arm'] as const) {
                assert(hasRunInJob(`ubuntu-${a}`, 'echo ubuntu-only')(gha), `missing step in ubuntu-${a}`)
                assert(!hasRunInJob(`macos-${a}`, 'echo ubuntu-only')(gha), `unexpected step in macos-${a}`)
                assert(!hasRunInJob(`windows-${a}`, 'echo ubuntu-only')(gha), `unexpected step in windows-${a}`)
            }
        },
    },
    defaultSetup: {
        functionalscriptDemo: () => {
            const gha = runDefault('{"name":"functionalscript"}')
            assert(hasRun('fjs compile issues/demo/data/tree.json _tree.f.js')(gha), 'expected fjs demo compile')
            assert(hasRun('fjs t')(gha), 'expected fjs self-test')
            assert(hasRun('deno run -A npm:functionalscript@latest t')(gha), 'expected deno self-test')
            assert(hasRun('bunx functionalscript@latest t')(gha), 'expected bun self-test')
        },
        otherPackageNoDemo: () => {
            const gha = runDefault('{"name":"other-package"}')
            assert(!hasRun('fjs compile issues/demo/data/tree.json _tree.f.js')(gha), 'unexpected fjs demo compile')
            assert(hasRun('deno run -A npm:functionalscript@latest t')(gha), 'expected canonical deno self-test')
            assert(hasRun('bunx functionalscript@latest t')(gha), 'expected canonical bun self-test')
        },
        packageVersion: () => {
            const gha = runDefault('{"name":"other-package","version":"1.2.3"}')
            assert(hasRun('npm install -g functionalscript@1.2.3')(gha), 'expected package-version platform install')
            assert(hasRun('deno run -A npm:functionalscript@1.2.3 t')(gha), 'expected package-version deno install')
            assert(hasRun('bunx functionalscript@1.2.3 t')(gha), 'expected package-version bun install')
        },
        malformedPackageJsonFallback: () => {
            const gha = runDefault('{')
            assert(!hasRun('fjs compile issues/demo/data/tree.json _tree.f.js')(gha), 'unexpected fjs demo compile')
            assert(hasRun('npm install -g functionalscript@latest')(gha), 'expected fallback install')
        },
        missingPackageJsonFallback: () => {
            const gha = runDefault()
            assert(!hasRun('fjs compile issues/demo/data/tree.json _tree.f.js')(gha), 'unexpected fjs demo compile')
            assert(hasRun('npm install -g functionalscript@latest')(gha), 'expected fallback install')
        },
        missingNameFallback: () => {
            const gha = runDefault('{"version":"1.0.0"}')
            assert(!hasRun('fjs compile issues/demo/data/tree.json _tree.f.js')(gha), 'unexpected fjs demo compile')
            assert(hasRun('npm install -g functionalscript@1.0.0')(gha), 'expected package-version fallback install')
        },
        nonObjectFallback: () => {
            const gha = runDefault('[]')
            assert(!hasRun('fjs compile issues/demo/data/tree.json _tree.f.js')(gha), 'unexpected fjs demo compile')
            assert(hasRun('npm install -g functionalscript@latest')(gha), 'expected fallback install')
        },
    },
}
