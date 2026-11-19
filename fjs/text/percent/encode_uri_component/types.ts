/**
 * The shared URI-component encoder's public type.
 *
 * @module
 */

/** JavaScript's String conversion, UTF-8 percent encoding and surrogate failure. */
export type EncodeUriComponent = (value?: unknown) => string
