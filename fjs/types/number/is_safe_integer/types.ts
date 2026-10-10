/**
 * Type proof for the safe-integer check.
 *
 * @module
 */

import type { Assert } from '../../../asserts/types.ts'
import type { Equal } from '../../ts/types.ts'
import type { isSafeInteger } from './module.f.js'

// Fractions and out-of-range numbers are rejected too. A type predicate for
// number would wrongly exclude those numbers from a caller's false branch.
type _SafeIntegerDoesNotNarrow = Assert<Equal<
    typeof isSafeInteger,
    (value: unknown) => boolean
>>
