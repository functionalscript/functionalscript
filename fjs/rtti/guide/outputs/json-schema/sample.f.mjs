/**
 * The lesson of [`README.md`](./README.md), as the page's demo and the module
 * page's demo show it: a bigint becomes a JSON number, which cannot hold
 * every one.
 *
 * @module
 *
 * @import { DemoExample } from '../../../types.ts'
 */

import { bigint, option, or, string } from '../../../module.f.mjs'

/** @type {readonly DemoExample[]} */
export const lessons = [
    {
        name: 'Lossy integers',
        about: 'JSON has no bigint: bigint becomes "integer", and the constant 9007199254740993n becomes 9007199254740992, the nearest number. note admits absence, so it is not required.',
        schemas: [{
            source: '{ id: bigint, max: 9007199254740993n, note: or(option, string) }',
            schema: { id: bigint, max: 9007199254740993n, note: or(option, string) },
        }],
        value: 'export default {"id":1n,"max":9007199254740993n};',
    },
]
