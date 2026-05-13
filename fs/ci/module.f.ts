/**
 * Continuous integration helper commands for repository automation tasks.
 *
 * @module
 */
import { utf8 } from '../text/module.f.ts'
import { begin, pure, type Effect } from '../types/effects/module.f.ts'
import { writeFile, type NodeOp } from '../types/effects/node/module.f.ts'
import { images } from './config/module.f.ts'
import { type Architecture, type GitHubAction, type Job, type Jobs, type Os, architecture, os, toSteps } from './common/module.f.ts'
import { rustSteps } from './rust/module.f.ts'
import { nodeMainSteps, nodeVersions } from './node/module.f.ts'
import { playwrightJob } from './playwright/module.f.ts'
import { bunSteps } from './bun/module.f.ts'
import { denoSteps } from './deno/module.f.ts'

const job = (rust: boolean) => (o: Os) => (a: Architecture): readonly [string, Job] => {
    const id = `${o}-${a}`
    const image = images[o][a]
    const result = [
        ...(rust ? rustSteps(o, a) : []),
        ...nodeMainSteps(o),
        ...denoSteps,
        ...bunSteps(o, a),
    ]
    return [id, { 'runs-on': image, steps: toSteps(result) }]
}

export const ci = (rust: boolean): Effect<NodeOp, number> => {
    const jobs: Jobs = {
        ...Object.fromEntries(os.flatMap(o => architecture.map(job(rust)(o)))),
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

const defaultEffect: Effect<NodeOp, number> = ci(true)

export default () => defaultEffect
