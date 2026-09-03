/**
 * Implementation-private types for the RTTI parser's container rebuilds.
 *
 * @module
 */

import type { Unknown } from '../ts/types.ts'

/**
 * The parsed `[key, parsedValue]` pairs as `consEntry` and `consDeclared` fold
 * them: a cons list in **reverse** member order, so its head is the last member
 * parsed — for the array kinds, the highest present index.
 */
export type _Entries =
    null | { readonly first: readonly [string, Unknown], readonly tail: _Entries }

/** Rebuilds a parsed container from its entries. */
export type _Rebuild = (entries: _Entries) => Unknown
