/**
 * Type-level API of the JSON reader: the numeric policy a codec supplies,
 * the tree that policy parses into, and the output alphabet the reader's
 * mappings return into — the input alphabet is `../../../ebnf/utf16/types.ts`.
 *
 * @module
 */

import type { Tree } from '../types.ts'
import type { Result } from '../../../types/result/types.ts'

/**
 * A numeric policy: how one codec materializes a JSON number into its own
 * numeric domain `P`.
 *
 * The policy is handed the number's exact lexeme, as the grammar admits it —
 * `-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?` — before any narrowing the
 * reader might otherwise have imposed. It may fail: a valid JSON number can
 * be outside the domain the codec offers (the extended codec has no
 * non-finite `number`), and that has to be an ordinary parse error, its
 * message the policy's, rather than an escaping runtime exception.
 */
export type NumberPolicy<P> = (lexeme: string) => Result<P, string>

/**
 * The tree a numeric policy `P` parses into: JSON's containers over `P` plus
 * the primitives every policy shares.
 */
export type ParseUnknown<P> = Tree<P | null | boolean | string>

/**
 * What the `string` rule's mapping returns: the string the rule spells,
 * every escape decoded.
 */
export type Text = { readonly id: 'text', readonly value: string }

/**
 * What a value's mapping returns: the JSON value, or, where the policy
 * refused a number under it, the policy's error in the value's place.
 */
export type Json<P> = { readonly id: 'json', readonly result: Result<ParseUnknown<P>, string> }

/** The output alphabet: what the mappings return. */
export type Out<P> = Text | Json<P>
