/**
 * Types for the changelog pages.
 *
 * @module
 */

/**
 * One release as its page needs it: its version, and the releases either
 * side of it, so the page can link to them.
 *
 * `previous` is the release before this one and `next` the one after, in
 * version order — so `previous` is older and `next` is newer, which is what
 * a release's "previous" means. Each is `null` at its end of the list: the
 * oldest release has no previous, the newest no next.
 */
export type Release = {
    readonly version: string
    readonly previous: string | null
    readonly next: string | null
}
