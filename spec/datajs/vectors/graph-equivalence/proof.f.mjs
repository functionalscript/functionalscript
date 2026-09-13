/**
 * @import { Unknown } from '../../../../fjs/media/datajs/types.ts'
 * @import { GraphEquivalence } from '../../../../fjs/media/datajs/vectors/types.ts'
 */

import { assert, assertEq } from '../../../../fjs/asserts/module.f.mjs'
import { difference } from '../../../../fjs/media/datajs/vectors/module.f.mjs'
import { parse } from '../../../../fjs/media/datajs/parser/module.f.mjs'
import { tryStringify } from '../../../../fjs/media/datajs/serializer/module.f.mjs'
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

// The set's shape, the claim each record makes against the reader, and what
// the writer emits for the same inputs. The reader half came first because a
// `denotesNot` that in fact denotes the input would fail a conforming
// serializer rather than a broken one; the writer half is the role this set
// exists for.
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
    // And the writer that exists, over the same inputs: every graph is
    // accepted, and the document that comes out denotes it — which for this
    // set means the sharing survives, since `difference` compares containers
    // as a bijection and so refuses both an expanded share and a merge of two
    // distinct nodes.
    //
    // The second check needs no reader and is the reason this set carries
    // `denotesNot` at all: those documents are the plausible wrong outputs
    // for these graphs, so a writer whose output is one of them is caught by
    // comparing the text, even against a reader broken in the same direction.
    // Measured, all sixteen outputs land among the `denotes` documents
    // instead — which is not asserted, because a serializer owes any valid
    // document denoting the graph and a spelling is `normalize`'s to pin.
    shipped: () => {
        for (const vector of set) {
            const id = named(vector, 'id')
            const [tag, out] = tryStringify(vector.input)
            assert(tag === 'ok', `${id}: the writer refused the input: ${String(out)}`)
            assert(!vector.denotesNot.includes(out),
                `${id}: the writer emitted ${JSON.stringify(out)}, which this vector rules out`)
            const d = difference(vector.input)(read(id, out))
            assert(d === null, `${id}: the writer emitted ${JSON.stringify(out)}, which denotes another graph: ${d}`)
        }
    },
    // The one shape this carrier cannot spell, pinned here instead. A shared
    // empty *object* is a vector above; a shared empty **array** needs
    // `const $e = [];`, which `tsc` types as an evolving `any[]` and refuses
    // every read of, so a data module cannot bind one. The direction matters
    // and is not the empty inverse above: that one rules out merging two
    // distinct empties, where this rules out expanding one shared empty into
    // two. A writer that always emits `[]` inline does exactly that, and
    // changes the graph's identity while emitting a valid document.
    sharedEmptyArray: () => {
        const child = /** @type {readonly unknown[]} */ ([])
        const input = /** @type {Unknown} */ (/** @type {unknown} */ ([child, child]))
        for (const document of ['const $0=[];export default [$0,$0];', 'const $0=[];const $1=[$0,$0];export default $1;']) {
            assertEq(difference(input)(read('shared-empty-array', document)), null)
        }
        for (const document of ['export default [[],[]];', 'const $0=[];const $1=[];export default [$0,$1];']) {
            assert(difference(input)(read('shared-empty-array', document)) !== null,
                `shared-empty-array: ${JSON.stringify(document)} denotes the input after all`)
        }
        // And the writer over the same shape, which is the half a vector would
        // have carried: what it emits denotes the shared graph, so it hoists
        // the empty array rather than inlining `[]` twice — the two documents
        // just ruled out are exactly what an inlining writer emits, so the
        // round trip pins the direction and no spelling has to be named here.
        // The one spelling is `normalize`'s to pin, and its proof does.
        const [tag, out] = tryStringify(input)
        assert(tag === 'ok', `shared-empty-array: the writer refused it: ${String(out)}`)
        assertEq(difference(input)(read('shared-empty-array', out)), null)
    },
}
