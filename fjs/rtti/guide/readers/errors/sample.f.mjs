/**
 * The lesson of [`README.md`](./README.md), as the page's demo and the module
 * page's demo show it: a refusal names the member it is about.
 *
 * @module
 *
 * @import { DemoExample } from '../../../types.ts'
 */

import { array, number, string } from '../../../module.f.mjs'

/** @type {readonly DemoExample[]} */
export const lessons = [
    {
        name: 'Where it failed',
        about: 'Both readers refuse the value with the same path, items → 1 → qty, and the demo marks that member. Make the qty a number to see both accept it.',
        schemas: [{
            source: '{ items: array({ sku: string, qty: number }) }',
            schema: { items: array({ sku: string, qty: number }) },
        }],
        value: 'export default {"items":[{"sku":"A1","qty":2},{"sku":"B2","qty":"3"}]};',
    },
]
