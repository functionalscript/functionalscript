/**
 * Proof of `fjs/js/members/module.f.mjs`: the table holds the seven types,
 * each with exactly the admitted names of its prototype, every entry a
 * function, and an entry not yet written throws `not implemented`.
 */

import { assertEq, todo } from '../../asserts/module.f.mjs'
import { members } from './module.f.mjs'
import { allowedCalls, arrayPrototype, bigintPrototype, booleanPrototype, functionPrototype, numberPrototype, objectPrototype, stringPrototype } from '../prototype/module.f.js'

/** @type {(prototype: readonly string[]) => readonly string[]} */
const admitted = prototype => prototype.filter(name => allowedCalls.some(call => call === name))

export const proof = {
    /** Each type holds the admitted names of its prototype, every entry a function. */
    types: () => {
        assertEq(Object.keys(members).join(), 'boolean,string,number,bigint,object,array,function')
        /** @type {readonly (readonly [keyof typeof members, readonly string[]])[]} */
        const prototypes = [
            ['boolean', booleanPrototype],
            ['string', stringPrototype],
            ['number', numberPrototype],
            ['bigint', bigintPrototype],
            ['object', objectPrototype],
            ['array', arrayPrototype],
            ['function', functionPrototype],
        ]
        for (const [type, prototype] of prototypes) {
            assertEq(Object.keys(members[type]).toSorted().join(), admitted(prototype).toSorted().join(), type)
            for (const f of Object.values(members[type])) { assertEq(typeof f, 'function', type) }
        }
    },
    /** No body is written yet: every entry is `todo`. */
    unwritten: () => {
        for (const type of Object.values(members)) {
            for (const f of Object.values(type)) { assertEq(f, todo) }
        }
    },
    throw: {
        notImplemented: () => members.string.startsWith('abc', 'a'),
    },
}
