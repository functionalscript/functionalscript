/**
 * @import { Unknown } from '../../../../fjs/media/datajs/types.ts'
 * @import { Normalize } from '../../../../fjs/media/datajs/vectors/types.ts'
 */

import { assert, assertEq } from '../../../../fjs/asserts/module.f.mjs'
import { difference } from '../../../../fjs/media/datajs/vectors/module.f.mjs'
import { parse } from '../../../../fjs/media/datajs/parser/module.f.mjs'
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
    return k.length === 1 && o[k[0]] === 0
        ? `export default {${JSON.stringify(k[0])}:0};`
        : null
}

// The set's shape, and what can be checked of its claim before stage 4's
// normalized serializer exists to make it. Two halves: the text is a
// document denoting the input, which the reader answers, and the text spells
// its strings the one way the rule admits, which the reader cannot.
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
}
