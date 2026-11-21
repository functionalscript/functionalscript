/**
 * Body-copy bookkeeping: EDAG code contains only arrays and primitive leaves.
 *
 * @module
 */

import type { Primitive } from '../../types.ts'
import type { EdagValue } from '../types.ts'
import type { RefMap } from '../../../types/ref_map/types.ts'

export type _Part = Primitive | readonly _Part[]

/** Original array identities paired with their completed copies. */
export type _Copies = readonly (readonly [readonly _Part[], readonly _Part[]])[]

/** A value with its functions' bodies their own, threaded with the values already answered by identity. */
export type _Own = (seen: RefMap, value: EdagValue) => readonly [RefMap, EdagValue]
