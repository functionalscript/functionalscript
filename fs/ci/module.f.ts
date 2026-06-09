/**
 * Continuous integration helper commands for repository automation tasks.
 *
 * @module
 */
import { utf8, utf8ToString } from '../text/module.f.ts'
import { validatePackageJsonText, type PackageJson } from '../dev/package_json/module.f.ts'
import { pure, type Effect } from '../effects/module.f.ts'
import { access, readFile, writeFile, type NodeOp } from '../effects/node/module.f.ts'
import { functionalscript, images } from './config/module.f.ts'
import { type Architecture, type GitHubAction, type Job, type Jobs, type MetaStep, type Os, architecture, os, test, toSteps, ubuntuArm } from './common/module.f.ts'
import { rustPlatformSteps, rustWasmSteps } from './rust/module.f.ts'
import { nodeMainSteps, nodeVersionJobs } from './node/module.f.ts'
import { playwrightJob } from './playwright/module.f.ts'
import { bunSteps } from './bun/module.f.ts'
import { denoSteps } from './deno/module.f.ts'

const job = (
    rust: boolean,
    nodeExtra: readonly MetaStep[],
) => (o: Os) => (a: Architecture): readonly [string, Job] => {
    const id = `${o}-${a}`
    const image = images[o][a]
    const result = [
        ...(rust ? rustPlatformSteps(o, a) : []),
        ...nodeMainSteps(functionalscript),
        ...nodeExtra,
    ]
    return [id, { 'runs-on': image, steps: toSteps(result) }]
}

export type Setup = {
    readonly nodeExtra: (os: Os) => readonly MetaStep[],
}

const functionalscriptPackageName = 'functionalscript' as const
type PackageInfo = {
    readonly functionalscript: boolean,
}

const fallbackPackageInfo: PackageInfo = {
    functionalscript: false,
}

const packageInfoFromPackageJson = ({ name }: PackageJson): PackageInfo => ({
    functionalscript: name === functionalscriptPackageName,
})

const packageInfoFromText = (text: string): PackageInfo => {
    const result = validatePackageJsonText(text)
    return result[0] === 'ok' ? packageInfoFromPackageJson(result[1]) : fallbackPackageInfo
}

const readPackageInfo: Effect<NodeOp, PackageInfo> =
    readFile('package.json')
    .step(result => pure(result[0] === 'ok' ? packageInfoFromText(utf8ToString(result[1])) : fallbackPackageInfo))

const canonicalJobs = (rust: boolean): Jobs => ({
    ...(rust ? { wasm: ubuntuArm(rustWasmSteps) } : {}),
    deno: ubuntuArm(denoSteps(functionalscript)),
    bun: ubuntuArm(bunSteps(functionalscript)),
    ...nodeVersionJobs(functionalscript),
    playwright: playwrightJob,
})

export const ci = ({ nodeExtra }: Setup): Effect<NodeOp, number> =>
    access('Cargo.toml').step(result => {
        const rust = result[0] === 'ok'
        const jobs: Jobs = {
            ...Object.fromEntries(os.flatMap(o => architecture.map(job(rust, nodeExtra(o))(o)))),
            ...canonicalJobs(rust),
        }
        const gha: GitHubAction = {
            name: 'CI',
            on: {
                pull_request: {},
                merge_group: {},
            },
            jobs,
        }
        return writeFile('.github/workflows/ci.yml', utf8(JSON.stringify(gha, null, '  ')))
            .step(() => pure(0))
    })

const demoCompile = [
    test({ run: 'fjs compile issues/demo/data/tree.json _tree.f.js' }),
] as const

const defaultNodeExtra = ({ functionalscript }: PackageInfo) => (): readonly MetaStep[] =>
    functionalscript ? demoCompile : []

const defaultEffect = (info: PackageInfo): Effect<NodeOp, number> => ci({
    nodeExtra: defaultNodeExtra(info),
})

export const main = () => readPackageInfo.step(defaultEffect)
