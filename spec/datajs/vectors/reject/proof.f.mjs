/**
 * @import { Reject } from '../../../../fjs/media/datajs/vectors/types.ts'
 */

import { assert, assertEq } from '../../../../fjs/asserts/module.f.mjs'
import { bytes } from '../../../../fjs/media/datajs/vectors/module.f.mjs'
import reject from './data.f.mjs'

/** The set, typed at the import since a data module carries no annotations. */
const set = /** @type {readonly Reject[]} */ (reject)

/**
 * A member as a non-empty string, or a failure naming the vector and the
 * member.
 *
 * @type {(vector: Reject, name: 'id' | 'class' | 'rule') => string}
 */
const named = (vector, name) => {
    const value = vector[name]
    assert(typeof value === 'string' && value !== '', `${JSON.stringify(vector.id)}: ${name} is not a non-empty string`)
    return value
}

/** What the host may do with a document, measured: the three values a record may carry. */
const hosts = ['accepts', 'syntaxError', 'runtimeError']

// The shape of the set, which the reader's proof in
// `fjs/media/datajs/vectors/proof.f.mjs` relies on when it runs every
// document through the reader.
export const proof = {
    // Every vector names itself, its class and the one rule it breaks with a
    // non-empty string, checked before the ids are counted.
    named: () => { for (const vector of set) { named(vector, 'id'); named(vector, 'class'); named(vector, 'rule') } },
    // Every id is one of a kind.
    unique: () => {
        const ids = set.map(vector => named(vector, 'id'))
        assertEq(new Set(ids).size, ids.length)
    },
    // Every vector carries its document as a string or as bytes in the one
    // hex spelling, and the host's measured verdict as one of the three.
    records: () => {
        for (const vector of set) {
            const id = named(vector, 'id')
            const { document } = vector
            assert(typeof document === 'string' || (document[0] === 'hex' && bytes(document[1]) !== null), `${id}: the document is neither a string nor bytes in the one hex spelling`)
            assert(hosts.includes(vector.host), `${id}: the host verdict is not one of the three`)
        }
    },
}
