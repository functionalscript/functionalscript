/**
 * JSON as you type: a text field, and what this module's own reader and
 * writer make of it — parsed, then written back in normalized form.
 *
 * **The output is a round trip, not an echo.** Key order and whitespace are
 * not part of what a JSON document denotes, so writing the parsed value back
 * out canonicalizes both: keys sort, and the whole thing collapses onto one
 * line. A reader who pastes pretty-printed, out-of-order JSON sees the
 * `Unknown` this module's `parse` actually built from it, not their own text
 * reflected back.
 *
 * **A parse failure is shown, not swallowed.** `parse` returns a `Result`,
 * and the demo's whole job is showing what this module does with the text as
 * typed — including the text that does not parse, mid-edit or otherwise.
 *
 * **It needs no operations.** Parsing and serializing are pure functions of
 * the input, so `update` declares `never` and returns its next state through
 * `pureOk`.
 *
 * **The output is copyable**: it is a document or generated source a reader
 * can save and use elsewhere. Copy keeps the original output text.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 */

import { codeBlock } from '../../website/demo/code/module.f.mjs'
import { parse, stringify } from './module.f.mjs'
import { mapOk } from '../../types/result/module.f.mjs'
import { sort } from '../../types/object/module.f.mjs'
import { textDemo, caption, refusal } from '../../website/demo/module.f.mjs'

/**
 * `text` parsed and written back in normalized form — sorted keys, one line
 * — or the parser's own error, if `text` is not a document.
 *
 * @type {(text: string) => Result<string, string>}
 */
export const roundTrip = text => mapOk(stringify(sort))(parse(text))

/**
 * The state is the text itself, not the parse: the parse is a function of
 * it, and storing a value the state can already compute is how the two drift
 * apart.
 *
 * The initial text is out of order and pretty-printed on purpose — `b`
 * before `a`, and three lines — so the first thing a reader sees is both
 * undone.
 *
 * @type {Demo<string, DemoEvent>}
 */
export const demo = textDemo({
    intro: 'Parses JSON and writes it back on one line with object keys sorted. Arrays keep their element order; compare the result with the input to see the changes.',
    name: 'json',
    label: 'JSON',
    init: '{\n  "b": 2,\n  "a": [3, 2, 1],\n  "c": "hello"\n}',
})(text => {
    const [kind, value] = roundTrip(text)
    return kind === 'ok'
        ? [caption('Parsed, then written back:'), codeBlock(value, 'Copy JSON')]
        : [refusal(value)]
})
