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
 * Copyable code blocks share their markup and accessible feedback controls
 * here. Shell arguments use one quoting helper so input remains literal text.
 *
 * @module
 *
 * @import { Demo, DemoEvent, TextDemoOptions } from './types.ts'
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
export const textDemo = ({ name, label, rows = 8, init, examples }) => render => {
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
            ['p',
                ['label', { for: name }, `${label} `],
                ['textarea', { id: name, name, rows: String(rows) }, text],
            ],
            ...render(text),
        ],
    }
}

/** @type {(text: string, label: string) => Element} */
export const codeBlock = (text, label) => ['div', { 'data-code': '', 'data-code-block': '' },
    ['pre', text],
    ['button', { type: 'button', 'data-copy': text, 'aria-label': label, title: label },
        ['svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'aria-hidden': 'true' },
            ['path', { d: 'M6 9H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2' }],
            ['rect', { x: '9', y: '3', width: '12', height: '12', rx: '1' }],
        ],
        ['svg', { 'data-copy-check': '', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
            ['path', { d: 'm5 12 4 4 10-10' }],
        ],
        ['span', { 'data-copy-status': '', 'aria-live': 'polite' }],
    ],
]

/** A POSIX shell argument whose quotes and shell syntax remain literal text.
 * @type {(text: string) => string}
 */
export const shellQuote = text => `'${text.replaceAll("'", "'\\''")}'`
