/**
 * Each thrown value of [`module.f.js`](./module.f.js) is the one NaNVM
 * builds: `error.rs` has a constructor whose name is the entry's in snake
 * case, and it builds the same text.
 */

import { readFileSync } from 'node:fs'

import { assertEq } from '../../../../asserts/module.f.js'
import { error } from './module.f.js'

const source = readFileSync(new URL('../../../../../nanvm/lib/src/vm/error.rs', import.meta.url), 'utf8')

/** NaNVM's thrown values with a fixed text, by constructor name. */
const nanvm = Object.fromEntries([...source.matchAll(
    /pub\(crate\) fn (\w+)<A: IVm>\(\) -> Any<A> \{\s*(type|range)_error\("([^"]*)"\)/g,
)].map(([, name, kind, message]) => [name, `${kind === 'type' ? 'TypeError' : 'RangeError'}: ${message}`]))

/** `mixedNumericOperands` as `mixed_numeric_operands`. @type {(s: string) => string} */
const snake = s => s.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`)

export const proof = {
    /** The source still reads as it did when the pattern was written. */
    parsed: () => {
        assertEq(nanvm.unexpected_type, 'TypeError: unexpected type')
    },
    /** Each entry has NaNVM's constructor of the same name and text. */
    same: Object.fromEntries(Object.entries(error).map(([name, value]) => [name, () => {
        assertEq(nanvm[snake(name)], value, name)
    }])),
}
