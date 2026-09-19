/**
 * Portable URL-path admission and lexical resolution for the virtual file host.
 * Native module identity is supplied by the host, not by this path helper.
 *
 * @module
 */

import { map } from '../../types/list/module.f.mjs'
import { codePointListToString, stringToCodePointList } from '../../text/utf16/module.f.mjs'
import { isValidCodePoint } from '../../text/code_point/module.f.mjs'
import { percentDecode } from '../../text/percent/module.f.mjs'
import { concat as pathConcat } from '../module.f.mjs'

/** A literal URL string replaces lone surrogates; percent-encoded bytes stay strict UTF-8. @type {(c: number) => number} */
const scalarValue = c => isValidCodePoint(c) ? c : 0xfffd

/**
 * One URL-path segment as a portable filesystem segment, or a refusal.
 * Decoded separators and NUL cannot name a segment. Colons are also refused:
 * the current portable path layer would reinterpret drive/stream syntax
 * after joining or normalization. Host-specific colon names need the full
 * resolver; they must not silently become another root here.
 *
 * @type {(segment: string) => string | null}
 */
const importSegment = segment => {
    const literal = codePointListToString(map(scalarValue)(stringToCodePointList(segment)))
    const decoded = percentDecode(literal)
    return decoded === null || decoded.includes('/') || decoded.includes('\\') || decoded.includes('\0') || decoded.includes(':')
        ? null
        : decoded
}

/**
 * Reduce URL dot segments while the other components are still encoded.
 * Only the URL grammar's exact dot spellings are structural; canceled
 * components need not be valid UTF-8 or valid filesystem names. Keep empty
 * components here: in `bad%//../dep`, `..` removes the empty one, not `bad%`.
 *
 * @type {(rooted: boolean) => (segments: readonly string[], segment: string) => readonly string[]}
 */
const importDotSegments = rooted => (segments, segment) => {
    switch (segment.toLowerCase()) {
        case '.': case '%2e': return segments
        case '..': case '.%2e': case '%2e.': case '%2e%2e':
            return segments.length !== 0 && segments[segments.length - 1] !== '..'
                ? segments.slice(0, -1)
                : rooted ? segments : [...segments, '..']
        default: return [...segments, segment]
    }
}

/**
 * Resolve an import's URL-path spelling against its importing file, or return
 * null for unsupported syntax or a surviving unsupported segment. URL dot
 * processing precedes decoding and filesystem validation, so `bad%/../dep`
 * names `dep`. Decode only the surviving specifier components, once; the
 * importing path is already a filesystem path and is never decoded again.
 *
 * This is the virtual host's lexical path profile. Native file URL identities
 * come from the host resolution effect, not from this helper.
 *
 * @type {(path: string) => (specifier: string) => string | null}
 */
export const resolve = path => specifier => {
    const decoded = decode(specifier)
    return decoded === null ? null : pathConcat(pathConcat(path)('..'))(decoded)
}

/**
 * Reduce URL dot segments and decode portable path components without resolving
 * a module identity. Refuse raw colons, backslashes and URL suffixes before
 * dot processing: suffix text must neither be decoded nor canceled as a path.
 * Percent-encoded `?` and `#` are filename data, not URL delimiters.
 *
 * @type {(specifier: string) => string | null}
 */
export const decode = specifier => {
    if (specifier.includes(':') || specifier.includes('\\')
        || specifier.includes('?') || specifier.includes('#')) { return null }
    const rooted = specifier.startsWith('/')
    const raw = specifier.split('/')
    const components = (rooted ? raw.slice(1) : raw).reduce(importDotSegments(rooted), [])
    const segments = components.map(importSegment)
    return segments.every(segment => segment !== null)
        ? `${rooted ? '/' : ''}${segments.join('/')}`
        : null
}
