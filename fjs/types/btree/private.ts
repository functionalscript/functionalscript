/**
 * Implementation-private types for the B-tree demo.
 *
 * @module
 */

import type { Tree } from './types/types.ts'

/**
 * The last two versions of the tree, and the word that turned the first into
 * the second — `null` before any word was read.
 */
export type _Versions = {
    readonly before: Tree<number>
    readonly after: Tree<number>
    readonly last: string | null
}
