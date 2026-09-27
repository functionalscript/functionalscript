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
 * **It needs no operations**, and no state: the diagrams are a function of
 * the grammar alone, so `update` returns the state it was given through
 * `pureOk`.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../../../website/demo/types.ts'
 * @import { Element } from '../../../media/html/types.ts'
 * @import { Rule } from '../../types.ts'
 */

import { constStatement, dataJs, exportStatement, id, number, property, value } from './module.f.mjs'
import { character, escape, hex, string, uint, ws } from '../json/module.f.mjs'
import { toData } from '../../data/module.f.mjs'
import { branch, toDiagrams } from '../../railroad/module.f.mjs'
import { railroadSection } from '../../../website/demo/railroad/module.f.mjs'
import { assertNotNullish } from '../../../asserts/module.f.mjs'
import { pureOk } from '../../../effects/module.f.mjs'

const [ruleSet, entry, names] = toData(dataJs)

/** @type {(rule: Rule) => string} */
const nameOf = rule => assertNotNullish(names.get(rule))

const valueName = nameOf(value)

const valueBranch = branch(ruleSet)

/**
 * Each diagram's title and the lowered rule it draws, in the order the page
 * shows them: the document and its statements, the values they hold, then
 * the rules shared with JSON.
 *
 * @type {readonly (readonly [string, string])[]}
 */
export const diagrams = [
    ['dataJs', entry],
    ['constStatement', nameOf(constStatement)],
    ['exportStatement', nameOf(exportStatement)],
    ['value', valueName],
    ['object', valueBranch(valueName, 'object')],
    ['array', valueBranch(valueName, 'array')],
    ['property', nameOf(property)],
    ['id', nameOf(id)],
    ['number', nameOf(number)],
    ['string', nameOf(string)],
    ['character', nameOf(character)],
    ['escape', nameOf(escape)],
    ['hex', nameOf(hex)],
    ['uint', nameOf(uint)],
    ['ws', nameOf(ws)],
]

/** @type {Element} */
const view = ['div',
    ['p', 'The DataJS grammar of this module, drawn from its rules. Follow a track from left to right; a pill is text the input holds, and a box is another diagram — select it to go there.'],
    ...toDiagrams(ruleSet)(diagrams).map(railroadSection),
]

/** @type {Demo<null, DemoEvent>} */
export const demo = {
    init: null,
    update: state => () => pureOk(state),
    view: () => view,
}
