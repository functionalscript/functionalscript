/**
 * The two tests a mapping makes on a tree of `./types.ts`. A position a
 * mapping reads is one of two things: not an array is a symbol, and its
 * `meta.id` says which alphabet; an array is a node the machine built from
 * the rule at that position, so its shape is the rule's by construction.
 * {@link unmapped} asserts the second where a mapping knows a position is
 * scaffolding nothing mapped, and {@link symbolAt} the first where it
 * expects a symbol. `./README.md` holds the argument.
 *
 * @module
 *
 * @import { Meta } from './types.ts'
 */

import { assert } from '../../asserts/module.f.mjs'

/**
 * The node at a position no mapping filled: an array the machine built, so
 * its shape is the rule's. The one test a mapping makes where it knows a
 * position is unmapped — the scaffolding a combinator builds and hands to
 * nobody.
 *
 * @type {<T extends readonly unknown[]>(node: T | Meta<unknown>) => T}
 */
export const unmapped = node => {
    assert(node instanceof Array)
    return node
}

/**
 * The symbol at a position a mapping filled, or an input leaf: not an
 * array, and its `meta.id` says which alphabet it is.
 *
 * @type {<M>(node: Meta<M> | readonly unknown[]) => Meta<M>}
 */
export const symbolAt = node => {
    assert(!(node instanceof Array))
    return node
}
