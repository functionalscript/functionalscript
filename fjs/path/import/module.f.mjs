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
 * Separate a path-like spelling before percent decoding. Empty components are
 * omitted, as in Node's default realpath-based file-module profile. The suffix
 * text stays opaque here; native URL normalization belongs to the host.
 * @type {(specifier: string) => { readonly path: string, readonly suffix: string }}
 */
export const components = specifier => {
    const [head, ...fragments] = specifier.split('#')
    const [path, ...queries] = head.split('?')
    const query = queries.join('?')
    const fragment = fragments.join('#')
    return { path, suffix: (query === '' ? '' : `?${query}`) + (fragment === '' ? '' : `#${fragment}`) }
}

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
 * Resolve an import's URL-path spelling against its importing file, or return
 * null for an unsupported segment. Decode only the specifier, once, and before
 * normalization: escaped dots have their URL meaning, but decoded filesystem
 * delimiters cannot create a new root or segment. The importing path is
 * already a filesystem path and must not be decoded again.
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

/** Decode admitted portable URL-path segments, without resolving a module identity. @type {(specifier: string) => string | null} */
export const decode = specifier => {
    const segments = specifier.split('/').map(importSegment)
    return segments.every(segment => segment !== null) ? segments.join('/') : null
}
