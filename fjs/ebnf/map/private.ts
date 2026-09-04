/**
 * Implementation-private types for the rewrite in `./module.f.mjs`.
 *
 * @module
 */

/** One rule's rewrite with its types erased: the walk is over `unknown`. */
export type _Rewrite = (ast: unknown) => unknown

/**
 * A mapping's function as the map holds it: what it takes is the one
 * mapping's own, so the erased form takes nothing a caller can supply.
 */
export type _Mapper = (children: never) => unknown
