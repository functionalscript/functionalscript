/**
 * Types for the B-tree demo (`./demo.f.mjs`). Its exports name them, so they
 * are part of its declarations rather than private.
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
 * What the drawings show: a preset as it was loaded — its name, and the hint
 * saying which button to press — or the step that turned *Before* into
 * *After* (`insert 8`).
 */
export type _Status =
    | { readonly preset: string, readonly hint: string }
    | { readonly last: string }

/**
 * The demo's state: the key field as typed, the last two versions, what
 * they show, and why the last press did nothing, if it did nothing.
 */
export type _State = {
    readonly key: string
    readonly versions: _Versions
    readonly status: _Status
    readonly error: string | null
}
