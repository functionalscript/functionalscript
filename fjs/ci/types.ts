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
    /**
     * The platforms whose jobs run in the merge queue only, skipped on a pull
     * request's commits. A skipped job counts as passed for a required status
     * check, so it still gates the merge — once, in the queue, rather than on
     * every push. A project with no merge queue would never run them, so the
     * default is none.
     */
    readonly mergeQueueOnly?: readonly Os[],
}
