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
 * @import { Selection } from '../../../website/demo/railroad/types.ts'
 */

import { content, id, newLine, number, operator, slash, string, template, templateAfterDollar, templateContent, templateEscape, token, ws } from './module.f.mjs'
import { escape, hex } from '../json/module.f.mjs'
import { codePoints } from '../../railroad/module.f.mjs'
import { codePointGuide, grammarDemo } from '../../../website/demo/railroad/module.f.mjs'

/**
 * Each diagram's title and the rule it draws, in the order the page
 * shows them: the token, its kinds in the order `token` lists them, then
 * the rules shared with JSON.
 *
 * @type {readonly Selection[]}
 */
export const diagrams = [
    ['token', token],
    ['number', number],
    ['string', string],
    ['double', string, 'double'],
    ['single', string, 'single'],
    ['template', template],
    ['templateContent', templateContent],
    ['templateAfterDollar', templateAfterDollar],
    ['templateEscape', templateEscape],
    ['id', id],
    ['slash', slash],
    ['content', content],
    ['star', content, 'star'],
    ['operator', operator],
    ['ws', ws],
    ['newLine', newLine],
    ['escape', escape],
    ['hex', hex],
]

export const demo = grammarDemo({
    grammar: token,
    alphabet: codePoints,
    description: 'The JavaScript token grammar of this module, drawn from its rules.',
    guide: codePointGuide,
    selections: diagrams,
})
