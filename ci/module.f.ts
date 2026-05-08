/**
 * Continuous integration helper commands for repository automation tasks.
 *
 * @module
 */
import { utf8 } from '../text/module.f.ts'
import { begin, pure, type Effect } from '../types/effects/module.f.ts'
import { writeFile, type NodeOp } from '../types/effects/node/module.f.ts'
import { bun, deno, images, node, playwright, rust, wasmer, wasmtime } from './config/module.f.ts'

const os = ['ubuntu', 'macos', 'windows'] as const

type Os = typeof os[number]

const architecture = ['intel', 'arm'] as const

type Architecture = typeof architecture[number]

type Image = typeof images[Os][Architecture]

type Step = {
    readonly run?: string
    readonly uses?: string
    readonly with?: {
        readonly [k: string]: string
    }
}

type Job = {
    readonly 'runs-on': Image
    readonly steps: readonly Step[]
}

type Jobs = {
    readonly [jobs: string]: Job
}

type GitHubAction = {
    readonly name: string
    readonly on: {
        readonly pull_request?: {}
    }
    readonly jobs: Jobs
}

type StepType = 'install' | 'test'

type MetaStep = {
    readonly type: StepType
    readonly step: Step
} | {
    readonly type: 'rust'
    readonly target?: string
} | {
    readonly type: 'apt-get'
    readonly package: string
}

const install = (step: Step): MetaStep => ({ type: 'install', step })

const test = (step: Step): MetaStep => ({ type: 'test', step })

type Tool = {
    readonly def: Step
    readonly name: string
    readonly path: string
}

const installOnWindowsArm = ({ def, name, path }: Tool) => (v: Os) => (a: Architecture): MetaStep =>
    install(v === 'windows' && a === 'arm'
        ? { run: `irm ${path}/install.ps1 | iex; "$env:USERPROFILE\\.${name}\\bin" | Out-File -FilePath $env:GITHUB_PATH -Encoding utf8 -Append` }
        : def)

const installBun = installOnWindowsArm({
    def: {
        uses: 'oven-sh/setup-bun@v2',
        with: {
            'bun-version': bun
        },
    },
    name: 'bun',
    path: 'bun.sh',
})

const installDeno = install({
    uses: 'denoland/setup-deno@v2',
    with: { 'deno-version': deno },
})

const cargoTest = (target?: string, config?: string): readonly MetaStep[] => {
    const to = target ? ` --target ${target}` : ''
    const co = config ? ` --config ${config}` : ''
    const main = `cargo test${to}${co}`
    return [
        test({ run: main }),
        test({ run: `${main} --release` })
    ]
}

const customTarget = (target: string): readonly MetaStep[] => [
    { type: 'rust', target },
    ...cargoTest(target)
]

const wasmTarget = (target: string): readonly MetaStep[] => [
    ...customTarget(target),
    ...cargoTest(target, '.cargo/config.wasmer.toml')
]

const clean = (steps: readonly MetaStep[]): readonly MetaStep[] => [
    ...steps,
    test({ run: 'git reset --hard HEAD && git clean -fdx' })
]

const installNode = (version: string) =>
    ({ uses: 'actions/setup-node@v6', with: { 'node-version': version } })

const basicNode = (version: string) => (extra: readonly MetaStep[]): readonly MetaStep[] => clean([
    install(installNode(version)),
    test({ run: 'npm ci' }),
    ...extra,
])

const nodeTests = (version: string) => (extra: readonly MetaStep[]): readonly MetaStep[] => basicNode(version)([
    test({ run: 'npm test' }),
    test({ run: 'npm run fst' }),
    ...extra,
])

const findTgz = (v: Os) => v === 'windows' ? '(Get-ChildItem *.tgz).FullName' : './*.tgz'

const playwrightAndVersion = `playwright@${playwright}`

const toSteps = (m: readonly MetaStep[]): readonly Step[] => {
    const filter = (st: StepType) => m.flatMap((mt: MetaStep): Step[] => mt.type === st ? [mt.step] : [])
    const aptGet = m.flatMap(v => v.type === 'apt-get' ? [v.package] : []).join(' ')

    const needRust = m.find(v => v.type === 'rust') !== undefined
    const targets = m.flatMap(v => v.type === 'rust' && v.target !== undefined ? [v.target] : []).join(',')
    return [
        ...(aptGet !== '' ? [{ run: `sudo apt-get update && sudo apt-get install -y ${aptGet}` }] : []),
        ...(needRust ? [{
            uses: `dtolnay/rust-toolchain@${rust}`,
            with: {
                components: 'rustfmt,clippy',
                targets
            }
        }] : []),
        ...filter('install'),
        { uses: 'actions/checkout@v5' },
        ...filter('test'),
    ]
}

const major = (v: string) => v.split('.')[0]

const nodeTest = (v: string) => major(v) === '20' ? 'run test20' : 'test'

const nodeSteps = (v: string) => [
    install(installNode(v)),
    test({ run: 'npm ci' }),
    test({ run: `npm ${nodeTest(v)}`}),
]

const ubuntu = (ms: readonly MetaStep[]): Job => ({
    'runs-on': images.ubuntu.intel,
    steps: toSteps(ms)
})

const nodeVersions: Jobs = Object.fromEntries(node.others.map(v => [
    `node${major(v)}`,
    ubuntu(nodeSteps(v))
]))

const playwrightJob: Job = ubuntu(basicNode(node.default)([
    // install({ uses: 'actions/cache@v4', with: { path: '~/.cache/ms-playwright', key: `${images.ubuntu.intel}-${playwrightAndVersion}` } }),
    install({ run: `npm install -g ${playwrightAndVersion}` }),
    //install({ run: 'playwright install --with-deps' }),
    //install({ run: 'playwright install' }),
    //install({ run: 'playwright install chromium' }),
    install({ run: 'rm -rf ~/.cache/ms-playwright' }),
    install({ run: 'playwright install firefox' }),
    install({ run: 'playwright install webkit' }),
    // we have to use `npx` to make sure that we respect `@playwright/test` version from
    // the `package.json`.
    ...['chromium', 'firefox', 'webkit'].map(browser =>
        test({ run: `npx playwright test --browser=${browser}` })),
]))

const i686 = (a: Architecture, v: Os) => {
    if (a === 'intel') {
        switch (v) {
            case 'windows': return customTarget('i686-pc-windows-msvc')
            case 'ubuntu': return [
                { type: 'apt-get', package: 'libc6-dev-i386' } as const,
                ...customTarget('i686-unknown-linux-gnu'),
            ]
        }
    }
    return []
}

const job = (v: Os) => (a: Architecture): readonly [string, Job] => {
    const id = `${v}-${a}`
    const image = images[v][a]
    const result: readonly MetaStep[] = [
        // Rust
        test({ run: 'cargo fmt -- --check' }),
        test({ run: 'cargo clippy -- -D warnings' }),
        ...cargoTest(),
        install({
            uses: 'bytecodealliance/actions/wasmtime/setup@v1',
            with: { version: wasmtime }
        }),
        install({
            uses: 'wasmerio/setup-wasmer@v3.1',
            with: { version: `v${wasmer}` },
        }),
        ...wasmTarget('wasm32-wasip1'),
        ...wasmTarget('wasm32-wasip2'),
        ...wasmTarget('wasm32-unknown-unknown'),
        ...wasmTarget('wasm32-wasip1-threads'),
        ...i686(a, v),
        // Node.js
        ...nodeTests(node.default)([
            // TypeScript Preview
            install({ run: 'npm install -g @typescript/native-preview'}),
            test({ run: 'tsgo' }),
            // publishing
            test({ run: 'npm pack' }),
            test({ run: `npm install -g ${findTgz(v)}` }),
            test({ run: 'fjs compile issues/demo/data/tree.json _tree.f.js' }),
            test({ run: 'fjs t' }),
            test({ run: 'npm uninstall functionalscript -g' }),
        ]),
        // Deno
        ...clean([
            installDeno,
            test({ run: 'deno install' }),
            test({ run: 'deno task test' }),
            test({ run: 'deno task fjs compile issues/demo/data/tree.json _tree.f.js' }),
            test({ run: 'deno task fjs t' }),
            test({ run: 'deno publish --dry-run' }),
        ]),
        // Bun
        ...clean([
            installBun(v)(a),
            test({ run: 'bun test --timeout 20000' }),
            test({ run: 'bun ./fjs/module.ts t' }),
        ]),
    ]
    return [id, { 'runs-on': image, steps: toSteps(result) }]
}

const jobs = {
    ...Object.fromEntries(os.flatMap(v => architecture.map(job(v)))),
    ...nodeVersions,
    playwright: playwrightJob,
}

const gha: GitHubAction = {
    name: 'CI',
    on: { pull_request: {} },
    jobs,
}

export const effect: Effect<NodeOp, number> = begin
    .step(() => writeFile('.github/workflows/ci.yml', utf8(JSON.stringify(gha, null, '  '))))
    .step(() => pure(0))

export default () => effect
