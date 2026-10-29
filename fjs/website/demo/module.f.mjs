/**
 * The shared half of every demo whose state is a text: a labelled textarea
 * holding it, and whatever the demo derives from it drawn after. A required
 * intro opens the view before the examples and textarea.
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
 * @import { Demo, DemoEvent, DragAxis, DragBounds, TextDemoOptions, TextFieldOptions, InputFieldOptions, RadioOption } from './types.ts'
 * @import { StringMap } from '../../types/object/types.ts'
 * @import { Effect } from '../../effects/types.ts'
 * @import { Node, Element } from '../../media/html/types.ts'
 */

import { textSharing } from './sharing/module.f.mjs'
import { at } from '../../types/object/module.f.mjs'
import { pureOk } from '../../effects/module.f.mjs'
import { examplePicker, name as exampleName } from './examples/module.f.mjs'
import { captionMarker, editorMarker, mirrorMarker, resultMarker } from '../style/module.f.js'
import { max } from '../../types/number/max/module.f.js'
import { min } from '../../types/number/min/module.f.js'

export { option, selectField, button } from './controls/module.f.js'

/**
 * A demo whose state is the text in a labelled textarea, followed by what
 * `render` draws from it.
 *
 * @type {(o: TextDemoOptions) => (render: (text: string) => readonly Node[]) => Demo<string, DemoEvent>}
 */
export const textDemo = ({ intro, name, label, rows, init, examples, highlight }) => render => {
    if (examples !== undefined && name === exampleName) { throw 'textDemo: the textarea is named like the examples drop-down' }
    const picker = examples === undefined ? undefined : examplePicker(examples)
    return {
        sharing: textSharing(name, init, examples),
        init,
        update: picker === undefined
            ? state => event => pureOk(event.kind === 'input' ? event.value : state)
            : state => event => pureOk(event.kind !== 'input' ? state
                : event.name === exampleName ? picker.pick(event.value)
                    : event.value),
        view: text => ['div',
            ['p', intro],
            ...(picker === undefined ? [] : [picker.view(text)]),
            textField({ name, label, rows, highlight }, text),
            ...render(text),
        ],
    }
}

/**
 * What a field that holds code asks of the browser: no spell checking, which
 * underlines every keyword it does not know — and the textarea's own text is
 * transparent, so the reader sees a squiggle with no word under it — and no
 * completion, capitalization or correction of what is typed.
 */
const notProse = { spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off' }

/**
 * The labelled multiline field shared by textDemo and demos with more state.
 *
 * **With `highlight`, the textarea is drawn over a coloured copy of its text**:
 * a `span` the stylesheet marks as the field's mirror (a `span`, so the label's
 * `p` stays valid HTML), laid under a textarea
 * whose own text is transparent, so the reader types into the colours and the
 * caret, selection and undo stay the browser's, and a field that holds code
 * is not prose for the browser: {@link notProse}. The mirror ends in a zero-width
 * space, so a final empty line takes the room it takes in the textarea. It is
 * hidden from assistive technology, which reads the textarea.
 *
 * @type {(o: TextFieldOptions, text: string) => Element}
 */
export const textField = ({ name, label, rows = 8, highlight }, text) => {
    /** @type {Element} */
    const area = ['textarea', { id: name, name, rows: String(rows), ...(highlight === undefined ? {} : notProse) }, text]
    /** @type {Element} */
    const field = highlight === undefined ? area : ['span', { [editorMarker]: '' },
        ['span', { [mirrorMarker]: '', 'aria-hidden': 'true' }, ...highlight(text), '\u200b'],
        area]
    return ['p', ['label', { for: name }, `${label} `], field]
}

/** A labelled single-line field filling its containing column.
 * @type {(o: InputFieldOptions, value: string) => Element}
 */
export const inputField = ({ name, label }, value) => ['p',
    ['label', { for: name }, `${label} `],
    ['input', { type: 'text', id: name, name, value }],
]

/** A choice from a few options that all stay visible: a group of inline
 * radio buttons sharing `name`, under a legend saying what is chosen. Each
 * option's `id` is `name` and its value joined by `-`, so it is unique on the
 * page as long as `name` is.
 * @type {(name: string, label: string, options: readonly RadioOption[], value: string) => Element}
 */
export const radios = (name, label, options, value) => ['fieldset', { 'data-radios': '' },
    ['legend', label],
    ['div', ...options.map(/** @returns {Element} */ option => ['label', { for: `${name}-${option.value}` },
        ['input', { type: 'radio', id: `${name}-${option.value}`, name, value: option.value, ...(option.value === value ? { checked: '' } : {}) }],
        option.label,
    ])],
]

/** A caption naming the result drawn after it: a `p` marked with the
 * stylesheet's `captionMarker`, which sets it bold so a reader tells a
 * result's name from the result and from the prose around it.
 * @type {(text: string) => Element}
 */
export const caption = text => ['p', { [captionMarker]: '' }, text]

/** A module refusal: its caption and its unchanged message in a verdict box.
 * @type {(message: string) => Element}
 */
export const refusal = message => ['div', { role: 'status' },
    caption('Refused:'),
    ['pre', { [resultMarker]: 'error' }, message],
]

/**
 * The attributes a graph carries its {@link DragAxis} under, which the page
 * runtime reads back when a handle in it is dragged: one record, so the
 * graph that writes them and the runtime that reads them cannot disagree.
 */
export const dragAxisAttributes = /** @type {const} */ ({
    min: 'data-demo-x-min',
    max: 'data-demo-x-max',
    left: 'data-demo-x-left',
    right: 'data-demo-x-right',
})

/**
 * The attributes a graph spreads into its `svg` to say how a drag across
 * it maps onto a value.
 *
 * @type {(axis: DragAxis) => { readonly [k in string]: string }}
 */
export const dragAxis = axis => ({
    [dragAxisAttributes.min]: `${axis.min}`,
    [dragAxisAttributes.max]: `${axis.max}`,
    [dragAxisAttributes.left]: `${axis.left}`,
    [dragAxisAttributes.right]: `${axis.right}`,
})

/**
 * The value a drag to the x `x` sets, as the `input` event spells it: `x`
 * mapped through the axis, kept within the slider's `bounds` (whose minimum
 * can be inside the graph's left boundary), and rounded to three decimals.
 * `null` where `right <= left` leaves no axis to map onto.
 *
 * @type {(axis: DragAxis, bounds: DragBounds, x: number) => string | null}
 */
export const dragValue = (axis, bounds, x) => axis.right <= axis.left
    ? null
    : min(bounds.max, max(bounds.min, axis.min + (x - axis.left) / (axis.right - axis.left) * (axis.max - axis.min))).toFixed(3)

/** Update an existing string field; unrelated events keep the state.
 * @type {<S extends StringMap<string>>(state: S) => (event: DemoEvent) => Effect<never, S, never>}
 */
export const fieldUpdate = state => event => pureOk(
    event.kind === 'input' && at(event.name)(state) !== null
        ? { ...state, [event.name]: event.value }
        : state)
