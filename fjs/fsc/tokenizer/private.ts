/**
 * Implementation-private types for the DJS tokenizer: the state of its fold
 * over the JavaScript token stream.
 *
 * @module
 */

/** Whether the previous JS token was a bare `-` awaiting a number to negate. */
export type _DjsScanState = { readonly kind: 'def' | '-' }
