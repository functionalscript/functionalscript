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

type GitHubAction = {
    name: string
    on: {
        pull_request?: {}
    }
    jobs: {
        readonly [jobs: string]: {
            'runs-on': Image
            steps: readonly {
                readonly run?: string
                readonly uses?: string
                readonly with?: {
                    readonly 'node-version': string
                }
            }[]
        }
    }
}

const gha: GitHubAction = {
    name: 'CI',
    on: {
        pull_request: {}
    },
    jobs: Object.fromEntries(os.flatMap(v => architecture.map(a => [`${v}-${a}`, {
        'runs-on': images[v][a],
        steps: [
            { uses: 'actions/checkout@v5'},
            { uses: 'actions/setup-node@v6', with: { 'node-version': '24' } },
            { run: 'npm ci' },
            { run: 'npm test' }
        ],
    }]))),
}

export default async (io: Io): Promise<number> => {
    io.fs.writeFileSync('.github/workflows/ci.yml', JSON.stringify(gha, null, '  '))
    return 0
}
