/**
 * Implementation-private types for the metadata walk.
 *
 * @module
 */

import type { EdagValue } from '../types.ts'
import type { PersistentSet } from '../../../types/set/types.ts'

export type _Node = Extract<EdagValue, readonly unknown[]>

/** Nodes whose metadata and evaluated descendants have already passed. */
export type _Visited = PersistentSet<_Node>
