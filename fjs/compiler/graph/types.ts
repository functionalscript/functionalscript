/**
 * Type-level API for `fjs/compiler/graph/module.f.mjs`: the tags a graph's
 * operators spell their containers with.
 *
 * @module
 */

/**
 * The array and object tags of one operator vocabulary. The EDAG spells
 * them `'[]'` and `'{}'`, FAST `'array'` and `'object'`; every other
 * operator tuple is the same in both.
 */
export type Tags = {
    readonly array: string
    readonly object: string
}
