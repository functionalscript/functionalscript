/**
 * The JavaScript token grammar as syntax diagrams: one diagram per rule,
 * each reference to another rule a box that links to its diagram.
 *
 * **Drawn from this grammar, not redrawn by hand.** `toData` lowers the rules
 * this module exports, `fjs/ebnf/railroad` reads the lowered set back as
 * diagrams, and `fjs/website/demo/railroad` lays them out — so a change to
 * the grammar is a change to the picture.
 *
 * **Some rules are titled by their branch.** A string's two quotings, and
 * `star` — the `*` inside a comment, which `content` and it reach each other
 * through — are written inline and not exported, so they are found as the
 * branches that reach them. `star` needs its title: the two recurse into
 * each other, and a cycle has to pass through a box. The rules shared with
 * JSON get diagrams here too, so no box leads off the page.
 *
 * **`operator` is the prefix tree `literals` builds**, one branch per first
 * character, so `>`, `>>`, `>>=`, `>>>` and `>>>=` share a track for as long
 * as they share characters.
 *
 * @module
 *
 * @import { Rule } from '../../types.ts'
 */

import { content, id, newLine, number, operator, slash, string, token, ws } from './module.f.mjs'
import { escape, hex } from '../json/module.f.mjs'
import { toData } from '../../data/module.f.mjs'
import { branch, toDiagrams } from '../../railroad/module.f.mjs'
import { railroadDemo } from '../../../website/demo/railroad/module.f.mjs'
import { assertNotNullish } from '../../../asserts/module.f.mjs'

const [ruleSet, entry, names] = toData(token)

/** @type {(rule: Rule) => string} */
const nameOf = rule => assertNotNullish(names.get(rule))

const branchOf = branch(ruleSet)

const stringName = nameOf(string)

const contentName = nameOf(content)

/**
 * Each diagram's title and the lowered rule it draws, in the order the page
 * shows them: the token, its kinds in the order `token` lists them, then
 * the rules shared with JSON.
 *
 * @type {readonly (readonly [string, string])[]}
 */
export const diagrams = [
    ['token', entry],
    ['number', nameOf(number)],
    ['string', stringName],
    ['double', branchOf(stringName, 'double')],
    ['single', branchOf(stringName, 'single')],
    ['id', nameOf(id)],
    ['slash', nameOf(slash)],
    ['content', contentName],
    ['star', branchOf(contentName, 'star')],
    ['operator', nameOf(operator)],
    ['ws', nameOf(ws)],
    ['newLine', nameOf(newLine)],
    ['escape', nameOf(escape)],
    ['hex', nameOf(hex)],
]

export const demo = railroadDemo('The JavaScript token grammar of this module, drawn from its rules. Follow a track from left to right; a pill is text the input holds, and a box is another diagram — select it to go there.')(toDiagrams(ruleSet)(diagrams))
