import { images, rust } from '../config/module.f.ts'
import { option, array, record, string } from '../../types/rtti/module.f.ts'
import { type Ts } from '../../types/rtti/ts/module.f.ts'
import { parse as rttiParse } from '../../types/rtti/parse/module.f.ts'

export const os = ['ubuntu', 'macos', 'windows'] as const

export type Os = typeof os[number]

export const architecture = ['intel', 'arm'] as const

export type Architecture = typeof architecture[number]

export type Image = typeof images[Os][Architecture]

const stepSchema = { run: option(string), uses: option(string), with: option(record(string)) }
const jobSchema = { 'runs-on': string, steps: array(stepSchema) }
const jobsSchema = record(jobSchema)
export const gitHubActionSchema = { name: string, on: { pull_request: option({}) }, jobs: jobsSchema }

export type Step = Ts<typeof stepSchema>
export type Job = Ts<typeof jobSchema>
export type Jobs = Ts<typeof jobsSchema>
export type GitHubAction = Ts<typeof gitHubActionSchema>

export const parseGitHubAction = rttiParse(gitHubActionSchema)

export type StepType = 'install' | 'test'

export type MetaStep = {
    readonly type: StepType
    readonly step: Step
} | {
    readonly type: 'rust'
    readonly target?: string
} | {
    readonly type: 'apt-get'
    readonly package: string
}

export const install = (step: Step): MetaStep => ({ type: 'install', step })

export const test = (step: Step): MetaStep => ({ type: 'test', step })

export const clean = (steps: readonly MetaStep[]): readonly MetaStep[] => [
    ...steps,
    test({ run: 'git reset --hard HEAD && git clean -fdx' })
]

export const toSteps = (m: readonly MetaStep[]): readonly Step[] => {
    const filter = (st: StepType) => m.flatMap((mt: MetaStep): Step[] => mt.type === st ? [mt.step] : [])
    const aptGet = m.flatMap(v => v.type === 'apt-get' ? [v.package] : []).join(' ')

    const needRust = m.find(v => v.type === 'rust') !== undefined
    const targets = m.flatMap(v => v.type === 'rust' && v.target !== undefined ? [v.target] : []).join(',')
    return [
        ...(aptGet !== '' ? [{ run: `sudo apt-get update && sudo apt-get install -y ${aptGet}` }] : []),
        ...(needRust ? [{
            uses: `dtolnay/rust-toolchain@${rust}`,
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

export const ubuntu = (ms: readonly MetaStep[]): Job => ({
    'runs-on': images.ubuntu.intel,
    steps: toSteps(ms)
})

export const findTgz = (v: Os) => v === 'windows' ? '(Get-ChildItem *.tgz).FullName' : './*.tgz'
