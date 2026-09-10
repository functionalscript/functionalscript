/**
 * Type-level API of the JavaScript token grammar: the block comment's
 * content, which names itself and so is spelled here, as `JsonValue` is in
 * `../json/types.ts` — a named type that a `const` binding may be annotated
 * with.
 *
 * @module
 */

import type { Set } from '../../types.ts'

/**
 * The content of a block comment: a `*` and what follows it, any other
 * symbol and more content, or nothing — the end of input, unterminated.
 */
export type Content = () => readonly ['const', {
    readonly star: readonly ['*', AfterStar]
    readonly other: readonly [Set, Content]
    readonly unterminated: ''
}]

/**
 * What follows a `*`: the `/` that ends the comment, another `*`, a symbol
 * that is neither and more content, or nothing — unterminated.
 */
export type AfterStar = () => readonly ['const', {
    readonly end: '/'
    readonly star: readonly ['*', AfterStar]
    readonly other: readonly [Set, Content]
    readonly unterminated: ''
}]
