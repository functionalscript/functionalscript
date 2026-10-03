/**
 * Types private to the versions demo's proof: the smallest persistent
 * structure that shares, a sorted list whose insert and remove copy the
 * cells before the change and share the rest.
 *
 * @module
 */

export type _Cell = {
    readonly key: number
    readonly next: _List
}

export type _List = _Cell | null
