/**
 * Types of the seeded random comparison. They live here, not in
 * `private.ts`, because [`module.mjs`](./module.mjs) names them in its
 * declaration, and that declaration ships in the package
 * ([`package.json` `files`](../../../../package.json) excludes
 * `private.d.ts`).
 *
 * @module
 */

/** A Mulberry32 generator: each call answers a float in `[0, 1)`. */
export type _Rnd = () => number

/**
 * What one comparison of a program answers: it ran, it was refused as the
 * slices state for a known reason, or it disagreed with JavaScript.
 */
export type _Outcome =
    | readonly ['ran', number]
    | readonly ['refused', string]
    | readonly ['wrong', string]
