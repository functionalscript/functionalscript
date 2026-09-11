/**
 * @import { Accept } from '../../../../fjs/media/datajs/vectors/types.ts'
 */

import { assert, assertEq } from '../../../../fjs/asserts/module.f.mjs'
import { bytes } from '../../../../fjs/media/datajs/vectors/module.f.mjs'
import accept from './data.f.mjs'

/** The set, typed at the import since a data module carries no annotations. */
const set = /** @type {readonly Accept[]} */ (accept)

const { hasOwn } = Object

/**
 * A metadata member as a non-empty string, or a failure naming the vector
 * and the member.
 *
 * @type {(vector: Accept, name: 'id' | 'class') => string}
 */
const named = (vector, name) => {
    const value = vector[name]
    assert(typeof value === 'string' && value !== '', `${JSON.stringify(vector.id)}: ${name} is not a non-empty string`)
    return value
}

// The shape of the set, which the reader's proof in
// `fjs/media/datajs/vectors/proof.f.mjs` relies on when it runs every
// document through the reader.
export const proof = {
    // Every vector names itself and its class with a non-empty string, checked
    // before the ids are counted: a missing id is not one of a kind, and a
    // missing class is not a name.
    named: () => { for (const vector of set) { named(vector, 'id'); named(vector, 'class') } },
    // Every id is one of a kind.
    unique: () => {
        const ids = set.map(vector => named(vector, 'id'))
        assertEq(new Set(ids).size, ids.length)
    },
    // Every vector carries its document as a string or as bytes in the one
    // hex spelling, and its graph as an own member, `undefined` included.
    records: () => {
        for (const vector of set) {
            const id = named(vector, 'id')
            const { document } = vector
            assert(typeof document === 'string' || (document[0] === 'hex' && bytes(document[1]) !== null), `${id}: the document is neither a string nor bytes in the one hex spelling`)
            assert(hasOwn(vector, 'graph'), `${id}: no graph`)
        }
    },
}
