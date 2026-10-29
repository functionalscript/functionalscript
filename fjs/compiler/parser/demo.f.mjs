/**
 * Inspect a FunctionalScript module after source resolution: import bindings,
 * original declaration identities, parameter plans and lexical control blocks.
 * The common sugar pass expands this structure into normalized FAST.
 *
 * **The source structure is shown as DataJS text**, so it is the structure
 * itself rather than a drawing. The parser retains source binding evidence
 * alongside it for admission and normalization.
 *
 * **A refusal is shown in the parser's own words** — `unexpected token`,
 * `unexpected end` — rather than as an empty box, and the shared examples
 * keep an unfinished module where a reader can see one.
 *
 * **It needs no operations.** Parsing is a pure function of the text, so
 * `update` declares `never` and returns through `pureOk`.
 *
 * **The listing is for inspection**, so it uses a neutral code box without
 * a copy button. Under it, a link leads to [the sugar page](../sugar/demo.f.mjs),
 * which draws the same tree as a graph beside the FAST it normalizes to:
 * this page shows the parser's output, and that one what the next stage
 * makes of it.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { Marked } from '../../text/marked/types.ts'
 */

import { codeMarker } from '../../website/style/module.f.js'
import { tryMarked } from '../../media/datajs/module.f.mjs'
import { refusal, caption } from '../../website/demo/module.f.mjs'
import { render } from '../../website/demo/highlight/module.f.mjs'
import { parsed, stageDemo } from '../stage_demo/module.f.mjs'

/**
 * `text` as its AST, in DataJS, or the parser's message.
 *
 * @type {(text: string) => Result<Marked, string>}
 */
export const _astOf = parsed(({ imports, body }) => tryMarked({ imports, body }))

export const demo = stageDemo({
    intro: 'Parses a FunctionalScript module and shows its abstract syntax tree as DataJS. The blocks, bindings and parameter plans describe the resolved source passed to the sugar stage.',
    name: 'parser',
})(text => {
    const [kind, value] = _astOf(text)
    return kind === 'ok'
        ? [
            caption('Abstract syntax tree, DataJS:'),
            ['pre', { [codeMarker]: '' }, ...render(value)],
            ['p', 'Drawn as a graph, beside the FAST it normalizes to, on ', ['a', { href: '../sugar/' }, 'compiler/sugar'], '.'],
        ]
        : [refusal(value)]
})
