import type { Io } from '../io/module.f.ts'

const os = ['ubuntu', 'macos', 'windows'] as const

type Os = typeof os[number]

type GitHubAction = {
    on: {}
    jobs: {
        [jobs: string]: {
            'runs-on': Os
            steps: readonly string[]
        }
    }
}

type Architecture = 'intel' | 'arm'

const gha: GitHubAction = {
    on: {},
    jobs: Object.fromEntries(os.map(v => [v, {
        'runs-on': v,
        steps: [],
    }])),
}

export default async(io: Io): Promise<number> => {
    io.fs.writeFileSync('.github/workflows/ci.yml', JSON.stringify(gha, null, '  '))
    return 0
}
