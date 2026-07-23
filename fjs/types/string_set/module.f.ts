/**
 * A set of strings implemented as a B-Tree.
 *
 * @module
 *
 * @example
 *
 * ```js
 * import { set, contains, remove, fromValues, values, empty } from './module.d.ts';
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
 */

import type { Tree } from '../btree/types/module.f.ts'
import { empty as btEmpty, values as btValues } from '../btree/module.f.ts'
import { find, isFound } from '../btree/find/module.f.ts'
import { remove as btreeRemove } from '../btree/remove/module.f.ts'
import { set as btreeSet } from '../btree/set/module.f.ts'
import { cmp } from "../string/module.f.ts"
import { fold, type List } from '../list/module.f.ts'
import { compose } from '../function/module.f.ts'

export const values: (s: StringSet) => List<string> = btValues
export const empty: null = btEmpty

export type StringSet = Tree<string>

export const contains: (value: string) => (set: StringSet) => boolean
    = value => {
        const f = find(cmp(value))
        return s => s !== null && isFound(f(s).first)
    }

export const set: (value: string) => (s: StringSet) => StringSet
    = value => btreeSet(cmp(value))(() => value)

export const fromValues: (input: List<string>) => StringSet
    = fold(set)(null)

export const remove: (value: string) => (s: StringSet) => StringSet
    = compose(cmp)(btreeRemove)
