/**
 * Type-level API of the DataJS grammar: the value the grammar spells, which
 * names itself and so is spelled here as `JsonValue` is in
 * `../json/types.ts` — a named type that a `const` binding may be annotated
 * with, so that a mapping of `value` receives its ten branches rather than
 * any tagged node at all.
 *
 * @module
 */

import type { Rule } from '../../types.ts'
import type { Container, Entry } from '../json/types.ts'
import type { string } from '../json/module.f.mjs'
import type { id, number, property } from './module.f.mjs'

/**
 * The ten alternatives a DataJS value has: JSON's seven, with `number`
 * replaced by this grammar's own — the integer form takes a bigint suffix
 * and `Infinity` is a word — and `NaN`, `undefined` and a reference beside
 * them. A property is a JSON string or the one spelling of `__proto__`.
 */
export type Value<V extends Rule> = {
    readonly array: Container<V>
    readonly object: Container<Entry<typeof property, V>>
    readonly string: typeof string
    readonly number: typeof number
    readonly true: 'true'
    readonly false: 'false'
    readonly null: 'null'
    readonly nan: 'NaN'
    readonly undefined: 'undefined'
    readonly id: typeof id
}

/**
 * The DataJS grammar's value: a `const` thunk whose payload is {@link Value}
 * over the thunk itself. The recursion is spelled through the thunk's
 * function type, which is what lets a type alias name itself.
 */
export type DataJsValue =
    () => readonly ['const', Value<DataJsValue>]
