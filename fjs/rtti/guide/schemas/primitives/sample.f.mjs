/**
 * The lesson of [`README.md`](./README.md), as the page's demo and the module
 * page's demo show it: each primitive admits every value of its kind.
 *
 * @module
 *
 * @import { DemoExample } from '../../../types.ts'
 */

import { bigint, boolean, number, string, unknown } from '../../../module.f.mjs'

/** @type {readonly DemoExample[]} */
export const lessons = [
    {
        name: 'Primitives',
        about: 'Each primitive schema admits every value of its kind, NaN among the numbers; unknown admits any DataJS value. Try a number where the bigint is.',
        schemas: [{
            source: '{ flag: boolean, count: number, name: string, big: bigint, extra: unknown }',
            schema: { flag: boolean, count: number, name: string, big: bigint, extra: unknown },
        }],
        value: 'export default {"flag":true,"count":NaN,"name":"x","big":7n,"extra":[null]};',
    },
]
