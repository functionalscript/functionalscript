/**
 * Helpers shared by the proofs of the EBNF front end and its grammars.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../website/demo/types.ts'
 * @import { Meta } from './ast/types.ts'
 * @import { MatchResult, Parser } from './ll1/types.ts'
 */

import { assert } from '../asserts/module.f.js'
import { htmlToString } from '../media/html/module.f.mjs'
import { anchor } from '../website/demo/railroad/module.f.mjs'

const { entries, fromEntries } = Object

/**
 * Expands a rule into plain data by calling every thunk it meets, so two
 * independently built rules can be compared structurally: a thunk is a
 * function, and functions are only ever the same as themselves.
 *
 * There is no depth limit, so this terminates on a rule that does not name
 * itself. A grammar that does — `json`, `dataJs` — is expanded by hand in
 * its proof, one thunk at a time.
 *
 * @type {(r: unknown) => unknown}
 */
export const force = r => {
    if (typeof r === 'function') { return force(r()) }
    if (r instanceof Array) { return r.map(force) }
    if (typeof r === 'object' && r !== null) {
        return fromEntries(entries(r).map(([k, v]) => [k, force(v)]))
    }
    return r
}

/**
 * A proof that a grammar's diagram page is whole: a section for every title,
 * in the element its boxes link to, and a section for every box — a box
 * whose rule has no diagram on the page would be a link to nothing.
 *
 * @type {(demo: Demo<null, DemoEvent>, titles: readonly (readonly [string, ...unknown[]])[]) => () => void}
 */
export const diagramPage = ({ init, view }, titles) => () => {
    const html = htmlToString(view(init))
    titles.forEach(([title]) => assert(html.includes(`<section id="${anchor(title)}"><h3>${title}</h3>`), title))
    const links = html.split('<a href="#').slice(1).map(after => after.slice(0, after.indexOf('"')))
    assert(links.length !== 0, html)
    links.forEach(link => assert(html.includes(`<section id="${link}">`), link))
}

/**
 * A recognizer over a parser: whether the input is accepted with every symbol
 * consumed, and the parser's answer that decided it — the `MatchResult` of
 * its last match — as the diagnostic, so a refusal says where.
 *
 * `decode` is the alphabet: a text grammar's code units or code points,
 * with whatever metadata the grammar's parser reads. A match that ends
 * short of the input is resumed where it ended, so a token layer's
 * one-token grammar recognizes a text as a run of tokens, and a grammar
 * ending in `eof` is matched once. The grammar is asked at least once, so
 * the empty input is accepted only where it matches empty, and a match
 * that consumes nothing short of the end is a refusal rather than a loop.
 *
 * @template I
 * @param {Parser<unknown, I>} parse
 * @param {(input: string) => readonly Meta<I>[]} decode
 * @returns {(input: string) => { readonly accepted: boolean, readonly diagnostic: MatchResult<unknown> }}
 */
export const recognizer = (parse, decode) => input => {
    const symbols = decode(input)
    let start = 0
    while (true) {
        const diagnostic = parse(symbols, start)
        const [tag, value] = diagnostic
        if (tag === 'error') { return { accepted: false, diagnostic } }
        const [, end] = value
        if (end === symbols.length || end === start) { return { accepted: end === symbols.length, diagnostic } }
        start = end
    }
}

/**
 * A proof that a recognizer answers each case as expected — `true` for an
 * input it must accept whole, `false` for one it must refuse — failing with
 * `[input, diagnostic]`, the corpus row and the parser's answer to it.
 *
 * @type {(recognize: (input: string) => { readonly accepted: boolean, readonly diagnostic: unknown }) =>
 *  (cases: readonly (readonly [input: string, accepted: boolean])[]) => void}
 */
export const assertRecognizes = recognize => cases => cases.forEach(([input, expected]) => {
    const { accepted, diagnostic } = recognize(input)
    assert(accepted === expected, [input, diagnostic])
})
