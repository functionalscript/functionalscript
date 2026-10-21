/**
 * The browser operations' declarations; [`./types.ts`](./types.ts) says what
 * each does, and [`./module.mjs`](./module.mjs) is the page's handlers.
 *
 * @module
 *
 * @import { Func } from '../types.ts'
 * @import { FetchText, Instantiate } from './types.ts'
 */

import { do_ } from '../module.f.mjs'

/** @type {Func<FetchText>} */
export const fetchText = do_('fetchText')

/** @type {Func<Instantiate>} */
export const instantiate = do_('instantiate')
