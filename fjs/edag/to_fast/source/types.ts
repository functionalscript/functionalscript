/**
 * Type-level API of source admission.
 *
 * @module
 */

import type { ExpOp } from '../../types.ts'

/**
 * Why a graph has no source spelling, and the node of the graph the refusal
 * is of, or `null` where it is of no one node.
 */
export type Refusal = readonly [reason: string, node: ExpOp | null]
