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
 * `unexpected end` — rather than as an empty box. `typeof x` is valid
 * JavaScript this parser does not take yet, and the shared examples keep it
 * where a reader can see that.
 *
 * **It needs no operations.** Parsing is a pure function of the text, so
 * `update` declares `never` and returns through `pureOk`.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 */

import { tryStringify } from '../../media/datajs/module.f.mjs'
import { error } from '../../types/result/module.f.mjs'
import { textDemo } from '../../website/demo/module.f.mjs'
import { examples } from '../examples/module.f.mjs'
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

export const demo = textDemo({ name: 'parser', label: 'Source', init: examples[0][1], examples })(text => {
    const [kind, value] = _astOf(text)
    return [kind === 'ok' ? ['pre', value] : ['p', `Refused: ${value}`]]
})
