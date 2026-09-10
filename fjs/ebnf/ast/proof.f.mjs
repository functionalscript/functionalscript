/**
 * @import { Assert } from '../../asserts/types.ts'
 * @import { Equal } from '../../types/ts/types.ts'
 * @import { Ast, Meta } from './types.ts'
 */

import { assertEq } from '../../asserts/module.f.mjs'
import { symbolAt, unmapped } from './module.f.mjs'

/** @type {Meta<{ readonly id: 'i' }, 42>} */
const leaf = { symbol: 42, meta: { id: 'i' } }

/** @type {Meta<{ readonly id: 'o' }>} */
const mapped = { symbol: 0, meta: { id: 'o' } }

export const proof = {
    // An array is a node the machine built, whatever it holds — empty, a
    // tuple of leaves, a mapped symbol among them.
    unmapped: () => {
        /** @type {readonly [] | Meta<unknown>} */
        const empty = []
        assertEq(unmapped(empty), empty)
        /** @type {readonly [Meta<{ readonly id: 'i' }>, Meta<{ readonly id: 'o' }>] | Meta<unknown>} */
        const tuple = [leaf, mapped]
        assertEq(unmapped(tuple), tuple)
    },
    // A symbol is what is not an array: an input leaf or a mapping's
    // result, and the type is the one the position admits.
    symbolAt: () => {
        /** @typedef {Ast<readonly [42], { readonly id: 'i' }, { readonly id: 'o' }>} _Position */
        /** @typedef {Assert<Equal<ReturnType<typeof symbolAt<{ readonly id: 'o' }>>, Meta<{ readonly id: 'o' }>>>} _Typed */
        /** @type {_Position} */
        const node = mapped
        assertEq(symbolAt(node), mapped)
        /** @type {Meta<{ readonly id: 'i' }, 42> | readonly unknown[]} */
        const input = leaf
        assertEq(symbolAt(input).symbol, 42)
    },
    // Each test is the other's failure: a symbol where a node is expected,
    // a node where a symbol is, and either is a broken invariant.
    throw: {
        unmappedRejectsSymbol: () => unmapped(leaf),
        symbolAtRejectsNode: () => symbolAt([leaf]),
    },
}
