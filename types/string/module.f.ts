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
import { join as joinOp, concat as concatOp, type Reduce } from '../function/operator/module.f.ts'

const reduce: (o: Reduce<string>) => (input: List<string>) => string
    = o => listReduce(o)('')

export const join: (_: string) => (input: List<string>) => string
    = compose(joinOp)(reduce)

export const concat: (input: List<string>) => string
    = reduce(concatOp)

export const repeat: (n: string) => (v: number) => string
    = v => compose(listRepeat(v))(concat)

export const cmp: (a: string) => (b: string) => Sign
    = uCmp
