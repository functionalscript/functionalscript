/**
 * @import { Unknown } from '../../../../fjs/media/datajs/types.ts'
 * @import { Normalize } from '../../../../fjs/media/datajs/vectors/types.ts'
 */

import { assert, assertEq } from '../../../../fjs/asserts/module.f.mjs'
import { difference } from '../../../../fjs/media/datajs/vectors/module.f.mjs'
import { parse } from '../../../../fjs/media/datajs/parser/module.f.mjs'
import { tryStringify } from '../../../../fjs/media/datajs/serializer/module.f.mjs'
import normalize from './data.f.mjs'

/** The set, typed at the import since a data module carries no annotations. */
const set = /** @type {readonly Normalize[]} */ (normalize)

const { hasOwn, keys } = Object

/**
 * A metadata member as a non-empty string, or a failure naming the vector
 * and the member.
 *
 * @type {(vector: Normalize, name: 'id' | 'class') => string}
 */
const named = (vector, name) => {
    const value = vector[name]
    assert(typeof value === 'string' && value !== '', `${JSON.stringify(vector.id)}: ${name} is not a non-empty string`)
    return value
}

/**
 * The one spelling `QuoteJSONString` gives a string, for the vectors whose
 * whole document is one — `null` for every other shape.
 *
 * This exists because the round trip below **cannot see the difference this
 * role is about**. A document holding a raw U+D800 and one holding the six
 * characters of its escape denote the same string, so the reader accepts
 * both and `difference` finds nothing between them; measured, that is true
 * of most of the escaping vectors. Normalized form chooses exactly one of
 * the two, and only comparing the text against the escaping rule sees which.
 * The nine control escapes are the exception that proves it: a raw control
 * is refused outright, and transcribing one in place of its escape is how
 * eighteen of these texts arrived wrong.
 *
 * @type {(input: Unknown) => string | null}
 */
const spelling = input => {
    if (typeof input === 'string') { return `export default ${JSON.stringify(input)};` }
    if (typeof input !== 'object' || input === null || Array.isArray(input)) { return null }
    const o = /** @type {{ readonly [k in string]?: Unknown }} */ (input)
    const k = keys(o)
    // `__proto__` is a key with a production of its own, `["__proto__"]`, which
    // `JSON.stringify` knows nothing about. Review found this before a vector
    // did: the check would demand a spelling the reader refuses and go red for
    // the wrong reason, so the one key the rule spells differently opts out.
    return k.length === 1 && k[0] !== '__proto__' && o[k[0]] === 0
        ? `export default {${JSON.stringify(k[0])}:0};`
        : null
}

// The set's shape and three checks of its claim, each seeing what the others
// cannot: the text is a document denoting the input, which the reader
// answers; the text spells its strings the one way the rule admits, which
// the reader cannot, since an escape and a raw character denote one string;
// and the shipped normalized serializer emits it, byte for byte.
export const proof = {
    // Every vector names itself and its class with a non-empty string.
    named: () => { for (const vector of set) { named(vector, 'id'); named(vector, 'class') } },
    // Every id is one of a kind.
    unique: () => {
        const ids = set.map(vector => named(vector, 'id'))
        assertEq(new Set(ids).size, ids.length)
    },
    // Every vector carries an input as an own member, `undefined` included,
    // and a text that says something.
    records: () => {
        for (const vector of set) {
            const id = named(vector, 'id')
            assert(hasOwn(vector, 'input'), `${id}: no input`)
            assert(typeof vector.text === 'string' && vector.text !== '', `${id}: the text is not a non-empty string`)
        }
    },
    // Every text is a document the reader takes, denoting the input graph —
    // the run-through-the-accept-grammar check the issue asks for, made a
    // proof. Normalized output is a valid document by definition, so a text
    // the reader refuses is wrong however plausible it looks.
    denotes: () => {
        for (const vector of set) {
            const id = named(vector, 'id')
            const [tag, result] = parse(vector.text)
            assert(tag === 'ok', `${id}: the text is not a document the reader takes: ${String(result)}`)
            const d = difference(vector.input)(/** @type {Unknown} */ (result))
            assert(d === null, `${id}: the text does not denote the input: ${d}`)
        }
    },
    // Every text whose document is one string spells it the one way the
    // escaping rule admits. See `spelling` for why the check above cannot.
    escaping: () => {
        for (const vector of set) {
            const want = spelling(vector.input)
            if (want === null) { continue }
            assertEq(vector.text, want, named(vector, 'id'))
        }
    },
    // And the claim itself, against the normalizer that exists: every input
    // stringifies to exactly the text the vector pins. The issue expected
    // this to wait for stage 4; stage 4 has landed, so the set is a test of
    // the shipped writer rather than a record waiting for one.
    shipped: () => {
        for (const vector of set) {
            const id = named(vector, 'id')
            const [tag, out] = tryStringify(vector.input)
            assert(tag === 'ok', `${id}: the writer refused the input: ${String(out)}`)
            assertEq(out, vector.text, id)
        }
    },
    // The one input this carrier cannot spell. A shared node needs a `const`
    // to be shared by, and `const $e = [];` in a data module is an evolving
    // `any[]` that `tsc` refuses every read of — so the corpus can put an
    // empty array at a root or inline, and never at both ends of a
    // reference. The value is ordinary all the same, and the boundary is
    // real: a normalizer that hoists it wrongly, or names it out of
    // post-order, is wrong about a graph a caller can build. A proof may
    // carry an annotation where a data module may not, so it is pinned here.
    sharedEmptyArray: () => {
        const child = /** @type {readonly unknown[]} */ ([])
        const parent = [child]
        const [tag, out] = tryStringify([parent, parent, child])
        assert(tag === 'ok', `the writer refused a shared empty array: ${String(out)}`)
        assertEq(out, 'const $0=[];const $1=[$0];export default [$1,$1,$0];')
    },
}
