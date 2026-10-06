/**
 * Identity bookkeeping for one runtime data conversion.
 *
 * @module
 */

import type { Array as ValueArray, Object as ValueObject } from '../types.ts'
import type { Result } from '../../../types/result/types.ts'
import type { Unknown } from '../../../media/datajs/types.ts'

/** Ordinary runtime containers; primitives need no identity bookkeeping. */
export type _Container = readonly Unknown[] | { readonly [key: string]: Unknown }

/** Represented container nodes paired with their completed runtime values. */
export type _Copies = readonly (readonly [ValueArray | ValueObject, _Container])[]

export type _Converted = Result<readonly [_Copies, Unknown], string>
