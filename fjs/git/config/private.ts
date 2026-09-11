/**
 * Implementation-private types for the config reader: what each of its two
 * character loops carries from one character to the next, which is the
 * loop's own business and no part of the entries it answers.
 *
 * @module
 */

import type { Nullable } from '../../types/nullable/types.ts'

/**
 * What the reader of a subsection carries from one character to the next:
 * `sub` is the subsection so far, `escape` says a `\` stood before this
 * character, and `after` is the text past the closing quote, `null` while
 * the quote has yet to close.
 */
export type _SubState = {
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
export type _ValueState = {
    readonly value: string
    readonly pending: string
    readonly quoted: boolean
    readonly escape: boolean
    readonly done: boolean
    readonly bad: boolean
}
