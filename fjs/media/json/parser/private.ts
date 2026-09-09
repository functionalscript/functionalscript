/**
 * Implementation-private types of the JSON reader: the rules its readers
 * take apart, spelled from the grammar so that a reader is typed by the
 * rule it reads.
 *
 * @module
 */

import type { Rule } from '../../../ebnf/types.ts'
import type { string, ws } from '../../../ebnf/lib/json/module.f.mjs'

/**
 * The metadata of any alphabet a reader over this one may meet: a record
 * carrying the alphabet's `id`, as `../../../ebnf/ast/README.md` has it, so
 * that a reader generic over the output alphabet can still tell an input
 * leaf from a mapped position.
 */
export type _Alphabet = { readonly id: string }

/** The pair `cj` hands to `join`: an item, then its whitespace. */
export type _Item<R extends Rule> = readonly [R, typeof ws]

/**
 * One character of a string: the item of the repetition between the quotes,
 * a symbol as it stands or an escape.
 */
export type _Character = ReturnType<(typeof string)[1]>[3]

/**
 * What follows the backslash of an escape: the character of a simple escape,
 * or `u` and four hex digits.
 */
export type _Escape = _Character['escape'][1]

/** One hex digit of a `\u` escape, tagged by the range it is drawn from. */
export type _HexDigit = ReturnType<_Escape['u'][1]>[3]
