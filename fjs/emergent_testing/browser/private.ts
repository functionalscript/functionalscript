/**
 * Types for driving the browser runner's orchestration.
 *
 * A `private.ts` and not a `types.ts`: both are the *proofs'* vocabulary rather
 * than the module's — a mock runner needs a name for the operations it answers
 * and for the state it threads — and nothing a page imports reaches either.
 * They are here rather than inline because
 * [`../../AGENTS.md`](../../AGENTS.md) §3 keeps named types out of authored
 * `.mjs`, and out of `types.ts` because that file is the public declaration
 * closure: a consumer could import them, and a later change to how the proofs
 * drive a runner would read as a break in the package's API.
 *
 * @module
 */

import type { All, Catch, Import, Sandbox } from '../../effects/common/types.ts'
import type { _BrowserReport, _BrowserTestResult } from '../types.ts'

/**
 * Everything the orchestration asks of a runner: load a module, fan out, read
 * a user value, run a leaf, announce what happened. A page's interpreter is
 * exactly this — the shared operations plus its own `report`, and no operation
 * named after a browser.
 *
 * @internal
 */
export type _BrowserOp = All | Catch | Import | Sandbox | _BrowserReport

/**
 * A mock runner's state: the rows it was asked to report, in order.
 *
 * @internal
 */
export type _Rows = readonly _BrowserTestResult[]
