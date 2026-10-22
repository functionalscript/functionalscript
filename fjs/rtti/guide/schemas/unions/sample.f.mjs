/**
 * The lesson of [`README.md`](./README.md), as the page's demo and the module
 * page's demo show it: two spellings of one set.
 *
 * @module
 *
 * @import { DemoExample } from '../../../types.ts'
 */

import { boolean, or } from '../../../module.f.mjs'

/** @type {readonly DemoExample[]} */
export const lessons = [
    {
        name: 'Two spellings, one set',
        about: 'or(true, false) and boolean are written differently and accept exactly the same values.',
        schemas: [
            { source: 'or(true, false)', schema: or(true, false) },
            { source: 'boolean', schema: boolean },
        ],
        value: 'export default true;',
    },
]
