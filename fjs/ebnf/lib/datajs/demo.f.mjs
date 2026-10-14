/**
 * The DataJS grammar as syntax diagrams: one diagram per rule, each reference
 * to another rule a box that links to its diagram — the same picture the
 * JSON grammar's page draws, for the format that extends it.
 *
 * **Drawn from this grammar, not redrawn by hand.** `toData` lowers the rules
 * this module exports, `fjs/ebnf/railroad` reads the lowered set back as
 * diagrams, and `fjs/website/demo/railroad` lays them out — so a change to
 * the grammar is a change to the picture.
 *
 * **The page stands on its own.** DataJS reuses JSON's `string`, `uint` and
 * `ws`, and a box links to a diagram on the same page, so those rules get
 * diagrams here too rather than boxes that lead nowhere. `array` and `object`
 * are titled by their branch of `value`, which is how the grammar writes
 * them.
 *
 * @module
 *
 * @import { Selection } from '../../../website/demo/railroad/types.ts'
 */

import { constStatement, dataJs, exportStatement, id, number, property, value } from './module.f.mjs'
import { character, escape, hex, string, uint, ws } from '../json/module.f.mjs'
import { codePoints } from '../../railroad/module.f.mjs'
import { codePointGuide, grammarDemo } from '../../../website/demo/railroad/module.f.mjs'

/**
 * Each diagram's title and the rule it draws, in the order the page
 * shows them: the document and its statements, the values they hold, then
 * the rules shared with JSON.
 *
 * @type {readonly Selection[]}
 */
export const diagrams = [
    ['dataJs', dataJs],
    ['constStatement', constStatement],
    ['exportStatement', exportStatement],
    ['value', value],
    ['object', value, 'object'],
    ['array', value, 'array'],
    ['property', property],
    ['id', id],
    ['number', number],
    ['string', string],
    ['character', character],
    ['escape', escape],
    ['hex', hex],
    ['uint', uint],
    ['ws', ws],
]

export const demo = grammarDemo({
    grammar: dataJs,
    alphabet: codePoints,
    description: 'The DataJS grammar of this module, drawn from its rules.',
    guide: codePointGuide,
    selections: diagrams,
})
