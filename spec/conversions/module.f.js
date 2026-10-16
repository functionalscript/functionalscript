/**
 * The compiler demo examples of the conversions pages, one list per page.
 * A page owns its programs: this file sits beside the pages, and
 * [`fjs/compiler/examples`](../../fjs/compiler/examples/module.f.js) takes its
 * area from here instead of spelling it a second time.
 *
 * @module
 *
 * @import { Examples } from '../../fjs/website/demo/examples/types.ts'
 */

/** @type {Examples} */
const number = [
    ['Number conversion', 'const xs = [10, 20, 30];\nexport default [Number("0x10"), Number(" 4 "), Number(1n), Number([7]), Number(null), xs[Number("2")]];'],
]

export default { number, all: [...number] }
