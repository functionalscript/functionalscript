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
 * | `image/gif`       | `47 49 46 38 37 61` / `…39 61` (`"GIF87a"` / `"GIF89a"`) |
 * | `image/webp`      | `52 49 46 46 .. .. .. .. 57 45 42 50` (`"RIFF"…"WEBP"`) |
 * | `application/pdf` | `25 50 44 46 2D` (`"%PDF-"`)           |
 * | `application/zip` | `50 4B 03 04` / `05 06` / `07 08` (`"PK"` entry, empty, or spanned) |
 *
 * WebP is the one signature with a gap: the four-byte little-endian file size
 * sits between the `RIFF` and `WEBP` markers, so it is matched as a prefix plus
 * a second marker at byte offset 8 rather than a single contiguous run.
 *
 * @module
 */
import { msb, fromSentinel, length, type Vec } from '../types/bit_vec/module.f.ts'
import type { Nullable } from '../types/nullable/module.f.ts'

const { startsWith, removeFront } = msb

// Each signature is written as a hex literal whose leading `1` nibble is a
// sentinel marking the start of the byte run (so leading zero bytes survive)
// and fixing the length — see `bit_vec` `fromSentinel`.
const sig = fromSentinel

/**
 * Contiguous magic-byte signatures, checked in order; the first prefix match
 * wins. Ordering is irrelevant here — no signature is a prefix of another.
 */
const table: readonly (readonly [Vec, string])[] = [
    [sig(0x1_89_50_4e_47_0d_0a_1a_0an), 'image/png'],
    [sig(0x1_ff_d8_ffn), 'image/jpeg'],
    // Match the full GIF version headers ("GIF87a" / "GIF89a"), not just "GIF8",
    // so opaque bytes that merely start with "GIF8" are not mistyped.
    [sig(0x1_47_49_46_38_37_61n), 'image/gif'],
    [sig(0x1_47_49_46_38_39_61n), 'image/gif'],
    [sig(0x1_25_50_44_46_2dn), 'application/pdf'],
    // ZIP has three "PK" local-header variants: a normal entry, an empty
    // archive (end-of-central-directory only), and a spanned archive.
    [sig(0x1_50_4b_03_04n), 'application/zip'],
    [sig(0x1_50_4b_05_06n), 'application/zip'],
    [sig(0x1_50_4b_07_08n), 'application/zip'],
]

// WebP: "RIFF" at offset 0, "WEBP" at offset 8 (the 4 bytes between are the
// file size). 12 bytes = 96 bits is the minimum to carry both markers.
const riff = sig(0x1_52_49_46_46n)
const webp = sig(0x1_57_45_42_50n)

const isWebp = (bytes: Vec): boolean =>
    length(bytes) >= 96n
        && startsWith(riff)(bytes)
        && startsWith(webp)(removeFront(64n)(bytes))

/**
 * Detects the MIME type of `bytes` from its leading magic-byte signature.
 *
 * @returns the MIME type string for a recognized format, or `null` when the
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
