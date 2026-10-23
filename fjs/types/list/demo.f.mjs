/**
 * A list of numbers, typed in, and what the combinators of this module make
 * of it.
 *
 * **Each line is one call, written as the code a reader would write.** The
 * left column is the expression, `xs` standing for the typed list, and the
 * right is its answer, so the page doubles as a reference for argument order:
 * `fold(x => acc => …)` takes the item first, and `zip(a)(b)` stops at the
 * shorter list.
 *
 * **The last line reads an infinite list.** `cycle(xs)` never ends, and
 * `take(10)` stops it, which is what laziness buys: nothing past the tenth
 * item is computed.
 *
 * **What is not a whole number is refused**, naming the first item that is
 * not, rather than read as `NaN` and carried through every line.
 *
 * **It needs no operations.** Every answer is a pure function of the text, so
 * `update` returns its next state through `pureOk`.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { Result } from '../result/types.ts'
 */

import { codeMarker } from '../../website/style/module.f.js'
import { textDemo, caption, refusal } from '../../website/demo/module.f.mjs'
import { addition } from '../function/operator/module.f.js'
import { error, ok } from '../result/module.f.js'
import { cycle, entries, filter, fold, foldScan, intersperse, map, reverse, take, toArray, zip } from './module.f.mjs'

/**
 * The typed text as whole numbers, split at commas and spaces, or the first
 * item that is not one.
 *
 * @type {(text: string) => Result<readonly number[], string>}
 */
export const parse = text => {
    const items = text.replaceAll(',', ' ').replaceAll('\n', ' ').split(' ').filter(item => item !== '')
    const bad = items.find(item => !Number.isInteger(Number(item)))
    return bad === undefined ? ok(items.map(Number)) : error(`not a whole number: ${bad}`)
}

/**
 * The calls the demo shows, each as its expression and its answer for `xs`.
 *
 * @type {(xs: readonly number[]) => readonly (readonly [string, unknown])[]}
 */
export const calls = xs => [
    ['toArray(map(x => x * 2)(xs))', toArray(map(x => x * 2)(xs))],
    ['toArray(filter(x => x % 2 === 0)(xs))', toArray(filter(x => x % 2 === 0)(xs))],
    ['fold(x => acc => acc + x)(0)(xs)', fold(x => acc => acc + x)(0)(xs)],
    ['toArray(foldScan(addition)(0)(xs))', toArray(foldScan(addition)(0)(xs))],
    ['toArray(reverse(xs))', toArray(reverse(xs))],
    ['toArray(take(3)(xs))', toArray(take(3)(xs))],
    ['toArray(intersperse(0)(xs))', toArray(intersperse(0)(xs))],
    ['toArray(entries(xs))', toArray(entries(xs))],
    ["toArray(zip(xs)(['a', 'b']))", toArray(zip(xs)(['a', 'b']))],
    ['toArray(take(10)(cycle(xs)))', toArray(take(10)(cycle(xs)))],
]

/**
 * A value as the demo prints it: JSON, with strings in single quotes as the
 * expressions beside them are written.
 *
 * @type {(value: unknown) => string}
 */
const show = value => typeof value === 'string' ? `'${value}'`
    : value instanceof Array ? `[${value.map(show).join(', ')}]`
    : String(value)

/**
 * Every call on its own line, the expression padded so the answers line up.
 *
 * @type {(xs: readonly number[]) => string}
 */
export const listing = xs => {
    const rows = calls(xs)
    const width = rows.reduce((w, [expression]) => expression.length > w ? expression.length : w, 0)
    return rows.map(([expression, answer]) => `${expression.padEnd(width)}  ${show(answer)}`).join('\n')
}

/** @type {Demo<string, DemoEvent>} */
export const demo = textDemo({
    intro: 'Type a list of whole numbers. Each line below is one call of this module on it, written as code, with its answer; the last line takes ten items of an infinite list.',
    name: 'xs',
    label: 'xs',
    rows: 1,
    init: '3, 1, 4, 1, 5',
})(text => {
    const xs = parse(text)
    return xs[0] === 'error'
        ? [refusal(xs[1])]
        : [caption('Calls, answers:'), ['pre', { [codeMarker]: '' }, listing(xs[1])]]
})
