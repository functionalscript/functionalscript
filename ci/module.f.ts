import type { Io } from '../io/module.f.ts'

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

type GitHubAction = {
    readonly name: string
    readonly on: {
        readonly pull_request?: {}
    }
    readonly jobs: {
        readonly [jobs: string]: {
            readonly 'runs-on': Image
            readonly steps: readonly Step[]
        }
    }
}

type StepType = 'install' | 'test'

type MetaStep = {
    readonly type: StepType
    readonly step: Step
}

const i = (step: Step): MetaStep => ({ type: 'install', step })

const t = (step: Step): MetaStep => ({ type: 'test', step })

type Tool = {
    readonly def: Step
    readonly name: string
    readonly path: string
}

const installOnWindowsArm = ({ def, name, path }: Tool) => (v: Os) => (a: Architecture): MetaStep =>
    i(v === 'windows' && a === 'arm'
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
        t({ run: main }),
        t({ run: `${main} --release` })
    ]
}

const customTarget = (target: string): readonly MetaStep[] => [
    i({ run: `rustup target add ${target}` }),
    ...cargoTest(target)
]

const wasmTarget = (target: string): readonly MetaStep[] => [
    ...customTarget(target),
    ...cargoTest(target, '.cargo/config.wasmer.toml')
]

const clean = (steps: readonly MetaStep[]): readonly MetaStep[] => [
    ...steps,
    t({ run: 'git reset --hard HEAD && git clean -fdx' })
]

const basicNode = (version: string) => (extra: readonly MetaStep[]): readonly MetaStep[] => clean([
    t({ uses: 'actions/setup-node@v6', with: { 'node-version': version } }),
    t({ run: 'npm ci' }),
    ...extra,
])

const oldNode = (version: string): readonly MetaStep[] => basicNode(version)([
    t({ run: `npm run test${version}` }),
])

const node = (version: string) => (extra: readonly MetaStep[]): readonly MetaStep[] => basicNode(version)([
    t({ run: 'npm test' }),
    t({ run: 'npm run fst' }),
    ...extra,
])

const install = (v: Os) => v === 'windows' ? '(Get-ChildItem *.tgz).FullName' : './*.tgz'

const steps = (v: Os) => (a: Architecture): readonly Step[] => {
    const result: readonly MetaStep[] = [
        // wasm32-wasip1-threads doesn't work on Rust 1.91 in the release mode.
        i({ run: 'rustup default 1.90.0' }),
        i({ run: 'rustup component add rustfmt clippy' }),
        t({ uses: 'actions/checkout@v5' }),
        // Node.js
        ...oldNode('20'),

        ...oldNode('22'),
        ...node('24')([]),
        ...node('25')([
            // TypeScript Preview
            t({ run: 'npx tsgo' }),
            // Playwright
            t({ run: 'npx playwright install --with-deps' }),
            ...['chromium', 'firefox', 'webkit'].map(browser =>
            (t({ run: `npx playwright test --browser=${browser}` }))),
            // publishing
            t({ run: 'npm pack' }),
            t({ run: `npm install -g ${install(v)}` }),
            t({ run: 'fsc issues/demo/data/tree.json _tree.f.js' }),
            t({ run: 'fst' }),
            t({ run: 'npm uninstall functionalscript -g' }),
        ]),
        // Deno
        ...clean([
            installDeno(v)(a),
            t({ run: 'deno install' }),
            t({ run: 'deno task test' }),
            t({ run: 'deno task fst' }),
            t({ run: 'deno publish --dry-run' }),
        ]),
        // Bun
        ...clean([
            installBun(v)(a),
            t({ run: 'bun test --timeout 20000' }),
            t({ run: 'bun ./dev/tf/module.ts' }),
        ]),
        // Rust
        t({ run: 'cargo fmt -- --check' }),
        t({ run: 'cargo clippy -- -D warnings' }),
        ...cargoTest(),
        i({ uses: 'bytecodealliance/actions/wasmtime/setup@v1' }),
        i({ uses: 'wasmerio/setup-wasmer@v1' }),
        ...wasmTarget('wasm32-wasip1'),
        ...wasmTarget('wasm32-wasip2'),
        ...wasmTarget('wasm32-unknown-unknown'),
        ...wasmTarget('wasm32-wasip1-threads'),
    ]
    const more = a !== 'intel'
        ? []
        : v === 'windows' ? customTarget('i686-pc-windows-msvc')
        : v === 'ubuntu' ? [
            i({ run: 'sudo dpkg --add-architecture i386'}),
            i({ run: 'sudo apt-get update && sudo apt-get install -y gcc-multilib g++-multilib libc6-dev-i386' }),
            ...customTarget('i686-unknown-linux-gnu'),
        ]
        : []
    const m = [...result, ...more]
    const filter = (st: StepType) => ({ type, step }: MetaStep): Step[] => type === st ? [step] : []
    return [
        ...m.flatMap(filter('install')),
        ...m.flatMap(filter('test')),
    ]
}

const gha: GitHubAction = {
    name: 'CI',
    on: {
        pull_request: {}
    },
    jobs: Object.fromEntries(os.flatMap(v => architecture.map(a => [`${v}-${a}`, {
        'runs-on': images[v][a],
        steps: steps(v)(a),
    }]))),
}

export default async (io: Io): Promise<number> => {
    io.fs.writeFileSync('.github/workflows/ci.yml', JSON.stringify(gha, null, '  '))
    return 0
}
