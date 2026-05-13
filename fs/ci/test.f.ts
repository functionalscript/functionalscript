import { ci } from './module.f.ts'
import { utf8ToString } from '../text/module.f.ts'
import { isVec } from '../types/bit_vec/module.f.ts'
import { emptyState, virtual } from '../types/effects/node/virtual/module.f.ts'

type Step = {
    readonly run?: string
    readonly uses?: string
}

type Gha = {
    readonly jobs: { readonly [k: string]: { readonly steps: readonly Step[] } }
}

const hasCargo = (gha: Gha): boolean =>
    Object.values(gha.jobs).some(job => job.steps.some(step => step.run?.includes('cargo')))

const githubState = {
    ...emptyState,
    root: { '.github': { workflows: {} } },
}

const run = (rust: boolean): Gha => {
    const [state, result] = virtual(githubState)(ci(rust))
    if (result !== 0) { throw result }
    const dotGithub = state.root['.github']
    if (dotGithub === undefined || isVec(dotGithub)) { throw dotGithub }
    const workflows = dotGithub['workflows']
    if (workflows === undefined || isVec(workflows)) { throw workflows }
    const file = workflows['ci.yml']
    if (!isVec(file)) { throw file }
    return JSON.parse(utf8ToString(file))
}

export default {
    rust: () => {
        if (!hasCargo(run(true))) { throw 'expected Rust steps' }
    },
    noRust: () => {
        if (hasCargo(run(false))) { throw 'unexpected Rust steps' }
    },
}
