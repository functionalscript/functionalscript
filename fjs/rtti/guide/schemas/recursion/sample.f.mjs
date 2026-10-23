/**
 * The lessons of [`README.md`](./README.md), as the page's demo and the module
 * page's demo show them: a schema that uses itself, and one sub-schema used
 * twice.
 *
 * @module
 *
 * @import { DemoExample, Type } from '../../../types.ts'
 */

import { array, number, option, or, string } from '../../../module.f.mjs'

const address = /** @type {const} */ ({ street: string, city: string })

const order = /** @type {const} */ ({
    id: number,
    billing: address,
    shipping: address,
    items: array({ sku: string, qty: number }),
    note: or(option, string),
})

/** @type {Type} */
const tree = () => ['const', { value: number, children: array(tree) }]

/** @type {DemoExample} */
export const recursion = {
    name: 'Recursion',
    about: 'A schema can use itself. The graph draws that use as an arrow back to its definition.',
    schemas: [{ source: "const tree = () => ['const', { value: number, children: array(tree) }]", schema: tree }],
    value: 'export default {"value":1,"children":[{"value":2,"children":[]}]};',
}

/** @type {DemoExample} */
export const sharedParts = {
    name: 'Shared parts',
    about: 'billing and shipping use one address schema, so the graph draws it once. The value shares one address too: validate hands that back, and parse builds a copy for each use.',
    schemas: [{
        source: 'const address = { street: string, city: string }\n'
            + 'const order = {\n'
            + '    id: number,\n'
            + '    billing: address,\n'
            + '    shipping: address,\n'
            + '    items: array({ sku: string, qty: number }),\n'
            + '    note: or(option, string),\n'
            + '}',
        schema: order,
    }],
    value: 'const $home={"street":"1 Main St","city":"Kyiv"};\n'
        + 'export default {"id":7,"billing":$home,"shipping":$home,"items":[{"sku":"A1","qty":2}]};',
}

/** @type {readonly DemoExample[]} */
export const lessons = [recursion, sharedParts]
