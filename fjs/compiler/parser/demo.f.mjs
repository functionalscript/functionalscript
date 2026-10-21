/**
 * A FunctionalScript module as the AST the parser builds from it: type a
 * module, read the flat list of constants and the import list the
 * [`AST`](../ast/module.f.mjs) holds — `cref` references where a `const` is
 * shared, `arg` and `fref` where a function reads its parameters and its
 * frame.
 *
 * **The AST field is shown as DataJS text**, so it is the structure itself
 * and not a drawing of it. The parser also retains source binding facts for
 * admission and normalization. A shared constant is a `const` of its own
 * in the AST too, which is its reason for being a list.
 *
 * **A refusal is shown in the parser's own words** — `unexpected token`,
 * `unexpected end` — rather than as an empty box, and the shared examples
 * keep an unfinished module where a reader can see one.
 *
 * **It needs no operations.** Parsing is a pure function of the text, so
 * `update` declares `never` and returns through `pureOk`.
 *
 * **The listing is for inspection**, so it uses a neutral code box without
 * a copy button.
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
export const _astOf = parsed(({ ast }) => tryMarked(ast))

export const demo = stageDemo({
    intro: 'Parses a FunctionalScript module and shows its abstract syntax tree as DataJS. The constants and imports describe the structure passed to the next compiler stage.',
    name: 'parser',
})(text => {
    const [kind, value] = _astOf(text)
    return kind === 'ok'
        ? [caption('Abstract syntax tree, DataJS:'), ['pre', { [codeMarker]: '' }, ...render(value)]]
        : [refusal(value)]
})
