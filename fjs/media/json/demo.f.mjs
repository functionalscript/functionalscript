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
 * @module
 *
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 */

import { parse, stringify } from './module.f.mjs'
import { sort } from '../../types/object/module.f.mjs'
import { pureOk } from '../../effects/module.f.mjs'

/**
 * `text` parsed and written back in normalized form — sorted keys, one line
 * — or the parser's own error, if `text` is not a document.
 *
 * @type {(text: string) => string}
 */
export const roundTrip = text => {
    const result = parse(text)
    return result[0] === 'error' ? `Error: ${result[1]}` : stringify(sort)(result[1])
}

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
export const demo = {
    init: '{\n  "b": 2,\n  "a": [3, 2, 1],\n  "c": "hello"\n}',
    update: state => event => pureOk(event.kind === 'input' ? event.value : state),
    view: text => ['div',
        ['p',
            ['label', { for: 'json' }, 'JSON '],
            ['textarea', { id: 'json', name: 'json', rows: '6' }, text],
        ],
        ['p', 'Parsed, then written back:'],
        ['pre', roundTrip(text)],
    ],
}
