import type { Io } from '../io/module.f.ts'

const os = ['ubuntu', 'macos', 'windows'] as const

type Os = typeof os[number]

type GitHubAction = {
    on: {}
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
    on: {},
    jobs: Object.fromEntries(os.map(v => [v, {
        'runs-on': v,
        steps: [{
            run: 'node test'
        }],
    }])),
}

export default async(io: Io): Promise<number> => {
    io.fs.writeFileSync('.github/workflows/ci.yml', JSON.stringify(gha, null, '  '))
    return 0
}
