/** Worklist details for ordered graph demands. @module */

import type { Exp } from '../types.ts'

/** A null step stops before unowned work; a tuple visits one graph value. */
export type _Step = readonly [Exp] | null
export type _Work<T = _Step> = { readonly first: T; readonly tail: _Work<T> | null }
