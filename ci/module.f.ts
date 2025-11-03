import type { Io } from '../io/module.f.ts'

type GitHubAction = {
    on: {}
    jobs: {
        [jobs: string]: {
            'runs-on': string
            steps: readonly string[]
        }
    }
}

const gha: GitHubAction = {
    on: {},
    jobs: {
        main: {
            'runs-on': 'ubuntu-latest',
            steps: []
        },
    },
}

export default async(io: Io): Promise<number> => {
    io.fs.writeFileSync('.github/workflows/ci.yml', JSON.stringify(gha, null, '  '))
    return 0
}
