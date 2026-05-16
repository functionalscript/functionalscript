import { ci } from './module.f.ts'
import { utf8ToString } from '../text/module.f.ts'
import { isVec } from '../types/bit_vec/module.f.ts'
import { type MetaStep, type Os, test } from './common/module.f.ts'
import { assert } from '../dev/module.f.ts'
import { emptyState, virtual } from '../types/effects/node/virtual/module.f.ts'

type Step = {
    readonly run?: string
    readonly uses?: string
}

type Gha = {
    readonly jobs: { readonly [k: string]: { readonly steps: readonly Step[] } }
}

const hasRun = (cmd: string) => (gha: Gha): boolean =>
    Object.values(gha.jobs).some(job => job.steps.some(step => step.run?.includes(cmd)))

const hasRunInJob = (jobId: string, cmd: string) => (gha: Gha): boolean =>
    gha.jobs[jobId]?.steps.some(step => step.run?.includes(cmd)) ?? false

const githubState = {
    ...emptyState,
    root: { '.github': { workflows: {} } },
}

const run = (rust: boolean, nodeExtra: (o: Os) => readonly MetaStep[] = () => []): Gha => {
    const [state, result] = virtual(githubState)(ci({ rust, nodeExtra, denoExtra: [], bunExtra: [] }))
    assert(result === 0, result)
    const dotGithub = state.root['.github']
    assert(dotGithub !== undefined && !isVec(dotGithub), dotGithub)
    const workflows = dotGithub['workflows']
    assert(workflows !== undefined && !isVec(workflows), workflows)
    const file = workflows['ci.yml']
    assert(isVec(file), file)
    return JSON.parse(utf8ToString(file))
}

export default {
    rust: () => {
        assert(hasRun('cargo')(run(true)), 'expected Rust steps')
    },
    noRust: () => {
        assert(!hasRun('cargo')(run(false)), 'unexpected Rust steps')
    },
    extra: {
        allOs: () => {
            const cmd = 'echo hello'
            const gha = run(false, () => [test({ run: cmd })])
            for (const o of ['ubuntu', 'macos', 'windows'] as const) {
                for (const a of ['intel', 'arm'] as const) {
                    assert(hasRunInJob(`${o}-${a}`, cmd)(gha), `missing extra step in ${o}-${a}`)
                }
            }
        },
        osSpecific: () => {
            const gha = run(false, o => o === 'ubuntu' ? [test({ run: 'echo ubuntu-only' })] : [])
            for (const a of ['intel', 'arm'] as const) {
                assert(hasRunInJob(`ubuntu-${a}`, 'echo ubuntu-only')(gha), `missing step in ubuntu-${a}`)
                assert(!hasRunInJob(`macos-${a}`, 'echo ubuntu-only')(gha), `unexpected step in macos-${a}`)
                assert(!hasRunInJob(`windows-${a}`, 'echo ubuntu-only')(gha), `unexpected step in windows-${a}`)
            }
        },
    },
}
