/**
 * A select and an action button: choose a greeting, then restore the initial
 * choice. The reset button is disabled while that choice is already selected.
 * @module
 * @import { Demo, DemoEvent } from './types.ts'
 */

import { button, caption, option, selectField } from './module.f.mjs'
import { pureOk } from '../../effects/module.f.mjs'
import { textSharing } from './sharing/module.f.mjs'

/** @type {Demo<string, DemoEvent>} */
export const demo = {
    init: 'Hello',
    sharing: {
        ...textSharing('greeting', 'Hello'),
        fields: { greeting: { default: 'Hello', choices: ['Hello', 'Hi', 'Welcome'] } },
    },
    update: state => event => pureOk(
        event.kind === 'input' && event.name === 'greeting' ? event.value
        : event.kind === 'click' && event.name === 'reset' ? 'Hello'
        : state),
    view: greeting => ['div',
        ['p', 'Choose a greeting to change the result. Reset restores Hello and is disabled while Hello is selected.'],
        selectField({ name: 'greeting', label: 'Greeting' }, [
            option('Hello', 'Hello', greeting === 'Hello'),
            ['optgroup', { label: 'Other greetings' }, option('Hi', 'Hi', greeting === 'Hi'), option('Welcome', 'Welcome', greeting === 'Welcome')],
        ]),
        ['p', button('reset', 'Reset', greeting === 'Hello')],
        caption('Greeting:'),
        ['p', `${greeting}!`],
    ],
}
