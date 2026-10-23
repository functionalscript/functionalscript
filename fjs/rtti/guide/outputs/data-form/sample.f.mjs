/**
 * The lesson of [`README.md`](./README.md), as the page's demo and the module
 * page's demo show it: the data form compares two schemas as sets.
 *
 * @module
 *
 * @import { DemoExample } from '../../../types.ts'
 */

import { number } from '../../../module.f.mjs'

/** @type {readonly DemoExample[]} */
export const lessons = [
    {
        name: 'Subset',
        about: 'Every value of { a: 42 } is a value of { a: number }, and not the other way round: the comparison under the graph says so. Type {"a":7} to see only the second accept it.',
        schemas: [
            { source: '{ a: 42 }', schema: { a: 42 } },
            { source: '{ a: number }', schema: { a: number } },
        ],
        value: 'export default {"a":42};',
    },
]
