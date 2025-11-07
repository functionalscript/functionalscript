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
} | {
    readonly type: 'target'
    readonly target: string
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
    { type: 'target', target },
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

const basicNode = (version: string) => (extra: readonly MetaStep[]): readonly MetaStep[] => clean([
    test({ uses: 'actions/setup-node@v6', with: { 'node-version': version } }),
    test({ run: 'npm ci' }),
    ...extra,
])

const oldNode = (version: string): readonly MetaStep[] => basicNode(version)([
    test({ run: `npm run test${version}` }),
])

const node = (version: string) => (extra: readonly MetaStep[]): readonly MetaStep[] => basicNode(version)([
    test({ run: 'npm test' }),
    test({ run: 'npm run fst' }),
    ...extra,
])

const findTgz = (v: Os) => v === 'windows' ? '(Get-ChildItem *.tgz).FullName' : './*.tgz'

const steps = (v: Os) => (a: Architecture): readonly Step[] => {
    const result: readonly MetaStep[] = [
        // wasm32-wasip1-threads doesn't work on Rust 1.91 in the release mode.
        install({ run: 'rustup default 1.90.0' }),
        install({ run: 'rustup component add rustfmt clippy' }),
        test({ uses: 'actions/checkout@v5' }),
        // Node.js
        ...oldNode('20'),

        ...oldNode('22'),
        ...node('24')([]),
        ...node('25')([
            // TypeScript Preview
            test({ run: 'npx tsgo' }),
            // Playwright
            test({ run: 'npx playwright install --with-deps' }),
            ...['chromium', 'firefox', 'webkit'].map(browser =>
            (test({ run: `npx playwright test --browser=${browser}` }))),
            // publishing
            test({ run: 'npm pack' }),
            test({ run: `npm install -g ${findTgz(v)}` }),
            test({ run: 'fsc issues/demo/data/tree.json _tree.f.js' }),
            test({ run: 'fst' }),
            test({ run: 'npm uninstall functionalscript -g' }),
        ]),
        // Deno
        ...clean([
            installDeno(v)(a),
            test({ run: 'deno install' }),
            test({ run: 'deno task test' }),
            test({ run: 'deno task fst' }),
            test({ run: 'deno publish --dry-run' }),
        ]),
        // Bun
        ...clean([
            installBun(v)(a),
            test({ run: 'bun test --timeout 20000' }),
            test({ run: 'bun ./dev/tf/module.ts' }),
        ]),
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
    ]
    const more = a !== 'intel'
        ? []
        : v === 'windows' ? customTarget('i686-pc-windows-msvc')
        : v === 'ubuntu' ? [
            install({ run: 'sudo dpkg --add-architecture i386'}),
            install({ run: 'sudo apt-get update && sudo apt-get install -y gcc-multilib g++-multilib libc6-dev-i386' }),
            ...customTarget('i686-unknown-linux-gnu'),
        ]
        : []
    const m = [...result, ...more]
    const filter = (st: StepType) => (mt: MetaStep): Step[] => mt.type === st ? [mt.step] : []
    return [
        ...m.flatMap(filter('install')),
        { run: 'rustup target add ' + m.flatMap(v => v.type === 'target' ? [v.target] : []).join(' ') },
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
