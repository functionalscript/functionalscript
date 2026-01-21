import type { Io } from '../io/module.f.ts'
import { encodeUtf8 } from '../types/uint8array/module.f.ts'

const os = ['ubuntu', 'macos', 'windows'] as const

type Os = typeof os[number]

const architecture = ['intel', 'arm'] as const

type Architecture = typeof architecture[number]

// https://docs.github.com/en/actions/reference/runners/github-hosted-runners#standard-github-hosted-runners-for-public-repositories
const images = {
    ubuntu: {
        intel: 'ubuntu-latest',
        arm: 'ubuntu-24.04-arm'
    },
    macos: {
        intel: 'macos-15-intel',
        arm: 'macos-latest'
    },
    windows: {
        intel: 'windows-latest',
        arm: 'windows-11-arm',
    }
} as const

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
    def: { uses: 'oven-sh/setup-bun@v1' },
    name: 'bun',
    path: 'bun.sh'
})

const installDeno = installOnWindowsArm({
    def: { uses: 'denoland/setup-deno@v2', with: { 'deno-version': '2' } },
    name: 'deno',
    path: 'deno.land'
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

const node = (version: string) => (extra: readonly MetaStep[]): readonly MetaStep[] => basicNode(version)([
    test({ run: 'npm test' }),
    test({ run: 'npm run fst' }),
    ...extra,
])

const findTgz = (v: Os) => v === 'windows' ? '(Get-ChildItem *.tgz).FullName' : './*.tgz'

const toSteps = (m: readonly MetaStep[]): readonly Step[] => {
    const filter = (st: StepType) => m.flatMap((mt: MetaStep): Step[] => mt.type === st ? [mt.step] : [])
    const aptGet = m.flatMap(v => v.type === 'apt-get' ? [v.package] : []).join(' ')

    const rust = m.find(v => v.type === 'rust') !== undefined
    const targets = m.flatMap(v => v.type === 'rust' && v.target !== undefined ? [v.target] : []).join(',')
    return [
        ...(aptGet !== '' ? [{ run: `sudo apt-get update && sudo apt-get install -y ${aptGet}` }] : []),
        ...(rust ? [{
            // wasm32-wasip1-threads doesn't work on Rust 1.91 in the release mode.
            // See https://github.com/sergey-shandar/wasmtime-crash
            uses: 'dtolnay/rust-toolchain@1.92.0',
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

const nodes = ['20', '22', '25']

const nodeTest = (v: string) => v === '20' ? 'run test20' : 'test'

const nodeSteps = (v: string) => [
    install(installNode(v)),
    test({ run: 'npm ci' }),
    test({ run: `npm ${nodeTest(v)}`}),
]

const ubuntu = (ms: readonly MetaStep[]): Job => ({
    'runs-on': 'ubuntu-latest',
    steps: toSteps(ms)
})

const nodeVersions: Jobs = Object.fromEntries(nodes.map(v => [`node${v}`, ubuntu(nodeSteps(v))]))

const steps = (v: Os) => (a: Architecture): readonly Step[] => {
    const result: readonly MetaStep[] = [
        // Rust
        test({ run: 'cargo fmt -- --check' }),
        test({ run: 'cargo clippy -- -D warnings' }),
        ...cargoTest(),
        install({ uses: 'bytecodealliance/actions/wasmtime/setup@v1' }),
        install({ uses: 'wasmerio/setup-wasmer@v1' }),
        ...wasmTarget('wasm32-wasip1'),
        ...wasmTarget('wasm32-wasip2'),
        ...wasmTarget('wasm32-unknown-unknown'),
        ...wasmTarget('wasm32-wasip1-threads'),
        ...(a !== 'intel' ? [] :
            v === 'windows' ?
                customTarget('i686-pc-windows-msvc') :
            v === 'ubuntu' ? [
                { type: 'apt-get', package: 'libc6-dev-i386' } as const,
                ...customTarget('i686-unknown-linux-gnu'),
            ]:
            []
        ),
        // Node.js
        ...node('24')([
            // TypeScript Preview
            install({ run: 'npm install -g @typescript/native-preview'}),
            test({ run: 'tsgo' }),
            // Playwright
            install({ run: 'npm install -g playwright'}),
            install({ run: 'playwright install --with-deps' }),
            ...['chromium', 'firefox', 'webkit'].map(browser =>
                (test({ run: `npx playwright test --browser=${browser}` }))),
            // publishing
            test({ run: 'npm pack' }),
            test({ run: `npm install -g ${findTgz(v)}` }),
            test({ run: 'fjs compile issues/demo/data/tree.json _tree.f.js' }),
            test({ run: 'fjs t' }),
            test({ run: 'npm uninstall functionalscript -g' }),
        ]),
        // Deno
        ...clean([
            installDeno(v)(a),
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
    return toSteps(result)
}

const jobs = {
    ...Object.fromEntries([
        ...os.flatMap(v => architecture.map(a => [`${v}-${a}`, {
            'runs-on': images[v][a],
            steps: steps(v)(a),
        }]))
    ]),
    ...nodeVersions,
}

const gha: GitHubAction = {
    name: 'CI',
    on: { pull_request: {} },
    jobs,
}

export default async (io: Io): Promise<number> => {
    io.fs.writeFileSync('.github/workflows/ci.yml', encodeUtf8(JSON.stringify(gha, null, '  ')))
    return 0
}
