/**
 * Utility functions for working with strings and lists of strings.
 *
 * @module
 *
 * @example
 *
 * ```js
 * import { join, concat, repeat, cmp, occurrences } from './module.f.mjs'
 *
 * const words = ['hello', 'world']
 * join(' ')(words) // 'hello world'
 * concat(words) // 'helloworld'
 * repeat('abc')(3) // 'abcabcabc'
 * cmp('apple')('banana') // -1
 * occurrences('a')('banana') // 3
 * ```
 *
 * @import { List } from '../list/types.ts'
 * @import { Sign } from '../function/compare/types.ts'
 * @import { Reduce } from '../function/operator/types.ts'
 */

import { reduce as listReduce, repeat as listRepeat } from '../list/module.f.mjs'
import { compose } from '../function/module.f.js'
import { cmp as uCmp } from '../function/compare/module.f.js'
import { addition as additionOp, join as joinOp } from '../function/operator/module.f.js'
import { fold } from '../../common/monoid/module.f.mjs'
import { assert } from '../../asserts/module.f.js'

/** @type {Reduce<string>} */
const _stringAddition = additionOp

/**
 * `join`'s per-separator reduction is seeded at `''` but is *not* a monoid fold:
 * `joinOp(sep)` has no identity (`joinOp(sep)('')(x)` prepends a separator), so
 * it stays a hand-seeded `reduce` rather than going through `monoid.fold`.
 *
 * @type {(o: Reduce<string>) => (input: List<string>) => string}
 */
const reduce = o => listReduce(o)('')

/** @type {(_: string) => (input: List<string>) => string} */
export const join = compose(joinOp)(reduce)

/**
 * String concatenation with identity `''` is a lawful monoid, so `concat` is a
 * monoid fold. The operation is accumulator-first (`a` on the left), matching
 * `monoid.fold`'s convention — unlike the element-first `concat` in
 * `function/operator`, which is written for `list.reduce`.
 *
 * @type {(input: List<string>) => string}
 */
export const concat = fold({ identity: '', operation: _stringAddition })

/** @type {(n: string) => (v: number) => string} */
export const repeat = v => compose(listRepeat(v))(concat)

/** @type {(a: string) => (b: string) => Sign} */
export const cmp = uCmp

/** @type {(p: number) => (v: string) => readonly[string, string]} */
export const splitAt = p => v =>
    [v.substring(0, p), v.substring(p)]

/**
 * How many times `needle` occurs in `text`, without overlap and from the
 * left, as `split` cuts it: `occurrences('aa')('aaa')` is `1`. An empty
 * `needle` is refused: `split` would count the gaps between code units.
 *
 * @type {(needle: string) => (text: string) => number}
 */
export const occurrences = needle => {
    assert(needle !== '', 'occurrences: the needle is empty')
    return text => text.split(needle).length - 1
}
