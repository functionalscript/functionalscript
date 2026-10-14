/**
 * The two tests a mapping makes on a tree of `./types.ts`. A position a
 * mapping reads is one of two things: not an array is a symbol, and its
 * `meta.id` says which alphabet; an array is a node the machine built from
 * the rule at that position, so its shape is the rule's by construction.
 * {@link unmapped} asserts the second where a mapping knows a position is
 * scaffolding nothing mapped, and {@link symbolAt} the first where it
 * expects a symbol. {@link items} and {@link variant} are {@link unmapped}
 * for a reader that walks a tree untyped; {@link variant} knows the position
 * is a variant's and asserts the `[tag, node]` shape the type would
 * otherwise have said.
 * `./README.md` holds the argument.
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
 * {@link unmapped} for a reader that walks a tree untyped, holding
 * `unknown`: the node as `readonly unknown[]`. A separate reader, so
 * {@link unmapped} keeps checking a typed caller's argument.
 *
 * @type {(node: unknown) => readonly unknown[]}
 */
export const items = node => {
    assert(node instanceof Array)
    return node
}

/**
 * The node of a variant at a position no mapping filled, read untyped: its
 * tag and the branch's node. The tree is the grammar's by construction, so
 * a shape that is not a variant's is a broken invariant, not bad input.
 *
 * @type {(node: unknown) => readonly [string, unknown]}
 */
export const variant = node => {
    assert(node instanceof Array && node.length === 2 && typeof node[0] === 'string')
    return [node[0], node[1]]
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
