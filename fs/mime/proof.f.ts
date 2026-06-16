import { assertEq } from '../asserts/module.f.ts'
import { msb, u8ListToVec, empty, type Vec } from '../types/bit_vec/module.f.ts'
import { detect } from './module.f.ts'

// Builds a big-endian `Vec` from a list of byte values — mirrors how the CAS
// store would hold the leading bytes of a stored blob.
const bytes = (...b: readonly number[]): Vec => u8ListToVec(msb)(b)

export const proof = {
    png: () =>
        assertEq(detect(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), 'image/png'),

    jpeg: () =>
        assertEq(detect(bytes(0xff, 0xd8, 0xff, 0xe0)), 'image/jpeg'),

    gif: () =>
        // "GIF89a"
        assertEq(detect(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61)), 'image/gif'),

    pdf: () =>
        // "%PDF-1.4"
        assertEq(detect(bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34)), 'application/pdf'),

    zip: () =>
        assertEq(detect(bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00)), 'application/zip'),

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
}
