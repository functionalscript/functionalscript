/**
 * The repository's `config` file, read for the one thing the readers
 * need from it: the id width. The file is Git's INI-like text — `[section]`
 * or `[section "subsection"]` lines, `key = value` lines under them,
 * comments from `#` or `;` — and {@link entries} reads that shape and no
 * more: no quoting inside a value, no `\` continuation, no include, since
 * none of them reaches the key this module is for. A value is text up to
 * a comment, trimmed; a key without `=` is `true`, as Git reads it; a
 * section and a key are case-insensitive and read lowercased, a
 * subsection is case-sensitive and kept as written.
 *
 * @module
 *
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { OidBytes } from '../types.ts'
 * @import { Entry } from './types.ts'
 */

/** The value Git gives a key written without one. */
const bare = /** @type {const} */ ('true')

/**
 * Where a comment begins in a line, or the line's length where none does:
 * `#` or `;`, whichever comes first.
 *
 * @type {(line: string) => number}
 */
const commentAt = line => {
    const hash = line.indexOf('#')
    const semi = line.indexOf(';')
    return hash === -1 ? (semi === -1 ? line.length : semi) : semi === -1 ? hash : Math.min(hash, semi)
}

/**
 * A section header's name: `[core]` is `core`, `[remote "origin"]` is
 * `remote.origin`, the name lowercased and the subsection as written.
 *
 * @type {(header: string) => string}
 */
const sectionName = header => {
    const quote = header.indexOf('"')
    if (quote === -1) { return header.trim().toLowerCase() }
    const name = header.slice(0, quote).trim().toLowerCase()
    const sub = header.slice(quote + 1, header.lastIndexOf('"'))
    return `${name}.${sub}`
}

/**
 * Every `key = value` of the file, with the section each sits in, in
 * order, so a key set twice is read twice and the last one wins as it
 * does for Git.
 *
 * @type {(text: string) => readonly Entry[]}
 */
export const entries = text => text.split('\n').reduce(
    /** @type {(acc: readonly [string, readonly Entry[]], raw: string) => readonly [string, readonly Entry[]]} */
    ([section, list], raw) => {
        const line = raw.slice(0, commentAt(raw)).trim()
        if (line === '') { return [section, list] }
        if (line[0] === '[' && line[line.length - 1] === ']') {
            return [sectionName(line.slice(1, -1)), list]
        }
        const eq = line.indexOf('=')
        const key = (eq === -1 ? line : line.slice(0, eq)).trim().toLowerCase()
        const value = eq === -1 ? bare : line.slice(eq + 1).trim()
        return [section, [...list, [section, key, value]]]
    },
    /** @type {readonly [string, readonly Entry[]]} */ (['', []]),
)[1]

/**
 * The id width the file names, or `null` where it names one this module
 * does not know: `extensions.objectFormat` absent or `sha1` — absent in
 * every repository `git init` writes by default, which has no
 * `[extensions]` section — is 20 bytes; `sha256`, which `git init
 * --object-format=sha256` writes beside `repositoryformatversion = 1`, is
 * 32. Any other value is refused, as Git refuses it. What Git does with
 * the extension under `repositoryformatversion = 0` is not checked here.
 *
 * @type {(text: string) => Nullable<OidBytes>}
 */
export const tryOidBytes = text => {
    const formats = entries(text).flatMap(([section, key, value]) =>
        section === 'extensions' && key === 'objectformat' ? [value.toLowerCase()] : [])
    const format = formats.length === 0 ? 'sha1' : formats[formats.length - 1]
    return format === 'sha1' ? 20 : format === 'sha256' ? 32 : null
}
