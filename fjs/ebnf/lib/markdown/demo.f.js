/**
 * The Markdown inline grammar as syntax diagrams: one diagram per rule, each
 * reference to another rule a box that links to its diagram.
 *
 * **Drawn from this grammar, not redrawn by hand.** `toData` lowers the rules
 * this module exports, `fjs/ebnf/railroad` reads the lowered set back as
 * diagrams, and `fjs/website/demo/railroad` lays them out — so a change to
 * the grammar is a change to the picture.
 *
 * @module
 *
 * @import { Selection } from '../../../website/demo/railroad/types.ts'
 */

import { code, doubleBody, emAfterSpace, emAfterSpan, emAfterWord, emphasis, entry as markdown, link, span, strongRest, text } from './module.f.js'
import { codePoints } from '../../railroad/module.f.js'
import { codePointGuide, grammarDemo } from '../../../website/demo/railroad/module.f.js'

/**
 * Each diagram's title and the rule it draws, in the order the page
 * shows them: the entry, then the text and spans it alternates.
 * The span state owns a separate space state. Its path selects that
 * nested instance, so its recursive boxes link to its own diagram.
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
    ['strongRest', strongRest],
    ['emAfterWord', emAfterWord],
    ['emAfterSpan', emAfterSpan],
    ['emAfterSpanSpace', emAfterSpan, 'space', 1],
    ['emAfterSpace', emAfterSpace],
    ['link', link],
]

export const demo = grammarDemo({
    grammar: markdown,
    alphabet: codePoints,
    description: 'The Markdown inline grammar of this module, drawn from its rules.',
    guide: codePointGuide,
    selections: diagrams,
})
