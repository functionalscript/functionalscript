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
 * **The last line reads an infinite list.** For a non-empty `xs`, `cycle(xs)`
 * never ends, and `take(10)` stops it, which is what laziness buys: the walk
 * ends after ten items instead of running forever. An empty `xs` cycles to an
 * empty list.
 *
 * **Only whole numbers of at most six digits are read**, and anything else
 * is refused, naming the first item, rather than read as `NaN` and carried
 * through every line. Six digits keep every answer the page computes, such as
 * a sum, far below `Number.MAX_SAFE_INTEGER`, so each one is exact. A number is
 * decimal digits with an optional `-`, nothing else: `Number` would read a
 * tab as `0` and `0x10` as `16`.
 *
 * **It needs no operations.** Every answer is a pure function of the text, so
 * `update` returns its next state through `pureOk`.
 *
 * @module
 *
 * @import { Demo, DemoEvent } from '../../website/demo/types.ts'
 * @import { Result } from '../result/types.ts'
 */

import { isDigits } from '../../text/ascii/module.f.js'
import { codeMarker } from '../../website/style/module.f.js'
import { textDemo, caption, refusal } from '../../website/demo/module.f.mjs'
import { addition } from '../function/operator/module.f.js'
import { error, ok } from '../result/module.f.js'
import { cycle, entries, filter, fold, foldScan, intersperse, map, reverse, take, zip } from './module.f.js'
import { toArray } from './alt/module.f.mjs'

/**
 * The typed text as whole numbers, split at commas and spaces, or the first
 * item that is not one. Each is at most six digits, with an optional `-`.
 *
 * @type {(text: string) => Result<readonly number[], string>}
 */
export const parse = text => {
    const items = text.replaceAll(',', ' ').replaceAll('\n', ' ').split(' ').filter(item => item !== '')
    const bad = items.find(item => {
        const digits = item.startsWith('-') ? item.slice(1) : item
        return !isDigits(digits) || digits.length > 6
    })
    return bad === undefined ? ok(items.map(Number)) : error(`a whole number of at most six digits, not: ${bad}`)
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
    intro: 'Type a list of whole numbers. Each line below is one call of this module on it, written as code, with its answer; the last line takes ten items of an infinite list, cycling xs, when xs is not empty.',
    name: 'xs',
    label: 'xs',
    rows: 1,
    init: '3, 1, 4, 1, 5',
})(text => {
    const [tag, value] = parse(text)
    return tag === 'error'
        ? [refusal(value)]
        : [caption('Calls, answers:'), ['pre', { [codeMarker]: '' }, listing(value)]]
})
