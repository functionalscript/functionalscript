/**
 * The UTF-16 alphabet: a text as the parser reads it, one symbol per code
 * unit, each carrying the alphabet's metadata — and back: {@link units}
 * turns a text into the symbols a parser reads, and {@link lexeme} turns a
 * parsed subtree back into the text it spells.
 *
 * Code units rather than code points, so that every unit of a JavaScript
 * string is a symbol like any other and a grammar over this alphabet reads
 * a string as the sequence of units it spells: a lone surrogate is one
 * symbol, where a decoder to code points tags it as an error before any
 * grammar sees it. A grammar over code points reads its input through
 * `stringToCodePointList` instead, with an alphabet of its own.
 *
 * The id `utf16` names input symbols and nothing else. A mapping's output
 * alphabet carries an id of its own — `text`, `json` — as `Meta`'s doc in
 * `../ast/types.ts` asks of every alphabet, so a leaf with this id is an
 * input symbol, and {@link unitAt} tells one by it.
 *
 * @module
 *
 * @import { Meta } from '../ast/types.ts'
 * @import { Utf16 } from './types.ts'
 */

import { assert } from '../../asserts/module.f.mjs'
import { listToString, stringToList } from '../../text/utf16/module.f.mjs'
import { toArray } from '../../types/list/module.f.mjs'
import { isUintUpTo } from '../../types/number/module.f.mjs'

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

const isUnit = isUintUpTo(0xFFFF)

/**
 * The code unit of one input leaf.
 *
 * The parameter is `unknown` because no caller holds a type that could
 * carry the contract — a mapping reads a position typed over its output
 * alphabet too — so the check is here, on the leaf whole: its `meta.id` is
 * `utf16` and its `symbol` is a code unit.
 *
 * @throws On anything else: a node, a mapped leaf, whose mapping replaced
 * what it consumed, or a leaf whose `symbol` spells no code unit.
 *
 * @type {(node: unknown) => number}
 */
export const unitAt = node => {
    assert(typeof node === 'object' && node !== null && !(node instanceof Array))
    /** @type {{ readonly symbol?: unknown, readonly meta?: unknown }} */
    const leaf = node
    const { symbol, meta } = leaf
    assert(typeof meta === 'object' && meta !== null)
    /** @type {{ readonly id?: unknown }} */
    const { id } = meta
    assert(id === utf16.id && isUnit(symbol))
    return symbol
}

/**
 * The code units under a subtree, in order. A string is a variant's tag
 * only in a variant's position — the first of a tuple of exactly two, the
 * tag and its one child, as `Ast` shapes a variant — and is passed over
 * there alone; anywhere else it reaches {@link unitAt}, which refuses it.
 *
 * @type {(node: unknown) => readonly number[]}
 */
const unitsUnder = node =>
    !(node instanceof Array) ? [unitAt(node)] :
    node.length === 2 && typeof node[0] === 'string' ? unitsUnder(node[1]) :
    node.flatMap(child => unitsUnder(child))

/**
 * The source text under a parsed subtree: every leaf's code unit, in order.
 *
 * @throws On a leaf that is not a `utf16` symbol — a mapped leaf has no
 * source to give back, since its mapping replaced what it consumed — and on
 * a string anywhere but a variant's tag, so a tree that is not one is
 * refused rather than answered with text it does not have.
 *
 * @type {(node: unknown) => string}
 */
export const lexeme = node => listToString(unitsUnder(node))
