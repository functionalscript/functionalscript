/**
 * The shared half of every demo whose state is a text: a labelled textarea
 * holding it, and whatever the demo derives from it drawn after.
 *
 * **The demo supplies only its text and its `render`.** `update` and the
 * textarea are the same in every such demo, and the textarea's `id` and
 * `name` are what the page runtime's `refocus` and `resize` key on, so one
 * copy of them is one place that can break them, not five.
 *
 * **`render` answers a list of nodes, not one element**, spread after the
 * textarea: a demo that shows two things below its text shows them as
 * siblings, without a wrapper the page would not otherwise have.
 *
 * **With `examples`, it owns the drop-down too**: it builds the picker once,
 * as the demo is built — which is where a list with a repeated name or
 * source is refused — draws it above the textarea, and routes a pick to its
 * source. Without, there is no drop-down, and every `input` is the new text.
 *
 * **A textarea named like the drop-down is refused**, where the demo is
 * built: the two would share an `id`, and typing would arrive as a pick of
 * an example no one has.
 *
 * @module
 *
 * @import { Demo, DemoEvent, TextDemoOptions, TextFieldOptions } from './types.ts'
 * @import { Node, Element } from '../../media/html/types.ts'
 */

import { pureOk } from '../../effects/module.f.mjs'
import { examplePicker, name as exampleName } from './examples/module.f.mjs'

/**
 * A demo whose state is the text in a labelled textarea, followed by what
 * `render` draws from it.
 *
 * @type {(o: TextDemoOptions) => (render: (text: string) => readonly Node[]) => Demo<string, DemoEvent>}
 */
export const textDemo = ({ name, label, rows, init, examples }) => render => {
    if (examples !== undefined && name === exampleName) { throw 'textDemo: the textarea is named like the examples drop-down' }
    const picker = examples === undefined ? undefined : examplePicker(examples)
    return {
        init,
        update: picker === undefined
            ? state => event => pureOk(event.kind === 'input' ? event.value : state)
            : state => event => pureOk(event.kind !== 'input' ? state
                : event.name === exampleName ? picker.pick(event.value)
                    : event.value),
        view: text => ['div',
            ...(picker === undefined ? [] : [picker.view(text)]),
            textField({ name, label, rows }, text),
            ...render(text),
        ],
    }
}

/**
 * The labelled multiline field shared by textDemo and demos with more state.
 * @type {(o: TextFieldOptions, text: string) => Element}
 */
export const textField = ({ name, label, rows = 8 }, text) => ['p',
    ['label', { for: name }, `${label} `],
    ['textarea', { id: name, name, rows: String(rows) }, text],
]
