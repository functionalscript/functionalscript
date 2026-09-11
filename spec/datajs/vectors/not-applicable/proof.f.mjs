/**
 * @import { NotApplicable } from '../../../../fjs/media/datajs/vectors/matrix/types.ts'
 */

import { assert, assertEq } from '../../../../fjs/asserts/module.f.mjs'
import notApplicable from './data.f.mjs'

/** The set, typed at the import since a data module carries no annotations. */
const set = /** @type {readonly NotApplicable[]} */ (notApplicable)

/**
 * A member as a string that says something, or a failure naming the record
 * and the member. Blank is checked rather than empty because a reason of
 * spaces renders a cell reading `not applicable:` with nothing after it —
 * an unanswered cell wearing the look of an answered one. The generator
 * refuses it too; this is where a contributor meets it first.
 *
 * @type {(record: NotApplicable, name: 'class' | 'role' | 'because') => string}
 */
const named = (record, name) => {
    const value = record[name]
    assert(typeof value === 'string' && value.trim() !== '', `${JSON.stringify(record.class)}: ${name} is not a string that says anything`)
    return value
}

// The shape of the reasons the matrix reads. Whether a reason answers a
// cell that is actually empty, and whether the class and the role exist at
// all, is the generator's — `fjs/media/datajs/vectors/matrix` refuses a
// stale one, so a reason cannot outlive the gap it was written for.
export const proof = {
    // Every record names a class, a role and a reason, none of them blank.
    named: () => { for (const record of set) { named(record, 'class'); named(record, 'role'); named(record, 'because') } },
    // One reason per class and role: two would leave the matrix to pick.
    unique: () => {
        const keys = set.map(record => `${named(record, 'role')} ${named(record, 'class')}`)
        assertEq(new Set(keys).size, keys.length)
    },
}
