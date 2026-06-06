/**
 * Continuous integration helper commands for repository automation tasks.
 *
 * @module
 */
import { utf8 } from '../text/module.f.ts'
import { begin, pure, type Effect } from '../effects/module.f.ts'
import { writeFile, type NodeOp } from '../effects/node/module.f.ts'
import { images } from './config/module.f.ts'
import { type Architecture, type GitHubAction, type Job, type Jobs, type MetaStep, type Os, architecture, findTgz, os, test, toSteps } from './common/module.f.ts'
import { rustSteps } from './rust/module.f.ts'
import { nodeMainSteps, nodeVersions } from './node/module.f.ts'
import { playwrightJob } from './playwright/module.f.ts'
import { bunSteps } from './bun/module.f.ts'
import { denoSteps } from './deno/module.f.ts'

const job = (
    rust: boolean,
    nodeExtra: readonly MetaStep[],
    denoExtra: readonly MetaStep[],
    bunExtra: readonly MetaStep[],
) => (o: Os) => (a: Architecture): readonly [string, Job] => {
    const id = `${o}-${a}`
    const image = images[o][a]
    const result = [
        ...(rust ? rustSteps(o, a) : []),
        ...nodeMainSteps(nodeExtra),
        ...denoSteps(denoExtra),
        ...bunSteps(bunExtra)(o, a),
    ]
    return [id, { 'runs-on': image, steps: toSteps(result) }]
}

export type Setup = {
    readonly rust: boolean,
    readonly nodeExtra: (os: Os) => readonly MetaStep[],
    readonly denoExtra: readonly MetaStep[],
    readonly bunExtra: readonly MetaStep[],
}

export const ci = ({ rust, nodeExtra, denoExtra, bunExtra }: Setup): Effect<NodeOp, number> => {
    const jobs: Jobs = {
        ...Object.fromEntries(os.flatMap(o => architecture.map(job(rust, nodeExtra(o), denoExtra, bunExtra)(o)))),
        ...nodeVersions,
        playwright: playwrightJob,
    }
    const gha: GitHubAction = {
        name: 'CI',
        on: {
            pull_request: {},
            merge_group: {},
        },
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
    ],
    denoExtra: [
        test({ run: 'deno task fjs compile issues/demo/data/tree.json _tree.f.js' }),
        test({ run: 'deno task fjs t' }),
        test({ run: 'deno publish --dry-run --allow-slow-types' }),
    ],
    bunExtra: [
        test({ run: 'bun ./fs/fjs/module.ts t' }),
    ]
})

export default () => defaultEffect
