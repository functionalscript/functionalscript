/**
 * Magic-byte MIME type detection.
 *
 * One list — `signatures` — declares every recognized magic-byte pattern, and
 * both detectors read it through the same eliminator (`magicStep`): `detect`
 * folds a whole `Vec` and returns a MIME type string or `null`, while
 * `detectStream` folds a read stream one chunk at a time.
 *
 * Beside `detect`, `detectStream` is the **streaming counterpart**: a
 * byte-accepting state machine (length × magic-byte eliminator × UTF-8 validity
 * DFA) that derives `{ length, mime_type, type }` by folding a CAS read stream in
 * O(1) space, without ever buffering the blob into a single `maxLength`-bounded
 * `Vec`. See the README for the factored design.
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
 * sits between the `RIFF` and `WEBP` markers, so its pattern carries four
 * wildcard bytes rather than being one contiguous run.
 *
 * See `./types.ts` for the type-level API.
 *
 * @module
 *
 * @import { Vec } from '../../types/bit_vec/types.ts'
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Operation } from '../../effects/types.ts'
 * @import { List } from '../../effects/list/types.ts'
 * @import { IoChannel, IoResult } from '../../effects/node/types.ts'
 * @import { Effect } from '../../effects/io/types.ts'
 * @import { DetectMeta, DetectState, _MagicState, _Signature, _Utf8Detect } from './types.ts'
 */

import { msb, length, u8List } from '../../types/bit_vec/module.f.mjs'
import { iterable } from '../../types/list/module.f.mjs'
import { pure, step } from '../../effects/module.f.mjs'
import { ok, error } from '../../types/result/module.f.mjs'
import { isValidCodePoint, isTextCodePoint } from '../../text/code_point/module.f.mjs'
import { utf8ByteToCodePointOp } from '../../text/utf8/module.f.mjs'

// ── Magic-byte signatures ─────────────────────────────────────────────────────────
//
// The single declaration of what a signature is: a byte pattern the eliminator can
// consume one byte at a time, with `null` for a wildcard byte. Both `detect` and
// the streaming detector below eliminate against this one list, so a signature is
// added or corrected in exactly one place.

/** @type {readonly _Signature[]} */
const signatures = [
    { pattern: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mime: 'image/png' },
    { pattern: [0xff, 0xd8, 0xff], mime: 'image/jpeg' },
    // Match the full GIF version headers ("GIF87a" / "GIF89a"), not just "GIF8",
    // so opaque bytes that merely start with "GIF8" are not mistyped.
    { pattern: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], mime: 'image/gif' },
    { pattern: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], mime: 'image/gif' },
    { pattern: [0x25, 0x50, 0x44, 0x46, 0x2d], mime: 'application/pdf' },
    // ZIP has three "PK" local-header variants: a normal entry, an empty
    // archive (end-of-central-directory only), and a spanned archive.
    { pattern: [0x50, 0x4b, 0x03, 0x04], mime: 'application/zip' },
    { pattern: [0x50, 0x4b, 0x05, 0x06], mime: 'application/zip' },
    { pattern: [0x50, 0x4b, 0x07, 0x08], mime: 'application/zip' },
    // WebP: "RIFF" at offset 0, "WEBP" at offset 8; the four bytes between are
    // the little-endian file size, matched as wildcards.
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

/**
 * Detects the MIME type of `bytes` from its leading magic-byte signature, as
 * the magic projection of the streaming detector below — one fold, read two
 * ways, rather than a second copy of it.
 *
 * The two agree because `magicStep` returns a non-`scan` state unchanged, so
 * both absorbing states are its fixed points. `detect`'s old loop stopped at
 * the first one; `push` stops only once the *whole* verdict is settled and may
 * keep folding for the UTF-8 factor after the magic state is `dead` — but a
 * `dead` or `matched` magic cannot move again, so the final magic is the same
 * either way. A signature still in `scan` at the end of the `Vec` — a prefix
 * too short to complete any signature — reads as `null`.
 *
 * Cost follows `push`, which stops only once the whole verdict is settled, not
 * once the magic state is. On a signature match or on non-text bytes that is
 * still an early exit; on valid text it now reads the whole `Vec`, because the
 * shared machine is still tracking the UTF-8 factor this function ignores
 * (measured: 100 KB of ASCII, 1.2 ms before, 82 ms after). That is the same
 * work {@link detectVec} already does on the same bytes, and `Vec` is capped at
 * `maxLength`, so the cost is bounded rather than unbounded — but a caller
 * scanning many large text blobs for signatures alone should know it is paying
 * for the UTF-8 fold too.
 *
 * The bytes come from `u8List`, so a `Vec` whose length is not a whole number of
 * bytes has its trailing partial byte zero-padded — the same reading of a ragged
 * `Vec` the streaming detector already uses.
 *
 * @returns the MIME type string for a recognized format, or `null` when the
 *   leading bytes match no known signature (including any `Vec` shorter than
 *   the signature it might otherwise match).
 *
 * @type {(bytes: Vec) => Nullable<string>}
 */
export const detect = bytes => magicMime(push(detectInit)(bytes).magic)

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
 * @returns {Effect<O, DetectMeta, IoChannel>}
 */
export const detectStream = stream => {
    /** @type {(s: DetectState) => (l: List<O, IoResult<Vec>>) => Effect<O, DetectMeta, IoChannel>} */
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
