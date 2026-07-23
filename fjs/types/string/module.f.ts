/**
 * Utility functions for working with strings and lists of strings.
 *
 * @module
 *
 * @example
 *
 * ```js
 * import { join, concat, repeat, cmp } from './module.f.ts'
 *
 * const words = ['hello', 'world']
 * join(' ')(words) // 'hello world'
 * concat(words) // 'helloworld'
 * repeat('abc')(3) // 'abcabcabc'
 * cmp('apple')('banana') // -1
 * ```
 */
import { type List, reduce as listReduce, repeat as listRepeat } from '../list/module.f.ts'
import { compose } from '../function/module.f.ts'
import { type Sign, cmp as uCmp } from '../function/compare/module.f.ts'
import { join as joinOp, type Reduce } from '../function/operator/module.f.ts'
import { fold } from '../../common/monoid/module.f.ts'

// `join`'s per-separator reduction is seeded at `''` but is *not* a monoid fold:
// `joinOp(sep)` has no identity (`joinOp(sep)('')(x)` prepends a separator), so
// it stays a hand-seeded `reduce` rather than going through `monoid.fold`.
const reduce: (o: Reduce<string>) => (input: List<string>) => string
    = o => listReduce(o)('')

export const join: (_: string) => (input: List<string>) => string
    = compose(joinOp)(reduce)

// String concatenation with identity `''` is a lawful monoid, so `concat` is a
// monoid fold. The operation is accumulator-first (`a` on the left), matching
// `monoid.fold`'s convention — unlike the element-first `concat` in
// `function/operator`, which is written for `list.reduce`.
export const concat: (input: List<string>) => string
    = fold({ identity: '', operation: a => b => a + b })

export const repeat: (n: string) => (v: number) => string
    = v => compose(listRepeat(v))(concat)

export const cmp: (a: string) => (b: string) => Sign
    = uCmp

export const splitAt = (p: number) => (v: string): readonly[string, string] =>
    [v.substring(0, p), v.substring(p)]