import { assert, assertEq } from '../asserts/module.f.ts'
import { msb, u8ListToVec, vec8, repeat, empty, type Vec } from '../types/bit_vec/module.f.ts'
import { decode, type Effect } from '../effects/module.f.ts'
import { nonEmpty, empty as emptyList, type List } from '../effects/list/module.f.ts'
import { ok, type Result } from '../types/result/module.f.ts'
import { detect, detectStream, type DetectMeta } from './module.f.ts'

// Builds a big-endian `Vec` from a list of byte values — mirrors how the CAS
// store would hold the leading bytes of a stored blob.
const bytes = (...b: readonly number[]): Vec => u8ListToVec(msb)(b)

// ── Streaming detector helpers ──────────────────────────────────────────────────

// Evaluates a fully pure effect (no operations) to its result.
const runPure = <T>(e: Effect<never, T>): T => {
    const d = decode(e)
    if (!d.done) { throw 'effect is not pure' }
    return d.result
}

// Builds a CAS-style read stream from a sequence of ok(chunk) items.
const stream = (...chunks: readonly Vec[]): List<never, Result<Vec, unknown>> =>
    chunks.reduceRight<List<never, Result<Vec, unknown>>>(
        (tail, c) => nonEmpty(ok(c), tail),
        emptyList<never, Result<Vec, unknown>>())

// Runs the streaming detector over the given chunks and unwraps the metadata.
const detectChunks = (...chunks: readonly Vec[]): DetectMeta => {
    const r = runPure(detectStream(stream(...chunks)))
    if (r[0] === 'error') { throw r[1] }
    return r[1]
}

export const proof = {
    png: () =>
        assertEq(detect(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), 'image/png'),

    jpeg: () =>
        assertEq(detect(bytes(0xff, 0xd8, 0xff, 0xe0)), 'image/jpeg'),

    gif89a: () =>
        assertEq(detect(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61)), 'image/gif'),

    gif87a: () =>
        assertEq(detect(bytes(0x47, 0x49, 0x46, 0x38, 0x37, 0x61)), 'image/gif'),

    // "GIF8" alone, without a valid version suffix, is not a GIF.
    gif8NotGif: () =>
        assertEq(detect(bytes(0x47, 0x49, 0x46, 0x38, 0x30, 0x30)), null),

    pdf: () =>
        // "%PDF-1.4"
        assertEq(detect(bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34)), 'application/pdf'),

    zip: () =>
        assertEq(detect(bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00)), 'application/zip'),

    // An empty ZIP archive starts with the end-of-central-directory record.
    emptyZip: () =>
        assertEq(detect(bytes(0x50, 0x4b, 0x05, 0x06, 0x00, 0x00)), 'application/zip'),

    webp: () =>
        // "RIFF" + 4-byte size + "WEBP"
        assertEq(
            detect(bytes(
                0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50)),
            'image/webp'),

    // "RIFF…" without the "WEBP" marker (e.g. a WAV) is not WebP.
    riffNotWebp: () =>
        assertEq(
            detect(bytes(
                0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45)),
            null),

    // Plain ASCII text matches no signature.
    textIsNull: () =>
        assertEq(detect(bytes(0x68, 0x65, 0x6c, 0x6c, 0x6f)), null),

    // A prefix shorter than any signature falls through to null, not a partial match.
    shortIsNull: () =>
        assertEq(detect(bytes(0x89, 0x50)), null),

    emptyIsNull: () =>
        assertEq(detect(empty), null),

    // ── Streaming detector (detectStream) ───────────────────────────────────────

    stream: {
        // Plain UTF-8 text classifies as text/plain with the correct byte length.
        text: () => {
            const m = detectChunks(bytes(0x68, 0x65, 0x6c, 0x6c, 0x6f)) // "hello"
            assertEq(m.type, 'text')
            assertEq(m.mime_type, 'text/plain')
            assertEq(m.length, 5n)
        },

        // A magic-byte signature classifies as base64 with the detected mime type.
        png: () => {
            const m = detectChunks(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01))
            assertEq(m.type, 'base64')
            assertEq(m.mime_type, 'image/png')
            assertEq(m.length, 10n)
        },

        // Unknown binary (no signature, not UTF-8) falls back to octet-stream/base64.
        octetStream: () => {
            const m = detectChunks(bytes(0xff, 0xfe, 0x00, 0x01))
            assertEq(m.type, 'base64')
            assertEq(m.mime_type, 'application/octet-stream')
            assertEq(m.length, 4n)
        },

        // Magic-byte detection threads across a chunk boundary mid-signature.
        magicAcrossChunks: () => {
            const m = detectChunks(
                bytes(0x89, 0x50, 0x4e),                   // first 3 bytes of the PNG signature
                bytes(0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00)) // the rest, in a second chunk
            assertEq(m.type, 'base64')
            assertEq(m.mime_type, 'image/png')
            assertEq(m.length, 9n)
        },

        // WebP's wildcard size gap is handled in the streaming form too.
        webp: () => {
            const m = detectChunks(
                bytes(0x52, 0x49, 0x46, 0x46),             // "RIFF"
                bytes(0x1a, 0x00, 0x00, 0x00),             // 4-byte size (wildcards)
                bytes(0x57, 0x45, 0x42, 0x50))             // "WEBP"
            assertEq(m.type, 'base64')
            assertEq(m.mime_type, 'image/webp')
            assertEq(m.length, 12n)
        },

        // A multi-byte UTF-8 sequence split across chunks stays valid text.
        utf8AcrossChunks: () => {
            const m = detectChunks(bytes(0xc3), bytes(0xa9)) // "é" = C3 A9
            assertEq(m.type, 'text')
            assertEq(m.mime_type, 'text/plain')
            assertEq(m.length, 2n)
        },

        // The decisive case: valid UTF-8 for every chunk but the last, which adds a
        // lone invalid byte. A leading-bytes buffer would wrongly say "text"; the
        // streaming validator sees the whole blob and classifies it as base64.
        validUntilTrailingInvalidByte: () => {
            const m = detectChunks(
                bytes(0x68, 0x65, 0x6c, 0x6c, 0x6f),       // "hello" — valid UTF-8
                bytes(0xff))                               // trailing invalid byte
            assertEq(m.type, 'base64')
            assertEq(m.mime_type, 'application/octet-stream')
            assertEq(m.length, 6n)
        },

        // A truncated multi-byte sequence at EOF is invalid UTF-8, hence base64.
        truncatedSequence: () => {
            const m = detectChunks(bytes(0xc3)) // lead byte with no continuation
            assertEq(m.type, 'base64')
            assertEq(m.mime_type, 'application/octet-stream')
            assertEq(m.length, 1n)
        },

        // A blob larger than `maxLength` (1,048,576 bits) split across chunks — the
        // exact case where `collectRead` would error — returns correct metadata.
        largeMultiChunkBlob: () => {
            const a = repeat(70_000n)(vec8(0x61n)) // 70,000 bytes of 'a' (560,000 bits)
            const m = detectChunks(a, a)           // 140,000 bytes = 1,120,000 bits > maxLength
            assertEq(m.type, 'text')
            assertEq(m.mime_type, 'text/plain')
            assertEq(m.length, 140_000n)
        },

        // A read `error` item short-circuits into the IoResult error.
        readErrorSurfaces: () => {
            const errStream: List<never, Result<Vec, unknown>> =
                nonEmpty(['error', 'boom'] as const, emptyList<never, Result<Vec, unknown>>())
            const r = runPure(detectStream(errStream))
            assert(r[0] === 'error')
        },

        // Empty stream: zero-length text/plain.
        empty: () => {
            const m = detectChunks()
            assertEq(m.type, 'text')
            assertEq(m.length, 0n)
        },
    },
}
