/**
 * Continuous integration helper commands for repository automation tasks.
 *
 * @module
 */
import { utf8, utf8ToString } from '../text/module.f.ts'
import { validatePackageJsonText, type PackageJson } from '../dev/package_json/module.f.ts'
import { pure, type Effect } from '../effects/module.f.ts'
import { access, readFile, writeFile, type NodeOp } from '../effects/node/module.f.ts'
import { images } from './config/module.f.ts'
import { type Architecture, type GitHubAction, type Job, type Jobs, type MetaStep, type Os, architecture, os, test, toSteps, ubuntuArm } from './common/module.f.ts'
import { rustPlatformSteps, rustWasmSteps } from './rust/module.f.ts'
import { nodeMainSteps, nodeVersionJobs } from './node/module.f.ts'
import { playwrightJob } from './playwright/module.f.ts'
import { bunSteps } from './bun/module.f.ts'
import { denoSteps } from './deno/module.f.ts'

const job = (
    rust: boolean,
    version: string,
    nodeExtra: readonly MetaStep[],
) => (o: Os) => (a: Architecture): readonly [string, Job] => {
    const id = `${o}-${a}`
    const image = images[o][a]
    const result = [
        ...(rust ? rustPlatformSteps(o, a) : []),
        ...nodeMainSteps(version),
        ...nodeExtra,
    ]
    return [id, { 'runs-on': image, steps: toSteps(result) }]
}

export type Setup = {
    readonly version: string,
    readonly nodeExtra: (os: Os) => readonly MetaStep[],
}

const functionalscriptPackageName = 'functionalscript' as const
const fallbackVersion = 'latest' as const

type PackageInfo = {
    readonly name: string,
    readonly version: string,
    readonly functionalscript: boolean,
}

const fallbackPackageInfo: PackageInfo = {
    name: functionalscriptPackageName,
    version: fallbackVersion,
    functionalscript: false,
}

const packageInfoFromPackageJson = ({ name, version }: PackageJson): PackageInfo => ({
    name: name ?? fallbackPackageInfo.name,
    version: version ?? fallbackPackageInfo.version,
    functionalscript: name === functionalscriptPackageName,
})

const packageInfoFromText = (text: string): PackageInfo => {
    const result = validatePackageJsonText(text)
    return result[0] === 'ok' ? packageInfoFromPackageJson(result[1]) : fallbackPackageInfo
}

const readPackageInfo: Effect<NodeOp, PackageInfo> =
    readFile('package.json')
    .step(result => pure(result[0] === 'ok' ? packageInfoFromText(utf8ToString(result[1])) : fallbackPackageInfo))

const canonicalJobs = (rust: boolean, version: string): Jobs => ({
    ...(rust ? { wasm: ubuntuArm(rustWasmSteps) } : {}),
    deno: ubuntuArm(denoSteps(version)),
    bun: ubuntuArm(bunSteps(version)),
    ...nodeVersionJobs(version),
    playwright: playwrightJob,
})

export const ci = ({ version, nodeExtra }: Setup): Effect<NodeOp, number> =>
    access('Cargo.toml').step(result => {
        const rust = result[0] === 'ok'
        const jobs: Jobs = {
            ...Object.fromEntries(os.flatMap(o => architecture.map(job(rust, version, nodeExtra(o))(o)))),
            ...canonicalJobs(rust, version),
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
    version: info.version,
    nodeExtra: defaultNodeExtra(info),
})

export const main = () => readPackageInfo.step(defaultEffect)
