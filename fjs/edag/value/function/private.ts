/**
 * Body-copy bookkeeping: EDAG code contains only arrays and primitive leaves.
 *
 * @module
 */

import type { Primitive } from '../../types.ts'

export type _Part = Primitive | readonly _Part[]

/** Original array identities paired with their completed copies. */
export type _Copies = readonly (readonly [readonly _Part[], readonly _Part[]])[]
