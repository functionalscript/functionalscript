/**
 * Type-level API for SUL identifiers.
 *
 * @module
 */

import type { Nominal } from '../../types/nominal/types.ts'

/** A 256-bit SUL identifier. One of three variants: level-3 literal, raw bit vector, or SHA2 hash. */
export type Id = Nominal<
    'sul/id',
    '6f5f6da053a6ac70e9687d42b7a09e925c3be21027f55beb2cba3040bf3d5b71',
    bigint>
