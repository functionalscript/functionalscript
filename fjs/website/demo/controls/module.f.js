/**
 * Selects and action buttons shared by demos. IDs stay local to the view;
 * the demo control-ID boundary scopes them when the view is rendered.
 * @module
 * @import { InputFieldOptions } from '../types.ts'
 * @import { Element } from '../../../media/html/types.ts'
 * @import { StringMap } from '../../../types/object/types.ts'
 */

import { entry } from '../../../types/object/entry/module.f.js'

/** One choice, selected only when it is the current value.
 * @type {(value: string, text: string, selected: boolean) => readonly ['option', StringMap<string>, string]}
 */
export const option = (value, text, selected) =>
    ['option', { value, ...(selected ? { selected: '' } : {}) }, text]

/** A labelled select accepting options and option groups.
 * @type {(o: InputFieldOptions, options: readonly Element[]) => Element}
 */
export const selectField = (field, options) => {
    const name = /** @type {InputFieldOptions['name']} */ (entry(field, 'name'))
    const { label } = field
    return ['p',
        ['label', { for: name }, `${label} `],
        ['select', { id: name, name }, ...options],
    ]
}

/** A named action; it never submits a form.
 * @type {(name: string, label: string, disabled?: boolean) => Element}
 */
export const button = (name, label, disabled = false) =>
    ['button', { type: 'button', name, ...(disabled ? { disabled: '' } : {}) }, label]
