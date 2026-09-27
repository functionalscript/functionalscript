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

import { character, escape, hex, json, number, string, uint, value, ws } from './module.f.mjs'
import { toData } from '../../data/module.f.mjs'
import { branch, toDiagram } from '../../railroad/module.f.mjs'
import { anchor, railroadSvg } from '../../../website/demo/railroad/module.f.mjs'
import { assertNotNullish } from '../../../asserts/module.f.mjs'
import { pureOk } from '../../../effects/module.f.mjs'

const [ruleSet, entry, names] = toData(json)

/** @type {(rule: Rule) => string} */
const nameOf = rule => assertNotNullish(names.get(rule))

const valueName = nameOf(value)

const valueBranch = branch(ruleSet)

/**
 * Each diagram's title and the lowered rule it draws, in the order the page
 * shows them: the document first, then json.org's order.
 *
 * @type {readonly (readonly [string, string])[]}
 */
export const diagrams = [
    ['json', entry],
    ['value', valueName],
    ['object', valueBranch(valueName, 'object')],
    ['array', valueBranch(valueName, 'array')],
    ['string', nameOf(string)],
    ['character', nameOf(character)],
    ['escape', nameOf(escape)],
    ['hex', nameOf(hex)],
    ['number', nameOf(number)],
    ['uint', nameOf(uint)],
    ['ws', nameOf(ws)],
]

const diagramOf = toDiagram(ruleSet)(new Map(diagrams.map(([title, name]) => [name, title])))

/** @type {(diagram: readonly [string, string]) => Element} */
const section = ([title, name]) => ['section', { id: anchor(title) }, ['h3', title], railroadSvg(diagramOf(name))]

/** @type {Element} */
const view = ['div',
    ['p', 'The JSON grammar of this module, drawn from its rules. Follow a track from left to right; a pill is text the input holds, and a box is another diagram — select it to go there.'],
    ...diagrams.map(section),
]

/** @type {Demo<null, DemoEvent>} */
export const demo = {
    init: null,
    update: state => () => pureOk(state),
    view: () => view,
}
