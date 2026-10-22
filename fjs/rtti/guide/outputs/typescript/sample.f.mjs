/**
 * The lesson of [`README.md`](./README.md), as the page's demo and the module
 * page's demo show it: an optional key and a key holding `undefined` are two
 * TypeScript types.
 *
 * @module
 *
 * @import { DemoExample } from '../../../types.ts'
 */

import { number, option, or } from '../../../module.f.mjs'

/** @type {readonly DemoExample[]} */
export const lessons = [
    {
        name: 'Optional or undefined',
        about: 'The TypeScript type marks a key admitting absence with ?, and a key that must be there but may hold undefined with | undefined. Leave b out to see both readers refuse the value; give it undefined to see them accept it.',
        schemas: [{
            source: '{ a: or(option, number), b: or(number, undefined) }',
            schema: { a: or(option, number), b: or(number, undefined) },
        }],
        value: 'export default {"a":1,"b":2};',
    },
]
