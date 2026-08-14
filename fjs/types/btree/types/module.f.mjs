/**
 * Node helpers shared by the persistent B-tree modules. The node types
 * themselves live in `./types.ts`.
 *
 * @module
 *
 * @import { Branch1, Branch3, Branch5, TNode } from './types.ts'
 */

/**
 * Demotes a single-child branch root to its only child.
 *
 * After an insert or remove the root may temporarily hold exactly one child
 * (a `Branch1`). In that case the tree is one level taller than necessary;
 * returning the child directly restores the correct height. If the root has
 * more than one child it is returned unchanged.
 *
 * @type {<T>(b: Branch1<T> | Branch3<T> | Branch5<T>) => TNode<T>}
 */
export const collapseRoot = b => b.length === 1 ? b[0] : b
