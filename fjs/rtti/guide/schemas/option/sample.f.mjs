/**
 * The lesson of [`README.md`](./README.md), as the page's demo and the module
 * page's demo show it: absence is not the value `undefined`.
 *
 * @module
 *
 * @import { DemoExample } from '../../../types.ts'
 */

import { number, option, or } from '../../../module.f.mjs'

/** @type {readonly DemoExample[]} */
export const lessons = [
    {
        name: 'Absent vs undefined',
        about: 'or(option, t) lets the key be left out. or(t, undefined) needs the key, though its value may be undefined: try export default {"a":undefined};',
        schemas: [
            { source: '{ a: or(option, number) }', schema: { a: or(option, number) } },
            { source: '{ a: or(number, undefined) }', schema: { a: or(number, undefined) } },
        ],
        value: 'export default {};',
    },
]
