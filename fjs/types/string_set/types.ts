/**
 * Type-level API for the string-set module.
 *
 * @module
 */

import type { Tree } from '../btree/types/types.ts'

export type StringSet = Tree<string>
