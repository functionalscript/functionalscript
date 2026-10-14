/**
 * The JSON grammar as syntax diagrams, the way [json.org](https://www.json.org/json-en.html)
 * draws JSON: one diagram per rule, each reference to another rule a box that
 * links to its diagram.
 *
 * **Drawn from this grammar, not redrawn by hand.** `toData` lowers the rules
 * this module exports, `fjs/ebnf/railroad` reads the lowered set back as
 * diagrams, and `fjs/website/demo/railroad` lays them out — so a change to
 * the grammar is a change to the picture, and the picture cannot describe a
 * JSON this module does not parse.
 *
 * **The diagrams are the rules a reader looks for.** Each exported rule gets
 * one under its export's name, and so do `array` and `object`, which the
 * grammar writes inline as branches of `value` — the only two found by their
 * branch rather than by their export.
 *
 * @module
 *
 * @import { Selection } from '../../../website/demo/railroad/types.ts'
 */

import { character, escape, hex, json, number, string, uint, value, ws } from './module.f.mjs'
import { codePoints } from '../../railroad/module.f.mjs'
import { codePointGuide, grammarDemo } from '../../../website/demo/railroad/module.f.mjs'

/**
 * Each diagram's title and the rule it draws, in the order the page
 * shows them: the document first, then json.org's order.
 *
 * @type {readonly Selection[]}
 */
export const diagrams = [
    ['json', json],
    ['value', value],
    ['object', value, 'object'],
    ['array', value, 'array'],
    ['string', string],
    ['character', character],
    ['escape', escape],
    ['hex', hex],
    ['number', number],
    ['uint', uint],
    ['ws', ws],
]

export const demo = grammarDemo({
    grammar: json,
    alphabet: codePoints,
    description: 'The JSON grammar of this module, drawn from its rules.',
    guide: codePointGuide,
    selections: diagrams,
})
