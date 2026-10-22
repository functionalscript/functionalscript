import { assertEq } from '../../../../asserts/module.f.js'
import { printer } from '../../../ts/module.f.mjs'
import { array, number, option, or, record, string } from '../../../module.f.mjs'
import { drawsFirst, verdicts as verdictsOf } from '../../testlib.f.mjs'
import { lessons } from './sample.f.mjs'
import { demo } from './demo.f.mjs'

/**
 * @import { Assert } from '../../../../asserts/types.ts'
 * @import { Ts } from '../../../ts/types.ts'
 */

const verdicts = verdictsOf(lessons)

const s = { a: or(option, number), b: or(number, undefined) }
/** @typedef {{ readonly a?: number } & { readonly b: number | undefined }} _Page */
/** @typedef {Assert<[Ts<typeof s>] extends [_Page] ? [_Page] extends [Ts<typeof s>] ? true : false : false>} _PageType */

export const proof = {
    // The lesson's value, and the ones the page invites the reader to type.
    readers: {
        optionalOrUndefined: () => verdicts('Optional or undefined', [true]),
        bLeftOut: () => verdicts('Optional or undefined', [false], 'export default {"a":1};'),
        bUndefined: () => verdicts('Optional or undefined', [true], 'export default {"b":undefined};'),
    },
    // The page's examples.
    printer: {
        page: () => assertEq(printer()(s), '{readonly"a"?:number,readonly"b":undefined|number}'),
        mutable: () => assertEq(printer(true)(array(number)), '(number)[]'),
        tuple: () => assertEq(printer()([number, or(option, string)]), 'readonly[number,(string)?]'),
        record: () => assertEq(printer()(record(number)), '{readonly[k in string]?:number}'),
    },
    // The demo opens on the page's first lesson and draws it.
    demo: drawsFirst(lessons, demo),
}
