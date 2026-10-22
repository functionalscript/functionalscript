/**
 * The lesson of [`README.md`](./README.md), as the page's demo and the module
 * page's demo show it: a constant admits exactly itself, so it tags the
 * members of a union.
 *
 * @module
 *
 * @import { DemoExample } from '../../../types.ts'
 */

import { number, or } from '../../../module.f.mjs'

/** @type {readonly DemoExample[]} */
export const lessons = [
    {
        name: 'Tagged union',
        about: 'A constant admits exactly itself, so the kind tells the two members apart. Try "kind":"triangle", or a circle with a side.',
        schemas: [{
            source: "or({ kind: 'circle', r: number }, { kind: 'square', side: number })",
            schema: or({ kind: 'circle', r: number }, { kind: 'square', side: number }),
        }],
        value: 'export default {"kind":"circle","r":1};',
    },
]
