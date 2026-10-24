/**
 * The lesson of [`README.md`](./README.md), as the page's demo and the module
 * page's demo show it: `parse` builds a value, `validate` hands back the one
 * it was given.
 *
 * @module
 *
 * @import { DemoExample } from '../../../types.ts'
 */

import { number, open, string } from '../../../module.f.mjs'

/** @type {readonly DemoExample[]} */
export const lessons = [
    {
        name: 'Built or handed back',
        about: 'Both readers accept the value. parse builds one with the declared keys only; validate hands back the value it was given, admin included.',
        schemas: [{
            source: 'open({ name: string, age: number })',
            schema: open({ name: string, age: number }),
        }],
        value: 'export default {"name":"Alice","age":30,"admin":true};',
    },
]
