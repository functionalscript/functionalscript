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

type Tool = {
    readonly def: Step
    readonly name: string
    readonly path: string
}

const installOnWindowsArm = ({ def, name, path }: Tool) => (v: Os) => (a: Architecture): Step =>
    v === 'windows' && a === 'arm'
        ? { run: `irm ${path}/install.ps1 | iex; "$env:USERPROFILE\\.${name}\\bin" | Out-File -FilePath $env:GITHUB_PATH -Encoding utf8 -Append` }
        : def

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

const cargoTest = (target?: string, config?: string): readonly Step[] => {
    const t = target ? ` --target ${target}` : ''
    const c = config ? ` --config ${config}` : ''
    const main = `cargo test${t}${c}`
    return [
        { run: main },
        { run: `${main} --release` }
    ]
}

const customTarget = (target: string): readonly Step[] => [
    { run: `rustup target add ${target}` },
    ...cargoTest(target)
]

const wasmTarget = (target: string): readonly Step[] => [
    ...customTarget(target),
    ...cargoTest(target, '.cargo/config.wasmer.toml')
]

const clean = (steps: readonly Step[]): readonly Step[] => [
    ...steps,
    { run: 'git reset --hard HEAD && git clean -fdx' }
]

const basicNode = (version: string) => (extra: readonly Step[]): readonly Step[] => clean([
    { uses: 'actions/setup-node@v6', with: { 'node-version': version } },
    // { run: `nvm install ${version} && nvm use ${version}` },
    { run: 'npm ci' },
    ...extra,
])

const oldNode = (version: string): readonly Step[] => basicNode(version)([
    { run: `npm run test${version}` },
])

const node = (version: string) => (extra: readonly Step[]): readonly Step[] => basicNode(version)([
    { run: 'npm test' },
    { run: 'npm run fst' },
    ...extra,
])

const install = (v: Os) => v === 'windows' ? '(Get-ChildItem *.tgz).FullName' : './*.tgz'

const steps = (v: Os) => (a: Architecture): readonly Step[] => {
    const result = [
        // wasm32-wasip1-threads doesn't work on Rust 1.91 in the release mode.
        // { run: 'rustc -V' },
        { run: 'rustup default 1.90.0' },
        { run: 'rustup component add rustfmt clippy' },
        { uses: 'actions/checkout@v5' },
        // Node.js
        ...oldNode('20'),
        ...oldNode('22'),
        ...node('24')([]),
        ...node('25')([
            // TypeScript Preview
            { run: 'npx tsgo' },
            // Playwright
            { run: 'npx playwright install --with-deps' },
            ...['chromium', 'firefox', 'webkit'].map(browser =>
            ({ run: `npx playwright test --browser=${browser}` })),
            // publishing
            { run: 'npm pack' },
            { run: `npm install -g ${install(v)}` },
            { run: 'fsc issues/demo/data/tree.json _tree.f.js' },
            { run: 'fst' },
            { run: 'npm uninstall functionalscript -g' },
        ]),
        // Deno
        ...clean([
            installDeno(v)(a),
            { run: 'deno install' },
            { run: 'deno task test' },
            { run: 'deno task fst' },
            { run: 'deno publish --dry-run' },
        ]),
        // Bun
        ...clean([
            installBun(v)(a),
            { run: 'bun test --timeout 20000' },
            { run: 'bun ./dev/tf/module.ts' },
        ]),
        // Rust
        { run: 'cargo fmt -- --check' },
        { run: 'cargo clippy -- -D warnings' },
        ...cargoTest(),
        { uses: 'bytecodealliance/actions/wasmtime/setup@v1' },
        { uses: 'wasmerio/setup-wasmer@v1' },
        ...wasmTarget('wasm32-wasip1'),
        ...wasmTarget('wasm32-wasip2'),
        ...wasmTarget('wasm32-unknown-unknown'),
        ...wasmTarget('wasm32-wasip1-threads'),
    ]
    const more = a !== 'intel'
        ? []
        : v === 'windows' ? cargoTest('i686-pc-windows-msvc')
        : v === 'ubuntu' ? [
            { run: 'sudo dpkg --add-architecture i386'},
            { run: 'sudo apt-get update && sudo apt-get install -y gcc-multilib g++-multilib libc6-dev-i386' },
            ...customTarget('i686-unknown-linux-gnu'),
        ]
        : []
    return [...result, ...more]
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
