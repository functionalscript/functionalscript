/**
 * An issue's header, read from its text: the status and the priority
 * [`todo/README.md`](../../../todo/README.md#issue-format) gives every issue.
 *
 * **The values live here, once.** The two tables in `todo/README.md` point at
 * {@link statuses} and {@link priorities}, so a new value is one change, made
 * in the pull request that introduces it.
 *
 * **A field is a value, optionally followed by ` — ` and a note.** The note is
 * not read: `open — needs a decision` is `open`, and so is a note that runs on
 * to the following lines, since only the field's own line is looked at.
 *
 * **A missing or unknown value is refused, not guessed.** The likely unknown
 * value is a typo — `opne`, `in progress` — and a default would publish it
 * looking normal
 * ([DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)).
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { Header } from './types.ts'
 */

import { error, ok } from '../../types/result/module.f.js'

/**
 * Every status, in the order a page lists them: work in progress first, then
 * work not started, then work waiting or deferred, then the record, then what
 * will not be done.
 */
export const statuses = /** @type {const} */ (['wip', 'open', 'blocked', 'on-hold', 'done', 'irrelevant', "won't fix"])

/** Every priority, most urgent first. */
export const priorities = /** @type {const} */ (['P1', 'P2', 'P3', 'P4', 'P5'])

/**
 * Whether a file in a `todo/` is an issue: a markdown file other than
 * `README.md`, which documents its directory. A `todo/` may hold something
 * else — the repository root's holds `proof.f.mjs`, an authored module the
 * suite runs — and the list says what it means instead of showing whatever
 * the folder happens to contain.
 *
 * @type {(name: string) => boolean}
 */
export const isIssue = name => name.endsWith('.md') && name !== 'README.md'

/** The separator between a field's value and its note. */
const noteSeparator = ' — '

/**
 * The value of the `**name:**` field — the first line that opens with it, up
 * to its note — or `null` where no line does.
 *
 * @type {(name: string) => (text: string) => string | null}
 */
const field = name => text => {
    const prefix = `**${name}:** `
    const line = text.split('\n').find(line => line.startsWith(prefix))
    if (line === undefined) { return null }
    const rest = line.slice(prefix.length)
    const note = rest.indexOf(noteSeparator)
    return (note === -1 ? rest : rest.slice(0, note)).trimEnd()
}

/**
 * The `**name:**` field's value, if it is one of `values`.
 *
 * @template {string} T
 * @param {readonly T[]} values
 * @returns {(name: string) => (text: string) => Result<T, string>}
 */
const oneOf = values => name => text => {
    const value = field(name)(text)
    if (value === null) { return error(`no \`**${name}:**\` line`) }
    const found = values.find(v => v === value)
    return found === undefined ? error(`unknown ${name.toLowerCase()} \`${value}\``) : ok(found)
}

const status = oneOf(statuses)('Status')

const priority = oneOf(priorities)('Priority')

/**
 * The status and priority of an issue, from its text.
 *
 * @type {(text: string) => Result<Header, string>}
 */
export const header = text => {
    const s = status(text)
    if (s[0] === 'error') { return s }
    const p = priority(text)
    if (p[0] === 'error') { return p }
    return ok({ status: s[1], priority: p[1] })
}
