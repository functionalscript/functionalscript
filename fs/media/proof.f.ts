import { assertEq } from '../asserts/module.f.ts'
import { msb, u8ListToVec, repeat, vec8, type Vec } from '../types/bit_vec/module.f.ts'
import { detect } from './module.f.ts'
import { dialect } from './revision/module.f.ts'

// All test strings here are ASCII, so char code === UTF-8 byte value.
const utf8Bytes = (s: string): Vec => u8ListToVec(msb)([...s].map(c => c.charCodeAt(0)))

const revisionJson = `{"dialect":"${dialect}","subject":"8","parents":[]}`

export const proof = {
    // A valid revision blob is recognized and reported under its derived media type.
    validRevision: () => {
        const m = detect(utf8Bytes(revisionJson))
        assertEq(m.type, 'text')
        assertEq(m.mime_type, 'application/vnd.fjs.revision+json')
    },

    // Key order carries no meaning: a valid revision whose `dialect` key is
    // not first must still be detected.
    keyOrderIndependent: () => {
        const text = `{"parents":[],"subject":"8","dialect":"${dialect}"}`
        const m = detect(utf8Bytes(text))
        assertEq(m.mime_type, 'application/vnd.fjs.revision+json')
    },

    // Structurally invalid revision (bad multi-parent snapshot rule) falls
    // through to the ordinary text/plain classification.
    invalidRevisionFallsThrough: () => {
        const text = `{"dialect":"${dialect}","subject":"8","parents":["8","r"]}`
        const m = detect(utf8Bytes(text))
        assertEq(m.type, 'text')
        assertEq(m.mime_type, 'text/plain')
    },

    // Ordinary JSON with no `dialect` field at all falls through unchanged.
    ordinaryJsonFallsThrough: () => {
        const m = detect(utf8Bytes('{"hello":"world"}'))
        assertEq(m.type, 'text')
        assertEq(m.mime_type, 'text/plain')
    },

    // Plain (non-JSON) text is unaffected.
    plainTextFallsThrough: () => {
        const m = detect(utf8Bytes('hello'))
        assertEq(m.type, 'text')
        assertEq(m.mime_type, 'text/plain')
    },

    // Binary content (magic-byte hit) is unaffected by dialect detection.
    binaryFallsThrough: () => {
        const m = detect(u8ListToVec(msb)([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        assertEq(m.type, 'base64')
        assertEq(m.mime_type, 'image/png')
    },

    // A large blob is still bounded by the single-`Vec` `maxLength` cap; this
    // only exercises that dialect detection doesn't change size handling for
    // non-JSON content within that bound.
    largeNonJsonWithinBound: () => {
        const a = repeat(1_000n)(vec8(0x61n)) // 1,000 bytes of 'a'
        const m = detect(a)
        assertEq(m.type, 'text')
        assertEq(m.mime_type, 'text/plain')
    },
}
