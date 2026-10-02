/**
 * A FunctionalScript module as the `.js` module `fjs compile` writes for it:
 * type a module, read the source the serializer emits from the linked graph.
 *
 * **It is the `.js` output, not a lookalike.** The text is parsed and lowered
 * as the compiler does, then written by
 * [`tryModuleStringify`](./module.f.mjs), so what the page shows is what
 * the command would write: a value used twice becomes a `const`, a function is
 * written with its parameters renamed, named exports keep their names.
 *
 * **A refusal is shown in the compiler's own words.** A parse error is the
 * parser's, and a module that reads an import is the writer's — a browser has
 * no file set to link it from — rather than an empty box.
 *
 * **It needs no operations.** Parsing, lowering and writing are pure
 * functions of the text, so `update` declares `never` and returns through
 * `pureOk`.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 */

import { error } from '../../types/result/module.f.mjs'
import { textDemo } from '../../website/demo/module.f.mjs'
import { unresolved } from '../edag/module.f.mjs'
import { examples } from '../examples/module.f.mjs'
import { parse } from '../transpiler/module.f.mjs'
import { tryModuleStringify } from './module.f.mjs'

/**
 * `text` as a `.js` module, or why it is not one.
 *
 * @type {(text: string) => Result<string, string>}
 */
export const _sourceOf = text => {
    const result = parse('')(text)
    return result[0] === 'error' ? error(result[1].message) : tryModuleStringify(unresolved(result[1]).edag)
}

export const demo = textDemo({ name: 'serializer', label: 'Source', init: examples[0][1], examples })(text => {
    const [kind, value] = _sourceOf(text)
    return [kind === 'ok' ? ['pre', value] : ['p', `Refused: ${value}`]]
})
