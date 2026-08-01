import { ci, main } from './module.f.ts'
import { functionalscript, node } from './config/module.f.ts'
import { nodeNixJobs } from './node/module.f.ts'
import { utf8, utf8ToString } from '../text/module.f.ts'
import { empty as emptyVec, isVec } from '../types/bit_vec/module.f.ts'
import { type MetaStep, type Os, test, ubuntu, type GitHubAction, parseGitHubAction } from './common/module.f.ts'
import { assert, assertEq } from '../asserts/module.f.ts'
import type { State } from '../effects/node/virtual/module.f.ts'
import { emptyState, virtual, type Dir } from '../effects/node/virtual/module.f.ts'
import { parse as jsonParse } from '../media/json/module.f.ts'
import { unwrap } from '../types/result/module.f.ts'
import { definedValues } from '../types/object/module.f.ts'

const hasRun = (cmd: string) => (gha: GitHubAction): boolean =>
    definedValues(gha.jobs).some(job => job.steps.some(step => step.run?.includes(cmd)))

const hasRunInJob = (jobId: string, cmd: string) => (gha: GitHubAction): boolean =>
    gha.jobs[jobId]?.steps.some(step => step.run?.includes(cmd)) ?? false

const hasExactRunInJob = (jobId: string, cmd: string) => (gha: GitHubAction): boolean =>
    gha.jobs[jobId]?.steps.some(step => step.run === cmd) ?? false

const makeState = (rust: boolean, packageJson?: string) => ({
    ...emptyState,
    root: {
        '.github': { workflows: {} },
        ...(packageJson !== undefined ? { 'package.json': [utf8(packageJson)] } : {}),
        ...(rust ? { 'Cargo.toml': [emptyVec] } : {}),
    },
})

const subDir = (dir: Dir, name: string): Dir => {
    const entity = dir[name]
    assert(typeof entity === 'object' && !Array.isArray(entity), entity)
    return entity as Dir
}

const text = (dir: Dir, name: string): string => {
    const file = dir[name]
    assert(!(!Array.isArray(file) || file.length === 0), file)
    return utf8ToString(file[0])
}

const path = (dir: Dir, names: readonly string[]): Dir => names.reduce(subDir, dir)

const workflow = (state: State): GitHubAction => {
    const workflows = path(state.root, ['.github', 'workflows'])
    return unwrap(parseGitHubAction(jsonParse(text(workflows, 'ci.yml'))))
}

const flake = (state: State, id: string): string =>
    text(path(state.root, ['nix', 'generated', id]), 'flake.nix')

const run = (rust: boolean, nodeExtra: (o: Os) => readonly MetaStep[] = () => []): GitHubAction => {
    const [state, result] = virtual(makeState(rust))(ci({ nodeExtra }))
    assertEq(result, 0)
    return workflow(state)
}

const runDefault = (packageJson?: string): GitHubAction => {
    const [state, result] = virtual(makeState(false, packageJson))(main())
    assertEq(result, 0)
    return workflow(state)
}

export const proof = {
    matrixShape: () => {
        const gha = run(true)
        assertEq(Object.keys(gha.jobs).length, 14, 'expected 14 CI jobs')
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
        assert(hasRunInJob('node22', 'fjs t')(gha), 'expected Node 22 FunctionalScript smoke test')
        assert(hasRunInJob('node26', 'npm pack')(gha), 'expected Node 26 package check')
        assert(hasRunInJob('node26', 'npm run ci-update')(gha), 'expected Node 26 workflow regeneration')
        assert(hasRunInJob('node26', 'git add -A && git diff --cached --exit-code')(gha), 'expected Node 26 generated-file drift check')
        assert(!hasRun('npm publish --dry-run')(gha), 'unexpected npm publish dry-run')
        for (const id of [
            'ubuntu-intel',
            'ubuntu-arm',
            'macos-intel',
            'macos-arm',
            'windows-intel',
            'windows-arm',
            'node22',
            'node24',
            'node26',
            'playwright',
        ] as const) {
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
        functionalscriptPackage: () => {
            const gha = runDefault('{"name":"functionalscript"}')
            assert(hasRun('fjs t')(gha), 'expected fjs self-test')
            assert(hasRun(`deno run -A --minimum-dependency-age=0 npm:functionalscript@${functionalscript} t`)(gha), 'expected deno self-test')
            assert(hasRun(`bunx functionalscript@${functionalscript} t`)(gha), 'expected bun self-test')
        },
        otherPackage: () => {
            const gha = runDefault('{"name":"other-package"}')
            assert(hasRun(`deno run -A --minimum-dependency-age=0 npm:functionalscript@${functionalscript} t`)(gha), 'expected canonical deno self-test')
            assert(hasRun(`bunx functionalscript@${functionalscript} t`)(gha), 'expected canonical bun self-test')
        },
        configuredPackageVersion: () => {
            const gha = runDefault('{"name":"other-package","version":"1.2.3"}')
            assert(hasRun(`npm install -g functionalscript@${functionalscript}`)(gha), 'expected configured-version platform install')
            assert(hasRun(`deno install -g -A --minimum-dependency-age=0 npm:functionalscript@${functionalscript}`)(gha), 'expected configured-version deno install cache')
            assert(hasRun('deno install --frozen')(gha), 'expected deno lock install')
            assert(hasRun(`deno run -A --minimum-dependency-age=0 npm:functionalscript@${functionalscript} t`)(gha), 'expected configured-version deno install')
            assert(hasRun("deno test --allow-read --allow-env --allow-sys --coverage && deno coverage --include='.*module\\.f\\.ts'")(gha), 'expected limited-permission deno coverage')
            assert(hasRun(`bun install -g functionalscript@${functionalscript}`)(gha), 'expected configured-version bun cache')
            assert(hasRun('bun install --frozen-lockfile')(gha), 'expected bun lock install')
            assert(hasRun(`bunx functionalscript@${functionalscript} t`)(gha), 'expected configured-version bun install')
        },
        missingPackageJson: () => {
            const gha = runDefault()
            assert(hasRun(`npm install -g functionalscript@${functionalscript}`)(gha), 'expected configured-version install')
        },
    },
    nixFlakes: () => {
        const [state, result] = virtual(makeState(false))(main())
        assertEq(result, 0)
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
        // Exactly one check per generated flake: no flake goes unchecked, and no
        // check outlives the flake it was written for.
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
}
