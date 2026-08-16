import { assert, assertEq } from '../../asserts/module.f.mjs'
import { dialect, mediaType, decodeText, encodeText, noteDialect, validate } from './module.f.mjs'
import { dialect as lockDialect } from '../lock/module.f.mjs'

export const proof = {
    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.note')
        assertEq(mediaType, 'application/vnd.fjs.note+json')
    },

    validate: {
        // The ordinary case: the tag and the text.
        minimalNoteAccepted: () => {
            const r = validate({ dialect, text: 'buy milk' })
            assert(r[0] === 'ok', ['expected ok', r])
            assertEq(r[1].text, 'buy milk')
        },

        // `text` may be empty — required rather than optional, so an absent
        // text and an empty one are not two spellings of one blob.
        emptyTextAccepted: () => {
            const [t] = validate({ dialect, text: '' })
            assertEq(t, 'ok')
        },

        // `text` is required: a blob carrying only the tag is not a note.
        missingTextRejected: () => {
            const [t] = validate({ dialect })
            assertEq(t, 'error')
        },

        // The text is a string, nothing else.
        nonStringTextRejected: () => {
            const [t] = validate({ dialect, text: 42 })
            assertEq(t, 'error')
        },

        // Dependencies are subject identity strings, unconstrained like
        // `vnd.fjs.revision`'s `subject` — no semantic check applies.
        dependenciesAccepted: () => {
            const r = validate({ dialect, text: 'ship it', dependencies: ['write the spec', 'review'] })
            assert(r[0] === 'ok', ['expected ok', r])
            assertEq(r[1].dependencies?.length, 2)
        },

        // `[]` and an absent field both say "depends on nothing"; the format
        // does not distinguish them, and both validate.
        emptyDependenciesAccepted: () => {
            const [t] = validate({ dialect, text: 'hi', dependencies: [] })
            assertEq(t, 'ok')
        },

        // The field is a list of strings, nothing else.
        nonArrayDependenciesRejected: () => {
            const [t] = validate({ dialect, text: 'hi', dependencies: 'write the spec' })
            assertEq(t, 'error')
        },
        nonStringDependencyRejected: () => {
            const [t] = validate({ dialect, text: 'hi', dependencies: [42] })
            assertEq(t, 'error')
        },

        // rtti structs are open, so unknown fields are ignored rather than
        // rejected — the additive forward-compatibility path every future
        // extension (title, tags, dates, …) relies on.
        unknownFieldsIgnored: () => {
            const [t] = validate({ dialect, text: 'call Bob', title: 'todo', done: true })
            assertEq(t, 'ok')
        },

        // Another dialect's blob is not a note: the tag is matched as an
        // exact literal.
        otherDialectRejected: () => {
            const [t] = validate({ dialect: lockDialect, text: 'hi' })
            assertEq(t, 'error')
        },
    },

    decodeText: {
        validJson: () => {
            const r = decodeText(`{"dialect":"${dialect}","text":"buy milk"}`)
            assert(r[0] === 'ok', ['expected ok', r])
            assertEq(r[1].text, 'buy milk')
        },

        // Key order carries no meaning: the JSON is parsed and the parsed
        // value validated, so `dialect` need not come first.
        keyOrderIndependent: () => {
            const [t] = decodeText(`{"text":"hi","dialect":"${dialect}"}`)
            assertEq(t, 'ok')
        },

        malformedJsonRejected: () => {
            const [t] = decodeText('{not json')
            assertEq(t, 'error')
        },

        ordinaryJsonRejected: () => {
            const [t] = decodeText('{"hello":"world"}')
            assertEq(t, 'error')
        },
    },

    encodeText: {
        // Two blobs differing only in property order converge on one byte
        // sequence, so they address the same CAS blob. `dependencies` sorts
        // ahead of `dialect`, and its array order is preserved — arrays retain
        // their declared order under canonical serialization.
        sortsPropertiesLexicographically: () => {
            const decoded = decodeText(`{"text":"hi","dependencies":["b","a"],"dialect":"${dialect}"}`)
            assert(decoded[0] === 'ok', ['expected ok', decoded])
            assertEq(encodeText(decoded[1]), `{"dependencies":["b","a"],"dialect":"${dialect}","text":"hi"}`)
        },
    },

    // The registry entry carries the schema's own tag; matching is exercised
    // end to end through `detect` in `fjs/media/proof.f.mjs`.
    noteDialectTag: () => {
        assertEq(noteDialect.dialect, dialect)
    },
}
