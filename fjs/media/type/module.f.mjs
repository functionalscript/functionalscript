/**
 * Magic-byte MIME type detection.
 *
 * `detect` is a pure table lookup over the leading bytes of a `Vec`: it returns a
 * MIME type string for the container formats whose signatures it knows, or `null`
 * for anything else — text, unknown binary, or a `Vec` too short to match.
 *
 * Beside it, `detectStream` is the **streaming counterpart**: a byte-accepting
 * state machine (length × magic-byte eliminator × UTF-8 validity DFA) that derives
 * `{ length, mime_type, type }` by folding a CAS read stream in O(1) space, without
 * ever buffering the blob into a single `maxLength`-bounded `Vec`. See the README
 * for the factored design.
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
 * See `./types.ts` for the type-level API.
 *
 * @module
 */

import { msb, fromSentinel, length, u8List } from '../../types/bit_vec/module.f.mjs'
/** @import { Vec } from '../../types/bit_vec/types.ts' */
import { iterable } from '../../types/list/module.f.mjs'
/** @import { Nullable } from '../../types/nullable/types.ts' */
import { pure, step } from '../../effects/module.f.mjs'
/** @import { Effect, Operation } from '../../effects/types.ts' */
/** @import { List } from '../../effects/list/types.ts' */
/** @import { IoResult } from '../../effects/node/types.ts' */
import { ok, error } from '../../types/result/module.f.mjs'
import { isValidCodePoint, isTextCodePoint } from '../../text/code_point/module.f.mjs'
import { utf8ByteToCodePointOp } from '../../text/utf8/module.f.mjs'
/** @import { DetectMeta, DetectState, _MagicState, _Signature, _Utf8Detect } from './types.ts' */

const { startsWith, removeFront } = msb

// Each signature is written as a hex literal whose leading `1` nibble is a
// sentinel marking the start of the byte run (so leading zero bytes survive)
// and fixing the length — see `bit_vec` `fromSentinel`.
const sig = fromSentinel

/**
 * Contiguous magic-byte signatures, checked in order; the first prefix match
 * wins. Ordering is irrelevant here — no signature is a prefix of another.
 *
 * @type {readonly (readonly [Vec, string])[]}
 */
const table = [
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

/** @type {(bytes: Vec) => boolean} */
const isWebp = bytes =>
    length(bytes) >= 96n
        && startsWith(riff)(bytes)
        && startsWith(webp)(removeFront(64n)(bytes))

/**
 * Detects the MIME type of `bytes` from its leading magic-byte signature.
 *
 * @returns the MIME type string for a recognized format, or `null` when the
 *   leading bytes match no known signature (including any `Vec` shorter than
 *   the signature it might otherwise match).
 *
 * @type {(bytes: Vec) => Nullable<string>}
 */
export const detect = bytes => {
    if (isWebp(bytes)) { return 'image/webp' }
    for (const [s, m] of table) {
        if (startsWith(s)(bytes)) { return m }
    }
    return null
}

// ── Streaming detector ────────────────────────────────────────────────────────────
//
// A byte-accepting state machine that derives the same `{ length, mime_type, type }`
// metadata as the pure `detect` + UTF-8 path, but **without buffering the blob**.
// It is the product of three independent folds over the byte stream — length,
// magic-byte signature elimination, and a UTF-8 validity DFA — read off at
// end-of-stream by `finish`. This lets `cas_get` inspect arbitrarily large blobs
// (where a single `Vec` would overflow `maxLength`) in O(1) space, since the bulk
// of a large blob costs only length counting once the verdict is fixed (see
// `isSettled`: a magic match settles it immediately, a dead magic once utf8 fails).

// The streaming counterpart of `table`/`isWebp`: the same signatures expressed as
// byte patterns the eliminator can consume one byte at a time. WebP's gap is the
// only wildcard run.
/** @type {readonly _Signature[]} */
const signatures = [
    { pattern: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mime: 'image/png' },
    { pattern: [0xff, 0xd8, 0xff], mime: 'image/jpeg' },
    { pattern: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], mime: 'image/gif' },
    { pattern: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], mime: 'image/gif' },
    { pattern: [0x25, 0x50, 0x44, 0x46, 0x2d], mime: 'application/pdf' },
    { pattern: [0x50, 0x4b, 0x03, 0x04], mime: 'application/zip' },
    { pattern: [0x50, 0x4b, 0x05, 0x06], mime: 'application/zip' },
    { pattern: [0x50, 0x4b, 0x07, 0x08], mime: 'application/zip' },
    {
        pattern: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
        mime: 'image/webp',
    },
]

/** @type {_MagicState} */
const magicInit = { tag: 'scan', pos: 0, viable: signatures }

/** @type {(m: _MagicState, byte: number) => _MagicState} */
const magicStep = (m, byte) => {
    if (m.tag !== 'scan') { return m }
    const { pos } = m
    const viable = m.viable.filter(s => {
        const p = s.pattern[pos]
        return p === null || p === byte
    })
    for (const s of viable) {
        if (s.pattern.length === pos + 1) { return { tag: 'matched', mime: s.mime } }
    }
    return viable.length === 0 ? { tag: 'dead' } : { tag: 'scan', pos: pos + 1, viable }
}

/** @type {(m: _MagicState) => Nullable<string>} */
const magicMime = m => m.tag === 'matched' ? m.mime : null

/** @type {_Utf8Detect} */
const utf8Init = { st: null, valid: true, text: true }

/** @type {(u: _Utf8Detect, byte: number) => _Utf8Detect} */
const utf8Step = (u, byte) => {
    if (!u.valid) { return u }
    const [cps, st] = utf8ByteToCodePointOp(byte, u.st)
    let text = u.text
    for (const cp of cps) {
        if (!isValidCodePoint(cp)) { return { st, valid: false, text } }
        if (!isTextCodePoint(cp)) { text = false }
    }
    return { st, valid: true, text }
}

/** @type {(u: _Utf8Detect) => boolean} */
const utf8Valid = u => u.valid && u.st === null

// A blob is text only when it is whole-blob-valid UTF-8 *and* every decoded code
// point is a text code point (no NUL/other controls).
/** @type {(u: _Utf8Detect) => boolean} */
const utf8Text = u => utf8Valid(u) && u.text

/** The initial detector state `q₀`.
 *
 * @type {DetectState}
 */
export const detectInit = {
    length: 0n,
    magic: magicInit,
    utf8: utf8Init,
}

// The outcome can no longer change — `push` may stop decoding and only count
// length — once `finish` is pinned down. A magic `matched` pins it on its own
// (`finish` returns the detected mime and ignores the utf8 verdict), so we must
// not wait for utf8 to go invalid (it may stay valid forever, e.g. an ASCII PDF).
// A magic `dead` leaves text-vs-octet open, so it settles only once utf8 can no
// longer be text — either invalid or a control byte seen (both absorbing); `scan`
// is never settled.
/** @type {(magic: _MagicState, utf8: _Utf8Detect) => boolean} */
const isSettled = (magic, utf8) => {
    switch (magic.tag) {
        case 'matched': return true
        case 'dead': return !utf8.valid || !utf8.text
        case 'scan': return false
    }
}

/**
 * Folds one `Vec` chunk into the detector state (`δ` over a whole chunk). Length
 * always advances by the chunk's bit length; per-byte iteration stops as soon as
 * the verdict is fixed (see {@link isSettled}), so large blobs — including large
 * magic-matched ones — cost ≈ length counting.
 *
 * @type {(s: DetectState) => (chunk: Vec) => DetectState}
 */
export const push = s => chunk => {
    const bits = length(chunk)
    let magic = s.magic
    let utf8 = s.utf8
    if (!isSettled(magic, utf8)) {
        for (const byte of iterable(u8List(msb)(chunk))) {
            magic = magicStep(magic, byte)
            utf8 = utf8Step(utf8, byte)
            if (isSettled(magic, utf8)) { break }
        }
    }
    return { length: s.length + bits, magic, utf8 }
}

/**
 * Reads the answer off the final state (`λ`). Reproduces the three-way result of
 * the pure path: magic hit → `base64` + detected mime; else whole-blob-valid UTF-8
 * that is also all-text (byte-aligned, no invalidity, no control bytes) → `text` +
 * `text/plain`; else → `base64` + `application/octet-stream`. A valid-but-control
 * blob (NUL, other controls) is well-formed UTF-8 yet falls through to the binary
 * branch.
 *
 * @type {(s: DetectState) => DetectMeta}
 */
export const finish = s => {
    const byteLength = s.length >> 3n
    const mime = magicMime(s.magic)
    if (mime !== null) { return { length: byteLength, mime_type: mime, type: 'base64' } }
    if (utf8Text(s.utf8) && (s.length & 0b111n) === 0n) {
        return { length: byteLength, mime_type: 'text/plain', type: 'text' }
    }
    return { length: byteLength, mime_type: 'application/octet-stream', type: 'base64' }
}

/**
 * Classifies a whole `Vec` with the same state machine as {@link detectStream}.
 * The single-buffer counterpart for callers that already hold the bytes (the
 * `cas_get` `content: true` path materializes the blob anyway): both paths read
 * the three-way `{ length, mime_type, type }` verdict from one machine instead of
 * re-deriving it from `detect` + a separate UTF-8 check.
 *
 * @type {(bytes: Vec) => DetectMeta}
 */
export const detectVec = bytes => finish(push(detectInit)(bytes))

/**
 * Folds a CAS read stream through {@link push} and reads {@link finish} at EOF,
 * deriving `cas_get` metadata without ever materializing the blob. A read `error`
 * item short-circuits into the `IoResult` error.
 *
 * @template {Operation} O
 * @param {List<O, IoResult<Vec>>} stream
 * @returns {Effect<O, IoResult<DetectMeta>>}
 */
export const detectStream = stream => {
    /** @type {(s: DetectState) => (l: List<O, IoResult<Vec>>) => Effect<O, IoResult<DetectMeta>>} */
    const loop = s => l =>
        step(
            l,
            node => {
                if (node === undefined) { return pure(ok(finish(s))) }
                const { first, tail } = node
                const [t, v] = first
                if (t === 'error') { return pure(error(v)) }
                return loop(push(s)(v))(tail)
            })
    return loop(detectInit)(stream)
}
