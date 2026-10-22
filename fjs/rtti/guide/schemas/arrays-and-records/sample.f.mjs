/**
 * The lesson of [`README.md`](./README.md), as the page's demo and the module
 * page's demo show it: `record` admits any string keys.
 *
 * @module
 *
 * @import { DemoExample } from '../../../types.ts'
 */

import { number, record } from '../../../module.f.mjs'

/** @type {readonly DemoExample[]} */
export const lessons = [
    {
        name: 'Dictionary',
        about: 'record(t) admits any string keys, each holding a t.',
        schemas: [{ source: 'record(number)', schema: record(number) }],
        value: 'export default {"apples":3,"pears":5};',
    },
]
