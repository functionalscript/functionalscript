/**
 * The lesson of [`README.md`](./README.md), as the page's demo and the module
 * page's demo show it: a struct admits the keys it declares and no others.
 *
 * @module
 *
 * @import { DemoExample } from '../../../types.ts'
 */

import { number, open, string } from '../../../module.f.mjs'

const person = /** @type {const} */ ({ name: string, age: number })

/** @type {readonly DemoExample[]} */
export const lessons = [
    {
        name: 'Closed vs open',
        about: 'A struct admits the keys it declares and no others. open() admits any other keys too.',
        schemas: [
            { source: '{ name: string, age: number }', schema: person },
            { source: 'open({ name: string, age: number })', schema: open(person) },
        ],
        value: 'export default {"name":"Alice","age":30,"admin":true};',
    },
]
