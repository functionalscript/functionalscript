/**
 * Operations more than one host implements. See [`./types.ts`](./types.ts) for
 * why they are not in `../node`.
 *
 * @module
 *
 * @import { Func } from '../types.ts'
 * @import { Catch, Sandbox, SandboxResult } from './types.ts'
 */

import { do_ } from '../module.f.mjs'

/**
 * Runs `f` in a sandbox, answering what it returned or threw together with how
 * long it took — a {@link SandboxResult}.
 *
 * The measurement is the operation's, not the caller's: a caller that read a
 * clock either side would time the dispatch as well as the call, and every host
 * would time it differently. The handler brackets the function call with
 * nothing in between.
 *
 * Future parameters (time limit, memory limit) can be added to the payload
 * without breaking the API. Worker-based implementations can enforce hard
 * limits via worker termination.
 *
 * @type {Func<Sandbox>}
 */
export const sandbox = do_('sandbox')

/**
 * Runs a pure thunk, answering `ok(v)` for what it returned and `error(e)` for
 * what it threw. See {@link Catch} for why this is not `sandbox`.
 *
 * @type {Func<Catch>}
 */
export const catch_ = do_('catch')
