/**
 * A FunctionalScript module as the AST the parser builds from it: type a
 * module, read the flat list of constants and the import list the
 * [`AST`](../ast/module.f.mjs) holds — `cref` references where a `const` is
 * shared, `arg` and `fref` where a function reads its parameters and its
 * frame.
 *
 * **The AST is shown as the DataJS text of the value the parser returns**, so
 * it is the structure itself and not a drawing of it: what a reader sees is
 * what the next stage is handed. A shared constant is a `const` of its own
 * there too, which is the AST's reason for being a list.
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
 */

import { codeMarker } from '../../website/style/module.f.mjs'
import { tryStringify } from '../../media/datajs/module.f.mjs'
import { error } from '../../types/result/module.f.mjs'
import { textDemo, refusal, caption } from '../../website/demo/module.f.mjs'
import { highlight } from '../../website/demo/highlight/module.f.mjs'
import { examples } from '../examples/module.f.js'
import { parse } from '../transpiler/module.f.mjs'

/**
 * `text` as its AST, in DataJS, or the parser's message.
 *
 * @type {(text: string) => Result<string, string>}
 */
export const _astOf = text => {
    const result = parse('')(text)
    return result[0] === 'error' ? error(result[1].message) : tryStringify(result[1])
}

export const demo = textDemo({
    intro: 'Parses a FunctionalScript module and shows its abstract syntax tree as DataJS. The constants and imports describe the structure passed to the next compiler stage.',
    name: 'parser',
    label: 'Source',
    init: examples[0][1],
    examples,
})(text => {
    const [kind, value] = _astOf(text)
    return kind === 'ok'
        ? [caption('Abstract syntax tree, DataJS:'), ['pre', { [codeMarker]: '' }, ...highlight(value)]]
        : [refusal(value)]
})
