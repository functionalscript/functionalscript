/**
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { List } from '../../effects/list/types.ts'
 * @import { IoChannel } from '../../effects/node/types.ts'
 * @import { DetectMeta } from './types.ts'
 */

import { assert, assertEq } from '../../asserts/module.f.mjs'
import { msb, u8ListToVec, vec8, repeat, empty } from '../../types/bit_vec/module.f.mjs'
import { runPure } from '../../effects/module.f.mjs'
import { nonEmpty, empty as emptyList } from '../../effects/list/module.f.mjs'
import { pureError } from '../../effects/io/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'
import { ioError } from '../../effects/node/module.f.mjs'
import { detect, detectStream, detectVec } from './module.f.mjs'

// Builds a big-endian `Vec` from a list of byte values — mirrors how the CAS
// store would hold the leading bytes of a stored blob.
/** @type {(...b: readonly number[]) => Vec} */
const bytes = (...b) => u8ListToVec(msb)(b)

// ── Streaming detector helpers ──────────────────────────────────────────────────

// Builds a CAS-style read stream from a sequence of chunks.
/** @type {(...chunks: readonly Vec[]) => List<never, Vec, IoChannel>} */
const stream = (...chunks) =>
    chunks.reduceRight(
        (tail, c) => nonEmpty(c, tail),
        /** @satisfies {List<never, Vec, IoChannel>} */ (emptyList()))

// Runs the streaming detector over the given chunks and unwraps the metadata.
/** @type {(...chunks: readonly Vec[]) => DetectMeta} */
const detectChunks = (...chunks) => {
    const o = runPure(detectStream(stream(...chunks)))
    assert(o.length === 1, 'effect is not pure')
    const [r] = o
    assert(r[0] !== 'error', r[1])
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

    // A spanned ZIP archive — the third "PK" variant, so every entry of the
    // signature list has a case that fails if it is dropped.
    spannedZip: () =>
        assertEq(detect(bytes(0x50, 0x4b, 0x07, 0x08, 0x00, 0x00)), 'application/zip'),

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
    // `detect` is the magic projection of `push`, and that only holds because
    // `magicStep` leaves a non-`scan` state alone. These pin both absorbing
    // states as fixed points from the outside, where `magicStep` is private.
    settledMagicIsAFixedPoint: [
        // `matched` survives whatever follows the signature — including bytes
        // that would not extend it, and a long tail that would otherwise keep
        // the fold running.
        () => assertEq(detect(bytes(0xff, 0xd8, 0xff, 0x00, 0x01, 0x02)), 'image/jpeg'),
        () => assertEq(detect(bytes(0xff, 0xd8, 0xff, ...Array(64).fill(0x41))), 'image/jpeg'),
        // `dead` survives too. This is the case where `push` keeps folding
        // after the magic state is settled — `isSettled` stays false while the
        // UTF-8 factor is still valid text — so a `dead` magic is fed many more
        // bytes here than `detect`'s old loop ever gave it.
        () => assertEq(detect(bytes(0x41)), null),
        () => assertEq(detect(bytes(0x41, ...Array(64).fill(0x42))), null),
        // ...and the same input still reads as text through the full detector,
        // confirming the fold really did continue past the dead magic.
        () => assertEq(detectVec(bytes(0x41, ...Array(64).fill(0x42))).type, 'text'),
    ],
    textIsNull: () =>
        assertEq(detect(bytes(0x68, 0x65, 0x6c, 0x6c, 0x6f)), null),

    // A prefix shorter than any signature falls through to null, not a partial match.
    shortIsNull: () =>
        assertEq(detect(bytes(0x89, 0x50)), null),

    emptyIsNull: () =>
        assertEq(detect(empty), null),

    // Every signature, one byte short of complete. A signature is only ever
    // recognized on its *last* byte, so each of these must still be null — an
    // off-by-one in the eliminator's terminal-position test would report the
    // format here, and would fire the "GIF8"-prefix trap `gif8NotGif` guards.
    truncated: {
        png: () =>
            assertEq(detect(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a)), null),

        jpeg: () =>
            assertEq(detect(bytes(0xff, 0xd8)), null),

        gif87a: () =>
            assertEq(detect(bytes(0x47, 0x49, 0x46, 0x38, 0x37)), null),

        gif89a: () =>
            assertEq(detect(bytes(0x47, 0x49, 0x46, 0x38, 0x39)), null),

        pdf: () =>
            assertEq(detect(bytes(0x25, 0x50, 0x44, 0x46)), null),

        zip: () =>
            assertEq(detect(bytes(0x50, 0x4b, 0x03)), null),

        // 11 bytes: "RIFF", the size wildcards, and all but the last byte of
        // "WEBP" — the wildcard run must not shorten the pattern either.
        webp: () =>
            assertEq(
                detect(bytes(
                    0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42)),
                null),
    },

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

        // A NUL-byte blob is valid single-byte UTF-8 (all U+0000) but is binary:
        // NUL is the sharpest binary marker, so it classifies as octet-stream.
        nul: () => {
            const m = detectChunks(bytes(0x00, 0x00, 0x00))
            assertEq(m.type, 'base64')
            assertEq(m.mime_type, 'application/octet-stream')
            assertEq(m.length, 3n)
        },

        // A control byte embedded in otherwise-valid ASCII (here ESC) is still
        // binary — text/plain must not imply terminal escapes.
        controlByte: () => {
            const m = detectChunks(bytes(0x68, 0x69, 0x1b, 0x5b, 0x30, 0x6d)) // "hi\x1b[0m"
            assertEq(m.type, 'base64')
            assertEq(m.mime_type, 'application/octet-stream')
            assertEq(m.length, 6n)
        },

        // A C1 control arrives as 2-byte UTF-8 (C2 85 = U+0085, NEL); invisible at
        // the byte level, it is caught at the code-point level and reads as binary.
        c1Control: () => {
            const m = detectChunks(bytes(0x41, 0xc2, 0x85)) // "A" + U+0085
            assertEq(m.type, 'base64')
            assertEq(m.mime_type, 'application/octet-stream')
            assertEq(m.length, 3n)
        },

        // The text whitespace controls (TAB, LF, VT, FF, CR) are legitimate in text.
        whitespaceControlsStayText: () => {
            const m = detectChunks(bytes(0x61, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x62)) // "a\t\n\v\f\rb"
            assertEq(m.type, 'text')
            assertEq(m.mime_type, 'text/plain')
            assertEq(m.length, 7n)
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

        // A magic match settles the verdict on its own: a large magic-matched blob
        // whose tail stays valid UTF-8 (an ASCII PDF) classifies by the signature.
        // `push` stops decoding the tail once `magic` is matched — `finish` ignores
        // the utf8 verdict here — so this is the magic-matched fast path.
        pdfThenLargeTextTail: () => {
            const header = bytes(0x25, 0x50, 0x44, 0x46, 0x2d) // "%PDF-"
            const tail = repeat(70_000n)(vec8(0x61n))          // valid ASCII, never invalidates utf8
            const m = detectChunks(header, tail)
            assertEq(m.type, 'base64')
            assertEq(m.mime_type, 'application/pdf')
            assertEq(m.length, 70_005n)
        },

        // A magic match wins regardless of the tail: a binary (non-UTF-8) tail
        // after the signature is still classified by the signature.
        pdfThenBinaryTail: () => {
            const header = bytes(0x25, 0x50, 0x44, 0x46, 0x2d) // "%PDF-"
            const m = detectChunks(header, bytes(0xff, 0xfe, 0x00))
            assertEq(m.type, 'base64')
            assertEq(m.mime_type, 'application/pdf')
            assertEq(m.length, 8n)
        },

        // A stream that fails carries its failure out as the detector's own.
        readErrorSurfaces: () => {
            /** @type {List<never, Vec, IoChannel>} */
            const errStream = pureError(ioError({ message: 'boom' }))
            const o = runPure(detectStream(errStream))
            assert(o.length === 1, 'effect is not pure')
            assert(o[0][0] === 'error')
        },

        // Empty stream: zero-length text/plain.
        empty: () => {
            const m = detectChunks()
            assertEq(m.type, 'text')
            assertEq(m.length, 0n)
        },
    },

    // ── Single-Vec detector (detectVec) ─────────────────────────────────────────
    // The whole-Vec form used by the `cas_get` content:true path; same machine,
    // same three-way verdict as the streaming form.

    vec: {
        text: () => {
            const m = detectVec(bytes(0x68, 0x65, 0x6c, 0x6c, 0x6f)) // "hello"
            assertEq(m.type, 'text')
            assertEq(m.mime_type, 'text/plain')
            assertEq(m.length, 5n)
        },

        png: () => {
            const m = detectVec(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01))
            assertEq(m.type, 'base64')
            assertEq(m.mime_type, 'image/png')
            assertEq(m.length, 10n)
        },

        octetStream: () => {
            const m = detectVec(bytes(0xff, 0xfe, 0x00, 0x01))
            assertEq(m.type, 'base64')
            assertEq(m.mime_type, 'application/octet-stream')
            assertEq(m.length, 4n)
        },

        // Valid UTF-8 NUL run is binary in the single-Vec path too.
        nul: () => {
            const m = detectVec(bytes(0x00, 0x00, 0x00))
            assertEq(m.type, 'base64')
            assertEq(m.mime_type, 'application/octet-stream')
            assertEq(m.length, 3n)
        },
    },
}
