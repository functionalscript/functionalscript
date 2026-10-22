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
 * @import { Selection } from '../../../website/demo/railroad/types.ts'
 */

import { code, doubleBody, emphasis, entry as markdown, link, span, text } from './module.f.mjs'
import { codePoints } from '../../railroad/module.f.mjs'
import { codePointGuide, grammarDemo } from '../../../website/demo/railroad/module.f.mjs'

/**
 * Each diagram's title and the rule it draws, in the order the page
 * shows them: the entry, then the text and spans it alternates.
 *
 * @type {readonly Selection[]}
 */
export const diagrams = [
    ['entry', markdown],
    ['text', text],
    ['span', span],
    ['code', code],
    ['doubleBody', doubleBody],
    ['emphasis', emphasis],
    ['link', link],
]

export const demo = grammarDemo({
    grammar: markdown,
    alphabet: codePoints,
    description: 'The Markdown inline grammar of this module, drawn from its rules.',
    guide: codePointGuide,
    selections: diagrams,
})
