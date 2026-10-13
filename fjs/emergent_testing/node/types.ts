/**
 * What the `quiet` filter reads of a `node --test` event: the structural
 * subset of Node's `TestEvent` it decides by. Node's own type stays out of
 * these declarations, because the shipped `types.d.ts` must resolve for a
 * consumer without `@types/node`; `private.ts` checks that Node's events are
 * these.
 *
 * @module
 */

/**
 * The thresholds `--test-coverage-lines`, `--test-coverage-branches` and
 * `--test-coverage-functions` set, as percentages; `0` where one is not set.
 */
export type Thresholds = {
    readonly line: number
    readonly branch: number
    readonly function: number
}

/** A file's row of the coverage report: the percentages a threshold is checked against. */
export type File = {
    readonly coveredLinePercent: number
    readonly coveredBranchPercent: number
    readonly coveredFunctionPercent: number
}

/** The coverage report, as the `test:coverage` event carries it. */
export type Coverage = {
    readonly type: 'test:coverage'
    readonly data: {
        readonly summary: {
            readonly files: readonly File[]
            readonly thresholds: Thresholds
        }
    }
}

/**
 * A test that did not fail: a pass, or a test skipped or left `todo`, which
 * the reason marks, or `true` where none was given.
 */
export type Pass = {
    readonly type: 'test:pass'
    readonly data: {
        readonly skip?: string | boolean
        readonly todo?: string | boolean
    }
}

/**
 * What `TestContext.log()` emits: the message, and the name of the test that
 * logged it. Node 26 emits the event; the pinned `@types/node` does not yet
 * declare it, so `private.ts` cannot check this shape against Node's.
 */
export type Log = {
    readonly type: 'test:log'
    readonly data: {
        readonly name: string
        readonly message: string
    }
}

/** Every other event Node emits; the filter reads nothing but its name. */
export type Other = {
    readonly type:
        | 'test:complete'
        | 'test:dequeue'
        | 'test:diagnostic'
        | 'test:enqueue'
        | 'test:fail'
        | 'test:interrupted'
        | 'test:plan'
        | 'test:start'
        | 'test:stderr'
        | 'test:stdout'
        | 'test:summary'
        | 'test:watch:drained'
        | 'test:watch:restarted'
}

export type Event = Coverage | Pass | Log | Other
