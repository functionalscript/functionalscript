/**
 * Continuous integration helper commands for repository automation tasks.
 *
 * @module
 */
import { utf8 } from '../text/module.f.ts'
import { begin, pure, type Effect } from '../fs/types/effects/module.f.ts'
import { writeFile, type NodeOp } from '../fs/types/effects/node/module.f.ts'
import { images } from './config/module.f.ts'
import { type Architecture, type GitHubAction, type Job, type Jobs, type Os, architecture, os, toSteps } from './common/module.f.ts'
import { rustSteps } from './rust/module.f.ts'
import { nodeMainSteps, nodeVersions } from './node/module.f.ts'
import { playwrightJob } from './playwright/module.f.ts'
import { bunSteps } from './bun/module.f.ts'
import { denoSteps } from './deno/module.f.ts'

const job = (v: Os) => (a: Architecture): readonly [string, Job] => {
    const id = `${v}-${a}`
    const image = images[v][a]
    const result = [
        ...rustSteps(a, v),
        ...nodeMainSteps(v),
        ...denoSteps,
        ...bunSteps(v, a),
    ]
    return [id, { 'runs-on': image, steps: toSteps(result) }]
}

const jobs: Jobs = {
    ...Object.fromEntries(os.flatMap(v => architecture.map(job(v)))),
    ...nodeVersions,
    playwright: playwrightJob,
}

const gha: GitHubAction = {
    name: 'CI',
    on: { pull_request: {} },
    jobs,
}

export const effect: Effect<NodeOp, number> = begin
    .step(() => writeFile('.github/workflows/ci.yml', utf8(JSON.stringify(gha, null, '  '))))
    .step(() => pure(0))

export default () => effect
