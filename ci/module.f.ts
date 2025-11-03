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

const gha: GitHubAction = {
    name: 'CI',
    on: {
        pull_request: {}
    },
    jobs: Object.fromEntries(os.flatMap(v => architecture.map(a => [`${v}-${a}`, {
        'runs-on': images[v][a],
        steps: [
            { uses: 'actions/checkout@v5'},
            // Node.js
            { uses: 'actions/setup-node@v6', with: { 'node-version': '24' } },
            { run: 'npm ci' },
            { run: 'npm test' },
            { run: 'npm run fst' },
            // Deno
            installDeno(v)(a),
            { run: 'deno task test' },
            { run: 'deno task fst' },
            { run: 'deno publish --dry-run' },
            // Bun
            installBun(v)(a),
            { run: 'bun test --timeout 10000' },
            { run: 'bun ./dev/tf/module.ts' },
            // Rust
            { run: 'cargo fmt -- --check' },
            { run: 'cargo clippy -- -D warnings' },
            { run: 'cargo test' },
        ],
    }]))),
}

export default async (io: Io): Promise<number> => {
    io.fs.writeFileSync('.github/workflows/ci.yml', JSON.stringify(gha, null, '  '))
    return 0
}
