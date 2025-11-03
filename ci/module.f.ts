import type { Io } from '../io/module.f.ts'

const os = ['ubuntu', 'macos', 'windows'] as const

type Os = `${typeof os[number]}-latest`

type GitHubAction = {
    on: {
        pull_request?: {}
    }
    jobs: {
        readonly[jobs: string]: {
            'runs-on': Os
            steps: readonly {
                readonly run: string
            }[]
        }
    }
}

type Architecture = 'intel' | 'arm'

const gha: GitHubAction = {
    on: {
        pull_request: {}
    },
    jobs: Object.fromEntries(os.map(v => [v, {
        'runs-on': `${v}-latest`,
        steps: [{
            run: 'npm test'
        }],
    }])),
}

export default async(io: Io): Promise<number> => {
    io.fs.writeFileSync('.github/workflows/ci.yml', JSON.stringify(gha, null, '  '))
    return 0
}
