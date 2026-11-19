/**
 * Implementation-private types for the metadata walk.
 *
 * @module
 */

import type { EdagValue } from '../types.ts'
import type { ValidationError } from '../../../rtti/common/types.ts'
import type { Result } from '../../../types/result/types.ts'
import type { PersistentSet } from '../../../types/set/types.ts'

export type _Node = Extract<EdagValue, readonly unknown[]>

/** Nodes whose evaluated object properties and descendants have already passed. */
export type _Visited = PersistentSet<_Node>

/** Recursive value check supplied to the container walkers. */
export type _Validate = (value: EdagValue, visited: _Visited) => Result<_Visited, ValidationError>
