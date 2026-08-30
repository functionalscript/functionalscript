/**
 * Shared CI types and helpers: GitHub Actions step/job RTTI schemas, the
 * `MetaStep` representation used by tool-specific modules, and assemblers like
 * `install`, `test`, `ubuntu`, and `toSteps`. See `./types.ts` for the
 * `Os`/`Architecture`/`Image`/`Step`/`Job`/`Jobs`/`GitHubAction`/`StepType`/
 * `MetaStep` type-level API.
 *
 * @module
 *
 * @import { Step, Job, MetaStep, StepType } from './types.ts'
 */

import { actions, images } from '../config/module.f.mjs'
import { array, option, or, record, string } from '../../rtti/module.f.mjs'
import { parse as rttiParse } from '../../rtti/parse/module.f.mjs'

export const os = /** @type {const} */ (['ubuntu', 'macos', 'windows'])

export const architecture = /** @type {const} */ (['intel', 'arm'])

// These three are **closed**, which is the bare form's meaning and the right
// one here: `parseGitHubAction` reads back a workflow this repo generates, so
// a key the schema does not name is generator drift rather than a field a
// third party added. Reading a hand-written workflow — which carries `name`,
// `if`, `env` and much else — would need `open`.

// `continue-on-error` is admitted as the literal `true` rather than as a
// boolean: `false` is the field's own default, so emitting it would say
// nothing, and a schema that accepts both invites a step that spells its
// default out. A step carrying it is a step whose failure is an expected
// outcome — the npm publish, whose "already published" answer is the usual one
// — and there is exactly one.
export const stepSchema = /** @type {const} */ ({
    run: or(option, string),
    uses: or(option, string),
    with: or(option, record(string)),
    'continue-on-error': or(option, true)
})

// `needs` is how one job waits for another: a job that consumes an artifact
// cannot start before the job that uploads it. It is optional because most jobs
// are independent, and it is named here rather than emitted past the schema —
// `parseGitHubAction` reads back the workflow this repository generates, so an
// unmodelled key would fail that round-trip in `fjs/ci/proof.f.mjs`.
export const jobSchema = /** @type {const} */ ({
    'runs-on': string,
    needs: or(option, array(string)),
    steps: array(stepSchema)
})

export const jobsSchema = record(jobSchema)

export const gitHubActionSchema = /** @type {const} */ ({
    name: string,
    // Every trigger any generated workflow uses, all optional, because no
    // workflow uses them all: `ci.yml` is a pull-request gate and the publish
    // workflow fires on a push to a branch. `push` carries the branch list;
    // without it a push to any branch would publish.
    on: {
        pull_request: or(option, {}),
        merge_group: or(option, {}),
        push: or(option, { branches: array(string) })
    },
    permissions: record(string),
    jobs: jobsSchema
})

export const parseGitHubAction = rttiParse(gitHubActionSchema)

/** @type {(name: keyof typeof actions, w?: Record<string, string>) => Step} */
export const uses = (name, w) => ({
    uses: `${name}@${actions[name]}`,
    ...(w === undefined ? {} : { with: w })
})

/** @type {(step: Step) => MetaStep} */
export const install = step => ({ type: 'install', step })

/** @type {(step: Step) => MetaStep} */
export const test = step => ({ type: 'test', step })

/** @type {(m: readonly MetaStep[]) => readonly Step[]} */
export const toSteps = m => {
    /** @type {(st: StepType) => Step[]} */
    const filter = st => m.flatMap(mt => mt.type === st ? [mt.step] : [])
    const aptGet = m.flatMap(v => v.type === 'apt-get' ? [v.package] : []).join(' ')

    const needRust = m.find(v => v.type === 'rust') !== undefined
    const targets = m.flatMap(v => v.type === 'rust' && v.target !== undefined ? [v.target] : []).join(',')
    return [
        ...(aptGet !== '' ? [{ run: `sudo apt-get update && sudo apt-get install -y ${aptGet}` }] : []),
        ...(needRust ? [uses('dtolnay/rust-toolchain', {
            components: 'rustfmt,clippy',
            ...(targets === '' ? {} : { targets }),
        })] : []),
        ...filter('install'),
        uses('actions/checkout'),
        ...filter('test'),
    ]
}

/** @type {(ms: readonly MetaStep[]) => Job} */
export const ubuntu = ms => ({
    'runs-on': images.ubuntu.intel,
    steps: toSteps(ms)
})

/** @type {(ms: readonly MetaStep[]) => Job} */
export const ubuntuArm = ms => ({
    'runs-on': images.ubuntu.arm,
    steps: toSteps(ms)
})
