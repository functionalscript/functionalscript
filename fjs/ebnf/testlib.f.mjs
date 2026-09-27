/**
 * Helpers shared by the proofs of the EBNF front end and its grammars.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../website/demo/types.ts'
 */

import { assert } from '../asserts/module.f.mjs'
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
 * @type {(demo: Demo<null, DemoEvent>, titles: readonly (readonly [string, unknown])[]) => () => void}
 */
export const diagramPage = ({ init, view }, titles) => () => {
    const html = htmlToString(view(init))
    titles.forEach(([title]) => assert(html.includes(`<section id="${anchor(title)}"><h3>${title}</h3>`), title))
    const links = html.split('<a href="#').slice(1).map(after => after.slice(0, after.indexOf('"')))
    assert(links.length !== 0, html)
    links.forEach(link => assert(html.includes(`<section id="${link}">`), link))
}
