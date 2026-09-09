/**
 * Type-level API of the JSON reader: the output alphabet its mappings
 * return into — the input alphabet is `../../../utf16/types.ts` — and what
 * it reports where a text is no JSON document.
 *
 * @module
 */

import type { Unknown } from '../../../../media/json/types.ts'
import type { Result } from '../../../../types/result/types.ts'

/**
 * What the `string` rule's mapping returns: the string the rule spells,
 * every escape decoded.
 */
export type Text = { readonly id: 'text', readonly value: string }

/**
 * A number the finite `number` range cannot hold — `1e400` — given by its
 * lexeme. It is the one thing in a JSON text that is no JSON value, and so
 * the one error a mapping has to report.
 */
export type OutOfRange = readonly ['range', lexeme: string]

/**
 * What a value's mapping returns: the JSON value, or, where a number under
 * it is out of range, that error in the value's place.
 */
export type Json = { readonly id: 'json', readonly result: Result<Unknown, OutOfRange> }

/** The output alphabet: what the mappings return. */
export type Out = Text | Json

/**
 * A parse that failed: the index of the symbol it failed at, the input's
 * length where it ran out.
 */
export type Syntax = readonly ['syntax', at: number]

/** Why a text is no JSON document. */
export type Error = Syntax | OutOfRange
