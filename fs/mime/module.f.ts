/**
 * Magic-byte MIME type detection.
 *
 * A pure table lookup over the leading bytes of a `Vec`: no I/O, no
 * dependencies beyond `fs/types/bit_vec`. `detect` returns a MIME type string
 * for the container formats whose signatures it knows, or `null` for anything
 * else — text, unknown binary, or a `Vec` too short to match.
 *
 * The CAS store is type-agnostic and keeps raw bytes only, so type is never
 * stored; it is recovered on read by sniffing the content. Callers decide what
 * `null` means: the CAS MCP adapter falls back to a plain text result.
 *
 * ## Recognised signatures
 *
 * | MIME type         | Leading bytes                          |
 * |-------------------|----------------------------------------|
 * | `image/png`       | `89 50 4E 47 0D 0A 1A 0A`              |
 * | `image/jpeg`      | `FF D8 FF`                             |
 * | `image/gif`       | `47 49 46 38` (`"GIF8"`)               |
 * | `image/webp`      | `52 49 46 46 .. .. .. .. 57 45 42 50` (`"RIFF"…"WEBP"`) |
 * | `application/pdf` | `25 50 44 46 2D` (`"%PDF-"`)           |
 * | `application/zip` | `50 4B 03 04` (`"PK\x03\x04"`)         |
 *
 * WebP is the one signature with a gap: the four-byte little-endian file size
 * sits between the `RIFF` and `WEBP` markers, so it is matched as a prefix plus
 * a second marker at byte offset 8 rather than a single contiguous run.
 *
 * @module
 */
import { msb, u8ListToVec, length, type Vec } from '../types/bit_vec/module.f.ts'
import type { Nullable } from '../types/nullable/module.f.ts'

const { startsWith, removeFront } = msb

/** Builds a big-endian signature `Vec` from a list of byte values. */
const sig = (bytes: readonly number[]): Vec => u8ListToVec(msb)(bytes)

/**
 * Contiguous magic-byte signatures, checked in order; the first prefix match
 * wins. Ordering is irrelevant here — no signature is a prefix of another.
 */
const table: readonly (readonly [Vec, string])[] = [
    [sig([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image/png'],
    [sig([0xff, 0xd8, 0xff]), 'image/jpeg'],
    [sig([0x47, 0x49, 0x46, 0x38]), 'image/gif'],
    [sig([0x25, 0x50, 0x44, 0x46, 0x2d]), 'application/pdf'],
    [sig([0x50, 0x4b, 0x03, 0x04]), 'application/zip'],
]

// WebP: "RIFF" at offset 0, "WEBP" at offset 8 (the 4 bytes between are the
// file size). 12 bytes = 96 bits is the minimum to carry both markers.
const riff = sig([0x52, 0x49, 0x46, 0x46])
const webp = sig([0x57, 0x45, 0x42, 0x50])

const isWebp = (bytes: Vec): boolean =>
    length(bytes) >= 96n
        && startsWith(riff)(bytes)
        && startsWith(webp)(removeFront(64n)(bytes))

/**
 * Detects the MIME type of `bytes` from its leading magic-byte signature.
 *
 * @returns the MIME type string for a recognised format, or `null` when the
 *   leading bytes match no known signature (including any `Vec` shorter than
 *   the signature it might otherwise match).
 */
export const detect = (bytes: Vec): Nullable<string> => {
    if (isWebp(bytes)) { return 'image/webp' }
    for (const [s, m] of table) {
        if (startsWith(s)(bytes)) { return m }
    }
    return null
}
