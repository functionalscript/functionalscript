/**
 * @import { Unknown } from '../../../../fjs/media/datajs/types.ts'
 * @import { SerializerAccept } from '../../../../fjs/media/datajs/vectors/types.ts'
 */

import { assert, assertEq } from '../../../../fjs/asserts/module.f.mjs'
import { difference } from '../../../../fjs/media/datajs/vectors/module.f.mjs'
import { parse } from '../../../../fjs/media/datajs/parser/module.f.mjs'
import { tryStringify } from '../../../../fjs/media/datajs/serializer/module.f.mjs'
import { stringToCodePointList } from '../../../../fjs/text/utf16/module.f.mjs'
import { toArray } from '../../../../fjs/types/list/module.f.mjs'
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

/**
 * Whether a string has a UTF-8 encoding, which a document must: every code
 * point of it is a real one. `stringToCodePointList` marks an unpaired
 * surrogate with a negative code point instead, and an unpaired surrogate is
 * the one thing a JavaScript string can hold that UTF-8 cannot spell — so a
 * writer emitting one raw has emitted something that is not a document, which
 * the round trip below cannot see: the reader takes code units and accepts it.
 *
 * @type {(text: string) => boolean}
 */
const utf8Encodable = text => toArray(stringToCodePointList(text)).every(c => c >= 0)

// The shape of the set, and its claim against the writer that exists. The
// claim is what this role owes and no more: the input is accepted, and the
// output is *a* valid document denoting it — never a particular spelling,
// which belongs to `normalize` alone.
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
    // And the claim itself, against the serializer that exists: every input
    // is accepted, and what comes out is a document the reader takes which
    // denotes the input, sharing included. The issue expected this to wait
    // for stage 4; stage 4 has landed, so the set tests the shipped writer
    // rather than describing one to come.
    //
    // The last check is the one the round trip cannot make. A document is
    // UTF-8, and an unpaired surrogate has no UTF-8 encoding — but the reader
    // takes code units, so it accepts a raw one and the round trip passes.
    // Review measured exactly that: with the writer's escaping made to emit raw
    // surrogates, every check above stayed green and only `normalize`, which
    // compares bytes, went red.
    //
    // The output is read back through this repository's reader, so a reader
    // and a writer wrong in compensating ways would agree. What keeps that
    // from being circular is that the reader is pinned elsewhere and not by
    // this: `fjs/media/datajs/vectors/proof.f.mjs` runs the whole accept set
    // against it, document by document, with graphs the writer has no part
    // in.
    shipped: () => {
        for (const vector of set) {
            const id = named(vector, 'id')
            const [tag, out] = tryStringify(vector.input)
            assert(tag === 'ok', `${id}: the writer refused the input: ${String(out)}`)
            const [readTag, graph] = parse(out)
            assert(readTag === 'ok', `${id}: the writer emitted ${JSON.stringify(out)}, which the reader refuses: ${String(graph)}`)
            const d = difference(vector.input)(/** @type {Unknown} */ (graph))
            assert(d === null, `${id}: the writer emitted ${JSON.stringify(out)}, which denotes another graph: ${d}`)
            assert(utf8Encodable(out), `${id}: the writer emitted ${JSON.stringify(out)}, which has no UTF-8 encoding`)
        }
    },
}
