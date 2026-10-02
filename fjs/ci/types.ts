/**
 * Types for the CI workflow generator.
 *
 * @module
 */

import type { MetaStep, Os } from './common/types.ts'

/**
 * What the packed-package check asks of the tarball as a clean consumer: a
 * published module and a runtime export it must load; its `types.ts` spelled
 * as a consumer spells it, `types.js`; a declared type, a value of that type,
 * and one that is not — the negative control, which must fail to type-check.
 * Every path is relative to the package root, as a consumer's specifier is.
 */
export type PackageConsumer = {
    readonly module: string
    readonly value: string
    readonly types: string
    readonly type: string
    readonly accepted: string
    readonly refused: string
}

export type Setup = {
    readonly nodeExtra: (os: Os) => readonly MetaStep[],
    /**
     * The consumer half of the packed-package check, when the project has a
     * module to offer it; without one the check reads the shipped
     * declarations alone, since the generator cannot know what another
     * package publishes.
     */
    readonly packageConsumer?: PackageConsumer,
}
