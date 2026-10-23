/**
 * Data shared by the generated CI gates and the successful-check cache.
 *
 * @module
 */

import type { Step } from '../common/types.ts'

export type Rung = 'fjs' | 'js' | 'ts' | 'rust'

export type Check = {
    readonly id: string
    readonly rung: Rung
    readonly steps: readonly Step[]
}

export type Platform = {
    readonly os: string
    readonly version: string
    readonly architecture: string
}
