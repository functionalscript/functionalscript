/**
 * The Markdown inline grammar as syntax diagrams: one diagram per rule, each
 * reference to another rule a box that links to its diagram.
 *
 * **Drawn from this grammar, not redrawn by hand.** `toData` lowers the rules
 * this module exports, `fjs/ebnf/railroad` reads the lowered set back as
 * diagrams, and `fjs/website/demo/railroad` lays them out — so a change to
 * the grammar is a change to the picture.
 *
 * **Unpadded text is a loop.** Code and emphasis hold words separated by
 * runs of spaces, never starting or ending with one, which the grammar
 * spells as `join` does — a word, then any number of `spaces, word` — and
 * the diagram reads back as a loop through one or more spaces.
 *
 * @module
 *
 * @import { Rule } from '../../types.ts'
 */

import { code, emphasis, entry as markdown, link, span, text } from './module.f.mjs'
import { toData } from '../../data/module.f.mjs'
import { codePoints, toDiagrams } from '../../railroad/module.f.mjs'
import { railroadDemo } from '../../../website/demo/railroad/module.f.mjs'
import { assertNotNullish } from '../../../asserts/module.f.mjs'

const [ruleSet, entry, names] = toData(markdown)

/** @type {(rule: Rule) => string} */
const nameOf = rule => assertNotNullish(names.get(rule))

/**
 * Each diagram's title and the lowered rule it draws, in the order the page
 * shows them: the entry, then the text and spans it alternates.
 *
 * @type {readonly (readonly [string, string])[]}
 */
export const diagrams = [
    ['entry', entry],
    ['text', nameOf(text)],
    ['span', nameOf(span)],
    ['code', nameOf(code)],
    ['emphasis', nameOf(emphasis)],
    ['link', nameOf(link)],
]

export const demo = railroadDemo('The Markdown inline grammar of this module, drawn from its rules. Follow a track from left to right; a pill is text the input holds, and a box is another diagram — select it to go there.')(toDiagrams(codePoints)(ruleSet)(diagrams))
