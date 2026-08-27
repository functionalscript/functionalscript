/**
 * @import { Vec } from '../types/bit_vec/types.ts'
 * @import { DialectEntry } from './types.ts'
 */
import { assertEq } from '../asserts/module.f.mjs'
import { msb, u8ListToVec, repeat, vec8 } from '../types/bit_vec/module.f.mjs'
import { detect, dialectEntry } from './module.f.mjs'
import { dialect, revisionDialect } from './revision/module.f.mjs'
import { dialect as lockDialectName, lockDialect } from './lock/module.f.mjs'
import { dialect as noteDialectName, noteDialect } from './note/module.f.mjs'
import { number, open, string } from '../rtti/module.f.mjs'

// All test strings here are ASCII, so char code === UTF-8 byte value.
/** @type {(s: string) => Vec} */
const utf8Bytes = s => u8ListToVec(msb)([...s].map(c => c.charCodeAt(0)))

const revisionJson = `{"dialect":"${dialect}","subject":"8","parents":[],"snapshot":"8","generation":0}`

/** The three dialects `fjs/media` itself ships, in the order `fjs/mcp` registers them.
 * @type {readonly DialectEntry[]}
 */
const dialects = [revisionDialect, lockDialect, noteDialect]

const detectRevision = detect(dialects)

/** A dialect name outside `vnd.fjs.*` — registerable, and detected as itself. */
const gadgetSchema = open(/** @type {const} */ ({
    dialect: 'application.gadget',
    size: number,
}))

/** @type {DialectEntry} */
const gadgetDialect = dialectEntry(gadgetSchema)

/**
 * `DialectEntry` is deliberately not opaque, so overlapping entries — which a
 * self-discriminating schema can't produce on its own — can be stated directly.
 * @type {(name: string) => DialectEntry}
 */
const anyEntry = name => ({ dialect: name, match: () => true })

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

    // A valid shared-lock blob is recognized as its own dialect, alongside the
    // revision one, and reported under the derived media type.
    validLock: () => {
        const m = detectRevision(utf8Bytes(`{"dialect":"${lockDialectName}","lock":{"dependency":"8"}}`))
        assertEq(m.type, 'text')
        assertEq(m.mime_type, 'application/vnd.fjs.lock+json')
    },

    // The two dialects never claim each other's blobs: each schema matches its
    // own `dialect` literal, so a revision carrying an inline `lock` is still a
    // revision, and a lock blob is never a revision.
    lockAndRevisionDoNotOverlap: () => {
        const withLock = `{"dialect":"${dialect}","subject":"8","parents":[],"snapshot":"8","generation":0,"lock":{"d":"8"}}`
        assertEq(detectRevision(utf8Bytes(withLock)).mime_type, 'application/vnd.fjs.revision+json')
        assertEq(detectRevision(utf8Bytes(revisionJson)).mime_type, 'application/vnd.fjs.revision+json')
    },

    // `lockDialect` carries the semantic check too: a structurally valid lock
    // blob whose binding is not a cbase32 hash is not detected as one, exactly
    // as its `decodeText` would say.
    nonHashLockValueFallsThrough: () => {
        const text = `{"dialect":"${lockDialectName}","lock":{"dependency":"not a hash"}}`
        const m = detectRevision(utf8Bytes(text))
        assertEq(m.type, 'text')
        assertEq(m.mime_type, 'text/plain')
    },

    // The note dialect is registered with no refinement, so structure alone
    // decides the match — a valid note is recognized alongside its siblings.
    validNote: () => {
        const m = detectRevision(utf8Bytes(`{"dialect":"${noteDialectName}","text":"hi"}`))
        assertEq(m.type, 'text')
        assertEq(m.mime_type, 'application/vnd.fjs.note+json')
        // Same tag, wrong shape: no entry matches.
        assertEq(detectRevision(utf8Bytes(`{"dialect":"${noteDialectName}","text":42}`)).mime_type, 'text/plain')
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
        thunkDialectMember: () => dialectEntry(open({ dialect: string })),

        // A schema with no `dialect` member at all is likewise refused.
        noDialectMember: () => dialectEntry(open({ text: string })),
    },
}
