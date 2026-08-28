/**
 * Types for the CI workflow generator.
 */

import type { MetaStep, Os } from './common/types.ts'

export type Setup = {
    readonly nodeExtra: (os: Os) => readonly MetaStep[],
}
