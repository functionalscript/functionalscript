/**
 * Type-level API for `fjs/js/intrinsic/module.f.js`.
 *
 * @module
 */

/** `String.prototype.slice` as a function of its receiver. */
export type Slice = (s: string, start?: number, end?: number) => string

/** `String.prototype.charCodeAt` as a function of its receiver. */
export type CharCodeAt = (s: string, at: number) => number
