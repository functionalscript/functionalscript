/**
 * Type-level API for shared CI types: GitHub Actions step/job RTTI schemas,
 * the `MetaStep` representation used by tool-specific modules.
 */

import type { Ts } from '../../rtti/ts/types.ts'
import type { images } from '../config/module.f.mjs'
import type { os, architecture, stepSchema, jobSchema, jobsSchema, gitHubActionSchema } from './module.f.mjs'

export type Os = typeof os[number]

export type Architecture = typeof architecture[number]

export type Image = typeof images[Os][Architecture]

export type Step = Ts<typeof stepSchema>
export type Job = Ts<typeof jobSchema>
export type Jobs = Ts<typeof jobsSchema>
export type GitHubAction = Ts<typeof gitHubActionSchema>

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
