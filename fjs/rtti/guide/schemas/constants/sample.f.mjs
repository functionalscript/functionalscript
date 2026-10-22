/**
 * The lessons of [`README.md`](./README.md), as the page's demo and the module
 * page's demo show them: a constant admits exactly itself, compared with
 * `Object.is`, so it tags the members of a union.
 *
 * @module
 *
 * @import { DemoExample } from '../../../types.ts'
 */

import { number, or } from '../../../module.f.mjs'

/** @type {DemoExample} */
export const signedZero = {
    name: 'Zero and minus zero',
    about: 'A constant admits exactly itself, compared with Object.is: 0 and -0 are two schemas with one value each. Type 0 to see the answers swap.',
    schemas: [
        { source: '0', schema: 0 },
        { source: '-0', schema: -0 },
    ],
    value: 'export default -0;',
}

/** @type {DemoExample} */
export const taggedUnion = {
    name: 'Tagged union',
    about: 'A constant admits exactly itself, so the kind tells the two members apart. Try "kind":"triangle", or a circle with a side.',
    schemas: [{
        source: "or({ kind: 'circle', r: number }, { kind: 'square', side: number })",
        schema: or({ kind: 'circle', r: number }, { kind: 'square', side: number }),
    }],
    value: 'export default {"kind":"circle","r":1};',
}

/** @type {readonly DemoExample[]} */
export const lessons = [signedZero, taggedUnion]
