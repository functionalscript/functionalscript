/**
 * The repository's `config` file, read for the one thing the readers
 * need from it: the id width. The file is Git's INI-like text — `[section]`
 * or `[section "subsection"]` lines, `key = value` lines under them,
 * comments from `#` or `;` — and {@link tryEntries} reads that shape and
 * no more: no quoting inside a value, no `\` continuation, no include,
 * since none of them reaches the key this module is for. A value is text
 * up to a comment, trimmed; a key without `=` is `true`, as Git reads it;
 * a section and a key are case-insensitive and read lowercased, a
 * subsection is case-sensitive and kept as written. A line that is
 * neither — a `[` without its `]`, a `=` with no key before it — is a
 * `bad config line` to Git, and the file is refused whole, as Git
 * refuses it.
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
 * does for Git; or `null` where a line is neither a section header nor
 * a key, which Git refuses as a bad config line.
 *
 * @type {(text: string) => Nullable<readonly Entry[]>}
 */
export const tryEntries = text => {
    const [, list] = text.split('\n').reduce(
        /** @type {(acc: readonly [string, Nullable<readonly Entry[]>], raw: string) => readonly [string, Nullable<readonly Entry[]>]} */
        ([section, list], raw) => {
            if (list === null) { return [section, null] }
            const line = raw.slice(0, commentAt(raw)).trim()
            if (line === '') { return [section, list] }
            if (line[0] === '[') {
                return line[line.length - 1] === ']' ? [sectionName(line.slice(1, -1)), list] : [section, null]
            }
            const eq = line.indexOf('=')
            const key = (eq === -1 ? line : line.slice(0, eq)).trim().toLowerCase()
            if (key === '') { return [section, null] }
            const value = eq === -1 ? bare : line.slice(eq + 1).trim()
            return [section, [...list, [section, key, value]]]
        },
        /** @type {readonly [string, Nullable<readonly Entry[]>]} */ (['', []]),
    )
    return list
}

/**
 * The last value of a key in a section, or `null` where the file sets
 * none.
 *
 * @type {(entries: readonly Entry[], section: string, key: string) => Nullable<string>}
 */
const last = (entries, section, key) => {
    const values = entries.flatMap(([s, k, value]) => s === section && k === key ? [value] : [])
    return values.length === 0 ? null : values[values.length - 1]
}

/**
 * The id width the file names, or `null` where the file is one Git
 * refuses: `extensions.objectFormat` absent — as in every repository
 * `git init` writes by default, which has no `[extensions]` section — or
 * `sha1` is 20 bytes; `sha256`, which `git init --object-format=sha256`
 * writes beside `repositoryformatversion = 1`, is 32. The value is
 * case-sensitive, as Git reads it: `SHA256` is refused. The key at all
 * needs `core.repositoryformatversion = 1`, since Git refuses the
 * extension under version 0 — `repo version is 0, but v1-only extension
 * found` — and a version other than 0 or 1 is refused whatever else the
 * file says, as is a file with a bad line.
 *
 * @type {(text: string) => Nullable<OidBytes>}
 */
export const tryOidBytes = text => {
    const entries = tryEntries(text)
    if (entries === null) { return null }
    const version = last(entries, 'core', 'repositoryformatversion') ?? '0'
    if (version !== '0' && version !== '1') { return null }
    const format = last(entries, 'extensions', 'objectformat')
    if (format === null) { return 20 }
    if (version !== '1') { return null }
    return format === 'sha1' ? 20 : format === 'sha256' ? 32 : null
}
