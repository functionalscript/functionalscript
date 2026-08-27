/**
 * Types for the browser proof application.
 *
 * @module
 */

import type { CommonOp, Module } from '../../effects/common/types.ts'
import type { Effect } from '../../effects/types.ts'
import type { IoResult } from '../../effects/common/types.ts'
import type { ReportOp, TestResult } from '../types.ts'

/**
 * The operations the browser application performs: the host-independent set
 * every runner implements, plus the two that record normalized results.
 *
 * There is nothing browser-specific in it, and that is the design rather than
 * an accident — the DOM is the *adapter's* business
 * ([`./module.mjs`](./module.mjs)), never the application's. A page, a proof
 * with a stand-in interpreter, and a future headless controller therefore run
 * the very same program.
 */
export type BrowserOp = CommonOp | ReportOp

/**
 * How a whole run ended. `infrastructure-error` is not a third kind of test
 * failure: it says the suite never got to run — a module that would not link, a
 * runner missing an operation — which an automated consumer must not read as
 * "the proofs failed".
 */
export type ReportStatus = 'passed' | 'failed' | 'infrastructure-error'

/**
 * The serializable answer of a run, independent of the runner that produced it
 * and of the page that rendered it.
 */
export type BrowserTestReport = {
    readonly status: ReportStatus
    readonly browser: string
    readonly totals: {
        readonly tests: number
        readonly passed: number
        readonly failed: number
    }
    readonly duration: number
    readonly results: readonly TestResult[]
}

/**
 * What the host supplies to a run: the proof modules to link, and the name to
 * record the realm under.
 *
 * `browser` is data rather than a `navigator` read, for the reason every other
 * capability here is an operation — the application must be runnable outside a
 * browser, and a proof that had to install a global `navigator` to check a
 * report would be testing the stub.
 */
export type BrowserOptions = {
    readonly browser: string
    readonly sources: readonly string[]
}

/**
 * A run: options in, a report out.
 *
 * **The error channel is `never`**, and it is earned rather than asserted: a
 * module that will not link and an operation the runner lacks are both
 * *reported*, as an `infrastructure-error` report. A page waiting on the run
 * has nowhere to put a failure — leaving it in `running` with no report and no
 * completion event is the one outcome an automated controller cannot act on.
 */
export type BrowserProgram = (options: BrowserOptions) => Effect<BrowserOp, BrowserTestReport, never>

/** @internal One source paired with what linking it answered. */
export type _Loaded = readonly[string, IoResult<Module>]
