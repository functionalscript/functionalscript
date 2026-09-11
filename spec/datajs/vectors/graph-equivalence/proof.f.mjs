/**
 * @import { Unknown } from '../../../../fjs/media/datajs/types.ts'
 * @import { GraphEquivalence } from '../../../../fjs/media/datajs/vectors/types.ts'
 */

import { assert, assertEq } from '../../../../fjs/asserts/module.f.mjs'
import { difference } from '../../../../fjs/media/datajs/vectors/module.f.mjs'
import { parse } from '../../../../fjs/media/datajs/parser/module.f.mjs'
import graphEquivalence from './data.f.mjs'

/** The set, typed at the import since a data module carries no annotations. */
const set = /** @type {readonly GraphEquivalence[]} */ (graphEquivalence)

const { hasOwn } = Object

/**
 * A metadata member as a non-empty string, or a failure naming the vector
 * and the member.
 *
 * @type {(vector: GraphEquivalence, name: 'id' | 'class') => string}
 */
const named = (vector, name) => {
    const value = vector[name]
    assert(typeof value === 'string' && value !== '', `${JSON.stringify(vector.id)}: ${name} is not a non-empty string`)
    return value
}

/** The graph a document denotes, or a failure naming the vector and the document. @type {(id: string, document: string) => Unknown} */
const read = (id, document) => {
    const [tag, result] = parse(document)
    assert(tag === 'ok', `${id}: ${JSON.stringify(document)} is not a document the reader takes: ${String(result)}`)
    return /** @type {Unknown} */ (result)
}

// The set's shape, and the claim each record makes, checked against the
// reader that exists. What a *serializer* emits for these inputs arrives
// with stage 4; this half is what makes the set meaningful before then,
// since a `denotesNot` that in fact denotes the input would fail a
// conforming serializer rather than a broken one.
export const proof = {
    // Every vector names itself and its class with a non-empty string.
    named: () => { for (const vector of set) { named(vector, 'id'); named(vector, 'class') } },
    // Every id is one of a kind.
    unique: () => {
        const ids = set.map(vector => named(vector, 'id'))
        assertEq(new Set(ids).size, ids.length)
    },
    // Every vector carries an input and both lists, and says something in
    // each direction: a record with an empty list makes half a claim.
    records: () => {
        for (const vector of set) {
            const id = named(vector, 'id')
            assert(hasOwn(vector, 'input'), `${id}: no input`)
            assert(vector.denotes.length !== 0, `${id}: denotes nothing`)
            assert(vector.denotesNot.length !== 0, `${id}: rules nothing out`)
        }
    },
    // Every `denotes` document reads to the input graph, sharing included.
    // The documents differ in layout, const naming and hoisting on purpose:
    // what a serializer may choose is exactly what these must agree on.
    denotes: () => {
        for (const vector of set) {
            const id = named(vector, 'id')
            for (const document of vector.denotes) {
                const d = difference(vector.input)(read(id, document))
                assert(d === null, `${id}: ${JSON.stringify(document)} does not denote the input: ${d}`)
            }
        }
    },
    // Every `denotesNot` document is a *valid* document that reads to some
    // other graph. Valid is the point: an invalid one is the reader reject
    // set's business, and would rule out nothing a serializer could emit.
    denotesNot: () => {
        for (const vector of set) {
            const id = named(vector, 'id')
            for (const document of vector.denotesNot) {
                assert(difference(vector.input)(read(id, document)) !== null,
                    `${id}: ${JSON.stringify(document)} denotes the input after all`)
            }
        }
    },
}
