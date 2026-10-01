/**
 * Implementation-private types for the B-tree demo.
 *
 * @module
 */

import type { Tree } from './types/types.ts'

/** The tree before the last step, and after it. */
export type _Versions = {
    readonly before: Tree<number>
    readonly after: Tree<number>
}

/**
 * The demo's state: the key field as typed, the last two versions, the step
 * that turned one into the other (`insert 8`), and why the last press did
 * nothing, if it did nothing.
 */
export type _State = {
    readonly key: string
    readonly versions: _Versions
    readonly last: string
    readonly error: string | null
}
