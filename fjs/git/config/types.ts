/**
 * Types for the repository's `config` file.
 *
 * @module
 */

import type { Nullable } from '../../types/nullable/types.ts'

/**
 * One `key = value` line as it sits in its section: the section's name,
 * lowercased with a subsection as written after a dot, the key
 * lowercased, and the value as text.
 */
export type Entry = readonly [section: string, key: string, value: string]

/**
 * What the reader of a subsection carries from one character to the next:
 * `sub` is the subsection so far, `escape` says a `\` stood before this
 * character, and `after` is the text past the closing quote, `null` while
 * the quote has yet to close.
 */
export type SubState = {
    readonly sub: string
    readonly escape: boolean
    readonly after: Nullable<string>
}

/**
 * What the reader of a value carries from one character to the next:
 * `value` is the value so far and `pending` the whitespace after it,
 * which is the value's only once a character that is none follows;
 * `quoted` and `escape` say where in the quoting the reader stands;
 * `done` says a comment has ended the value and `bad` that the line is
 * one Git refuses.
 */
export type ValueState = {
    readonly value: string
    readonly pending: string
    readonly quoted: boolean
    readonly escape: boolean
    readonly done: boolean
    readonly bad: boolean
}
