/**
 * The compiler demo examples of the built-ins pages, one list per page.
 * A page owns its programs: this file sits beside the pages, and
 * [`fjs/compiler/examples`](../../fjs/compiler/examples/module.f.js) takes its
 * area from here instead of spelling it a second time.
 *
 * @module
 *
 * @import { Examples } from '../../fjs/website/demo/examples/types.ts'
 */

/** @type {Examples} */
const staticFunctions = [
    ['Static functions', 'const { isInteger } = Number;\nexport default [Object.is(0, -0), Object.is(NaN, NaN), Object.is === Object.is, isInteger(5), Number.isSafeInteger(2 ** 53), Number.isNaN("NaN"), Number.isFinite(1 / 0)];'],
]

export default { staticFunctions }
