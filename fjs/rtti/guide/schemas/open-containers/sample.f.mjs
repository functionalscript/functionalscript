/**
 * The lesson of [`README.md`](./README.md), as the page's demo and the module
 * page's demo show it: `rest` admits extra elements of one schema.
 *
 * @module
 *
 * @import { DemoExample } from '../../../types.ts'
 */

import { number, rest, string } from '../../../module.f.mjs'

/** @type {readonly DemoExample[]} */
export const lessons = [
    {
        name: 'Tuple vs rest',
        about: 'A tuple is checked by length as well as by member. rest() admits any number of extra elements of one type.',
        schemas: [
            { source: '[number, string]', schema: [number, string] },
            { source: 'rest([number], string)', schema: rest([number], string) },
        ],
        value: 'export default [1,"a","b"];',
    },
]
