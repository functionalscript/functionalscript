/**
 * Continuous integration helper commands for repository automation tasks.
 *
 * @module
 */
import { utf8 } from '../text/module.f.ts'
import { begin, pure, type Effect } from '../types/effects/module.f.ts'
import { writeFile, type NodeOp } from '../types/effects/node/module.f.ts'
import { images } from './config/module.f.ts'
import { type Architecture, type GitHubAction, type Job, type Jobs, type MetaStep, type Os, architecture, findTgz, os, test, toSteps } from './common/module.f.ts'
import { rustSteps } from './rust/module.f.ts'
import { nodeMainSteps, nodeVersions } from './node/module.f.ts'
import { playwrightJob } from './playwright/module.f.ts'
import { bunSteps } from './bun/module.f.ts'
import { denoSteps } from './deno/module.f.ts'

const job = (rust: boolean, extra: readonly MetaStep[]) => (o: Os) => (a: Architecture) : readonly [string, Job] => {
    const id = `${o}-${a}`
    const image = images[o][a]
    const result = [
        ...(rust ? rustSteps(o, a) : []),
        ...nodeMainSteps(extra),
        ...denoSteps,
        ...bunSteps(o, a),
    ]
    return [id, { 'runs-on': image, steps: toSteps(result) }]
}

export type Setup = {
    readonly rust: boolean,
    readonly nodeExtra: (os: Os) => readonly MetaStep[],
}

export const ci = ({ rust, nodeExtra }: Setup): Effect<NodeOp, number> => {
    const jobs: Jobs = {
        ...Object.fromEntries(os.flatMap(o => architecture.map(job(rust, nodeExtra(o))(o)))),
        ...nodeVersions,
        playwright: playwrightJob,
    }
    const gha: GitHubAction = {
        name: 'CI',
        on: { pull_request: {} },
        jobs,
    }
    return begin
        .step(() => writeFile('.github/workflows/ci.yml', utf8(JSON.stringify(gha, null, '  '))))
        .step(() => pure(0))
}

const defaultEffect: Effect<NodeOp, number> = ci({
    rust: true,
    nodeExtra: o => [
        test({ run: 'npm pack' }),
        test({ run: `npm install -g ${findTgz(o)}` }),
        test({ run: 'fjs compile issues/demo/data/tree.json _tree.f.js' }),
        test({ run: 'fjs t' }),
        test({ run: 'npm uninstall functionalscript -g' }),
    ]
})

export default () => defaultEffect
