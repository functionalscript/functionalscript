/**
 * @import { NotApplicable } from '../../../../fjs/media/datajs/vectors/matrix/types.ts'
 */

import { assert, assertEq } from '../../../../fjs/asserts/module.f.mjs'
import notApplicable from './data.f.mjs'

/** The set, typed at the import since a data module carries no annotations. */
const set = /** @type {readonly NotApplicable[]} */ (notApplicable)

/** A record's scope as one string, which is how a failure names it. @type {(record: NotApplicable) => string} */
const where = record => `${record.scope[0]} ${record.scope[1]}`

/**
 * A member as a string that says something, or a failure naming the record
 * and the member. Blank is checked rather than empty because a reason of
 * spaces renders a cell reading `not applicable:` with nothing after it —
 * an unanswered cell wearing the look of an answered one. The generator
 * refuses it too; this is where a contributor meets it first.
 *
 * @type {(record: NotApplicable, name: 'role' | 'because') => string}
 */
const named = (record, name) => {
    const value = record[name]
    assert(typeof value === 'string' && value.trim() !== '', `${JSON.stringify(where(record))}: ${name} is not a string that says anything`)
    return value
}

/**
 * A scope as the type has one: the exact two-element tuple, tagged with one
 * of the three the vocabulary admits, over a name that says something. A
 * data module carries no annotations, so the cast at the import is a claim
 * and this is what checks it — the tag alone would not, since a longer
 * array answers the same to `scope[0]`.
 *
 * @type {(record: NotApplicable) => void}
 */
const scoped = record => {
    const { scope } = record
    assert(Array.isArray(scope) && scope.length === 2, `a record whose scope is not the two-element tuple`)
    assert(['class', 'subtree', 'set'].includes(scope[0]), `${where(record)}: not one of class, subtree or set`)
    assert(typeof scope[1] === 'string' && scope[1].trim() !== '', `${where(record)}: the scope names nothing`)
}

// The shape of the reasons the matrix reads. Whether a reason answers a
// cell that is actually empty, and whether the class and the role exist at
// all, is the generator's — `fjs/media/datajs/vectors/matrix` refuses a
// stale one, so a reason cannot outlive the gap it was written for.
export const proof = {
    // Every record names a scope, a role and a reason, none of them blank.
    named: () => { for (const record of set) { scoped(record); named(record, 'role'); named(record, 'because') } },
    // One reason per scope and role: two would leave the matrix to pick.
    unique: () => {
        const keys = set.map(record => `${named(record, 'role')} ${where(record)}`)
        assertEq(new Set(keys).size, keys.length)
    },
}
