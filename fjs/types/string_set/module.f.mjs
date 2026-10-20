/**
 * A set of strings implemented as a B-Tree. See `./types.ts` for the
 * `StringSet` type.
 *
 * @module
 *
 * @example
 *
 * ```js
 * import { set, contains, remove, fromValues, values, empty } from './module.f.mjs';
 *
 * let mySet = fromValues(['apple', 'banana', 'cherry']);
 * if (!contains('banana')(mySet)) { throw '1' }
 * if (contains('date')(mySet)) { throw '2' }
 *
 * mySet = set('date')(mySet);
 * if (!contains('date')(mySet)) { throw '3' }
 *
 * mySet = remove('banana')(mySet);
 * if (contains('banana')(mySet)) { throw '4' }
 * ```
 *
 * @import { List } from '../list/types.ts'
 * @import { StringSet } from './types.ts'
 */

import { empty as btEmpty, values as btValues } from '../btree/module.f.mjs'
import { contains as btreeContains } from '../btree/find/module.f.mjs'
import { remove as btreeRemove } from '../btree/remove/module.f.mjs'
import { set as btreeSet } from '../btree/set/module.f.mjs'
import { cmp } from "../string/module.f.mjs"
import { fold } from '../list/module.f.mjs'
import { compose } from '../function/module.f.js'

/** @type {(s: StringSet) => List<string>} */
export const values = btValues
/** @type {null} */
export const empty = btEmpty

/** @type {(value: string) => (set: StringSet) => boolean} */
export const contains = compose(cmp)(btreeContains)

/** @type {(value: string) => (s: StringSet) => StringSet} */
export const set = value => btreeSet(cmp(value))(() => value)

/** @type {(input: List<string>) => StringSet} */
export const fromValues = fold(set)(null)

/** @type {(value: string) => (s: StringSet) => StringSet} */
export const remove = compose(cmp)(btreeRemove)
