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
    ['Static functions', 'const { isInteger } = Number;\nexport default [Object.is(0, -0), Object.is(NaN, NaN), Object.is === Object.is, isInteger(5), Number.isSafeInteger(2 ** 53), Number.isNaN("NaN"), Number.isFinite(1 / 0)];', 'static-functions'],
    ['Object.entries', 'const { entries } = Object;\nexport default [entries({ b: 1, "1": 2 }), Object.entries([7]), Object.entries("ab"), entries === Object.entries];', 'object-entries'],
    ['Object.keys', 'const { keys } = Object;\nexport default [keys({ b: 1, "1": 2, absent: undefined }), Object.keys([7]), Object.keys("😀"), keys === Object.keys];', 'object-keys'],
    ['Object.values', 'const { values } = Object;\nexport default [values({ b: 1, "1": 2, absent: undefined }), Object.values([7]), Object.values("😀"), values === Object.values];', 'object-values'],
]

export default { staticFunctions, all: [...staticFunctions] }
