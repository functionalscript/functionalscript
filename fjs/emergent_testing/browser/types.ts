/**
 * Types for driving the browser runner's orchestration.
 *
 * Both are the *proofs'* vocabulary rather than the module's: a mock runner
 * needs a name for the operations it answers and for the state it threads, and
 * [`../../AGENTS.md`](../../AGENTS.md) §3 keeps named types out of authored
 * `.mjs`. Nothing here is part of what a page imports.
 *
 * @module
 */

import type { Catch, Sandbox } from '../../effects/common/types.ts'
import type { _BrowserReport, _BrowserTestResult } from '../types.ts'

/**
 * Everything the orchestration asks of a runner: read a user value, run a
 * leaf, announce a row. A page's interpreter is exactly this — the shared
 * operations plus its own `report`, and no operation named after a browser.
 *
 * @internal
 */
export type _BrowserOp = Catch | Sandbox | _BrowserReport

/**
 * A mock runner's state: the rows it was asked to report, in order.
 *
 * @internal
 */
export type _Rows = readonly _BrowserTestResult[]
