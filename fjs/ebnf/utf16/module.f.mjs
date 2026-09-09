/**
 * The UTF-16 alphabet: a text as the parser reads it, one symbol per code
 * unit, each carrying the alphabet's metadata.
 *
 * Code units rather than code points, so that every unit of a JavaScript
 * string is a symbol like any other and a grammar over this alphabet reads
 * a string as the sequence of units it spells: a lone surrogate is one
 * symbol, where a decoder to code points tags it as an error before any
 * grammar sees it. A grammar over code points reads its input through
 * `stringToCodePointList` instead, with an alphabet of its own.
 *
 * @module
 *
 * @import { Meta } from '../ast/types.ts'
 * @import { Utf16 } from './types.ts'
 */

import { stringToList } from '../../text/utf16/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'

/**
 * The metadata of every unit: one frozen record, shared by every leaf, so
 * that a parse allocates nothing per symbol beyond the leaf itself.
 *
 * @type {Utf16}
 */
export const utf16 = { id: 'utf16' }

/** @type {(symbol: number) => Meta<Utf16>} */
const unit = symbol => ({ symbol, meta: utf16 })

/**
 * The input a parser over this alphabet is given: the code units of a
 * text, in order, each with the shared metadata.
 *
 * @type {(text: string) => readonly Meta<Utf16>[]}
 */
export const units = text => toArray(stringToList(text)).map(unit)
