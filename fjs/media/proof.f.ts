import { assertEq } from '../asserts/module.f.mjs'
import type { Vec } from '../types/bit_vec/types.ts'
import { msb, u8ListToVec, repeat, vec8 } from '../types/bit_vec/module.f.mjs'
import { detect, dialectEntry } from './module.f.mjs'
import type { DialectEntry } from './types.ts'
import { dialect, revisionDialect } from './revision/module.f.mjs'
import { number, string } from '../types/rtti/module.f.mjs'

// All test strings here are ASCII, so char code === UTF-8 byte value.
const utf8Bytes = (s: string): Vec => u8ListToVec(msb)([...s].map(c => c.charCodeAt(0)))

const revisionJson = `{"dialect":"${dialect}","subject":"8","parents":[],"snapshot":"8","generation":0}`

const dialects: readonly DialectEntry[] = [revisionDialect]

const detectRevision = detect(dialects)

/**
 * A second dialect following the same `vnd.fjs.<name>` convention, registered
 * with no refinement: structure alone decides the match.
 */
const noteSchema = {
    dialect: 'vnd.fjs.note',
    text: string,
} as const

const noteDialect: DialectEntry = dialectEntry(noteSchema)

/** A dialect name outside `vnd.fjs.*` — registerable, and detected as itself. */
const gadgetSchema = {
    dialect: 'application.gadget',
    size: number,
} as const

const gadgetDialect: DialectEntry = dialectEntry(gadgetSchema)

/**
 * `DialectEntry` is deliberately not opaque, so overlapping entries — which a
 * self-discriminating schema can't produce on its own — can be stated directly.
 */
const anyEntry = (name: string): DialectEntry => ({ dialect: name, match: () => true })

export const proof = {
    // A valid revision blob is recognized and reported under its derived media type.
    validRevision: () => {
        const m = detectRevision(utf8Bytes(revisionJson))
        assertEq(m.type, 'text')
        assertEq(m.mime_type, 'application/vnd.fjs.revision+json')
    },

    // Key order carries no meaning: a valid revision whose `dialect` key is
    // not first must still be detected.
    keyOrderIndependent: () => {
        const text = `{"parents":[],"subject":"8","dialect":"${dialect}","snapshot":"8","generation":0}`
        const m = detectRevision(utf8Bytes(text))
        assertEq(m.mime_type, 'application/vnd.fjs.revision+json')
    },

    // A revision missing a required field (here `snapshot` and `generation`)
    // fails validation and falls through to the ordinary text/plain
    // classification.
    invalidRevisionFallsThrough: () => {
        const text = `{"dialect":"${dialect}","subject":"8","parents":["8","r"]}`
        const m = detectRevision(utf8Bytes(text))
        assertEq(m.type, 'text')
        assertEq(m.mime_type, 'text/plain')
    },

    // The `extraValidate` path: structurally a revision, but `snapshot` is not
    // a cbase32 hash, so `revisionDialect`'s refinement rejects it and the
    // verdict stays `text/plain` — exactly what `decodeText` would say.
    nonHashSnapshotFallsThrough: () => {
        const text = `{"dialect":"${dialect}","subject":"8","parents":[],"snapshot":"not a hash","generation":0}`
        const m = detectRevision(utf8Bytes(text))
        assertEq(m.type, 'text')
        assertEq(m.mime_type, 'text/plain')
    },

    // A second dialect, registered by the caller, is recognized alongside the
    // first — and an entry with no refinement matches on structure alone.
    secondDialect: () => {
        const d = detect([revisionDialect, noteDialect])
        assertEq(d(utf8Bytes('{"dialect":"vnd.fjs.note","text":"hi"}')).mime_type, 'application/vnd.fjs.note+json')
        assertEq(d(utf8Bytes(revisionJson)).mime_type, 'application/vnd.fjs.revision+json')
        // Same tag, wrong shape: no entry matches.
        assertEq(d(utf8Bytes('{"dialect":"vnd.fjs.note","text":42}')).mime_type, 'text/plain')
    },

    // The name is neither grammar-checked nor allowlisted: a dialect outside
    // `vnd.fjs.*` yields its own derived media type.
    nonVndDialectName: () => {
        const m = detect([gadgetDialect])(utf8Bytes('{"dialect":"application.gadget","size":3}'))
        assertEq(m.mime_type, 'application/application.gadget+json')
    },

    // Entries are tried in order and the first match wins.
    firstMatchWins: () => {
        const bytes = utf8Bytes('{}')
        assertEq(detect([anyEntry('vnd.fjs.a'), anyEntry('vnd.fjs.b')])(bytes).mime_type, 'application/vnd.fjs.a+json')
        assertEq(detect([anyEntry('vnd.fjs.b'), anyEntry('vnd.fjs.a')])(bytes).mime_type, 'application/vnd.fjs.b+json')
    },

    // An empty registry recognizes nothing; every blob keeps the
    // `fjs/media/type` verdict.
    noDialects: () => {
        const m = detect([])(utf8Bytes(revisionJson))
        assertEq(m.type, 'text')
        assertEq(m.mime_type, 'text/plain')
    },

    // Ordinary JSON with no `dialect` field at all falls through unchanged.
    ordinaryJsonFallsThrough: () => {
        const m = detectRevision(utf8Bytes('{"hello":"world"}'))
        assertEq(m.type, 'text')
        assertEq(m.mime_type, 'text/plain')
    },

    // Plain (non-JSON) text is unaffected: the parse fails and the
    // `fjs/media/type` verdict stands.
    plainTextFallsThrough: () => {
        const m = detectRevision(utf8Bytes('hello'))
        assertEq(m.type, 'text')
        assertEq(m.mime_type, 'text/plain')
    },

    // Binary content (magic-byte hit) is unaffected by dialect detection.
    binaryFallsThrough: () => {
        const m = detectRevision(u8ListToVec(msb)([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        assertEq(m.type, 'base64')
        assertEq(m.mime_type, 'image/png')
    },

    // A large blob is still bounded by the single-`Vec` `maxLength` cap; this
    // only exercises that dialect detection doesn't change size handling for
    // non-JSON content within that bound.
    largeNonJsonWithinBound: () => {
        const a = repeat(1_000n)(vec8(0x61n)) // 1,000 bytes of 'a'
        const m = detectRevision(a)
        assertEq(m.type, 'text')
        assertEq(m.mime_type, 'text/plain')
    },

    throw: {
        // The `dialect` member must be a direct string const. A thunk-form one
        // is a valid rtti schema but is not registerable, and `dialectEntry`
        // says so at registration rather than per blob.
        thunkDialectMember: () => dialectEntry({ dialect: string }),

        // A schema with no `dialect` member at all is likewise refused.
        noDialectMember: () => dialectEntry({ text: string }),
    },
}
