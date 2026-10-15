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
import { concat as pathConcat, root, _foldRejoin } from '../module.f.mjs'

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
 * A URL-path segment, classified while the other components are still encoded.
 * Only the URL grammar's exact dot spellings are structural; canceled
 * components need not be valid UTF-8 or valid filesystem names. Keep empty
 * components here: in `bad%//../dep`, `..` removes the empty one, not `bad%`.
 *
 * @type {(segment: string) => 'skip' | 'up' | 'keep'}
 */
const importSegmentKind = segment => {
    switch (segment.toLowerCase()) {
        case '.': case '%2e': return 'skip'
        case '..': case '.%2e': case '%2e.': case '%2e%2e': return 'up'
        default: return 'keep'
    }
}

const importFoldRejoin = _foldRejoin(importSegmentKind)(importSegment)

/**
 * Whether a specifier names a file path, and from where: `'relative'` for
 * `./` and `../`, resolved against the importing file; `'rooted'` for a
 * leading `/`, resolved against the root; `'bare'` for everything else — a
 * package name, `node:fs`, `https:…` — which is not a path at all.
 *
 * This is the question every consumer asks before treating a specifier as a
 * path, answered once; each consumer still decides what a kind means to it.
 * It reads the spelling only, as a URL does: a leading `//` is `'rooted'`
 * here and is refused by {@link decode}, so a rooted specifier that decodes
 * starts with one slash or three and more, never exactly two.
 *
 * @type {(specifier: string) => 'relative' | 'rooted' | 'bare'}
 */
export const specifierKind = specifier =>
    specifier.startsWith('./') || specifier.startsWith('../') ? 'relative'
    : specifier.startsWith('/') ? 'rooted'
    : 'bare'

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
 * The root is `fjs/path`'s, so `..` cannot climb above it. A leading `//` is
 * refused like a colon: to a URL it is a network-path reference, not a path,
 * and to `fjs/path` it is a UNC root, so neither reading is the relative or
 * rooted path the specifier spells. Three or more leading slashes are the
 * ordinary root followed by empty components.
 *
 * @type {(specifier: string) => string | null}
 */
export const decode = specifier =>
    specifier.includes(':') || specifier.includes('\\')
    || specifier.includes('?') || specifier.includes('#')
    || root(specifier) === '//'
        ? null
        : importFoldRejoin(specifier)
