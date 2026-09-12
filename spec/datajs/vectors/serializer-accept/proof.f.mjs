/**
 * @import { SerializerAccept } from '../../../../fjs/media/datajs/vectors/types.ts'
 */

import { assert, assertEq } from '../../../../fjs/asserts/module.f.mjs'
import serializerAccept from './data.f.mjs'

/** The set, typed at the import since a data module carries no annotations. */
const set = /** @type {readonly SerializerAccept[]} */ (serializerAccept)

const { hasOwn } = Object

/**
 * A metadata member as a non-empty string, or a failure naming the vector
 * and the member.
 *
 * @type {(vector: SerializerAccept, name: 'id' | 'class') => string}
 */
const named = (vector, name) => {
    const value = vector[name]
    assert(typeof value === 'string' && value !== '', `${JSON.stringify(vector.id)}: ${name} is not a non-empty string`)
    return value
}

// The shape of the set. What a serializer does with it arrives with stage 4,
// which reruns the set through the writer; until then this is what stands
// between the corpus and a record nobody can act on.
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
    // Every vector carries an input as an own member, `undefined` included —
    // which is a leaf of this data model and so a vector of its own, not an
    // absent member. There is no expected graph beside it: a serializer-side
    // input is a value of the data model, so its output must denote the input
    // itself.
    records: () => {
        for (const vector of set) {
            assert(hasOwn(vector, 'input'), `${named(vector, 'id')}: no input`)
        }
    },
}
