/**
 * Media-type detection entry point: dialect-tagged JSON recognition layered
 * on top of the byte-signature / UTF-8 detector.
 *
 * `fs/media/type` classifies raw bytes (magic-byte signatures, UTF-8
 * text-vs-binary) with no notion of a JSON dialect. `detect` here adds one
 * more classification step in front of it: when the whole blob is
 * whole-blob-valid UTF-8 text (as `fs/media/type` already determined), try
 * parsing it as JSON and validating it against a known dialect's rtti schema
 * (currently just `vnd.fjs.revision` — see `fs/media/revision`). A match
 * reports the dialect's derived media type; anything that isn't valid JSON,
 * or doesn't validate against a known dialect, falls through to the
 * `fs/media/type` verdict unchanged.
 *
 * Detection is semantic, not syntactic: any JSON that satisfies a dialect's
 * schema is recognized regardless of key order, whitespace, or any other
 * serialization detail — there is no byte-level shortcut such as a
 * `{"dialect":` prefix check.
 *
 * This only classifies an already-buffered `Vec` (`detectVec`'s single-`Vec`
 * form), because dialect validation needs the whole parsed value. A single
 * `Vec` already caps at `maxLength` bits (128 KiB — the same bound as the
 * existing inline-content cap), so dialect detection is naturally
 * size-bounded. The unbounded streaming detector (`fs/media/type`
 * `detectStream`) is untouched and stays a pure byte-signature/UTF-8
 * classifier with no dialect awareness.
 *
 * @module
 */
import type { Vec } from '../types/bit_vec/module.f.ts'
import { fromVec } from '../text/utf8/module.f.ts'
import { detectVec, type DetectMeta } from './type/module.f.ts'
import { decodeText as decodeRevisionText, mediaType as revisionMediaType } from './revision/module.f.ts'

/**
 * Classifies a whole buffered `Vec`, the same three-way `{ length, mime_type,
 * type }` shape as `fs/media/type` `detectVec`, but with dialect-tagged JSON
 * recognized ahead of the plain `text/plain` fallback.
 */
export const detect = (bytes: Vec): DetectMeta => {
    const base = detectVec(bytes)
    // Only whole-blob-valid UTF-8 text can possibly be JSON; a magic-byte hit
    // or binary fallback is never a dialect match.
    if (base.type !== 'text') { return base }
    const text = fromVec(bytes)
    if (text === null) { return base }
    const [tag] = decodeRevisionText(text)
    return tag === 'ok' ? { ...base, mime_type: revisionMediaType } : base
}
