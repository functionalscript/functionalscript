/**
 * Proof of `fjs/js/members/module.f.js`: the table holds the seven types,
 * each with exactly the admitted names of its prototype, every entry a
 * function, map and concat use their typed bodies, and an entry not yet written
 * throws `not implemented`.
 */

import { assertEq, todo } from '../../asserts/module.f.js'
import { members } from './module.f.js'
import { map } from './array/map/module.f.js'
import { concat as arrayConcat } from './array/concat/module.f.js'
import { concat as stringConcat } from './string/concat/module.f.js'
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
    /** The written bodies are shared with the runtime; other entries are `todo`. */
    unwritten: () => {
        for (const [type, table] of Object.entries(members)) {
            for (const [name, f] of Object.entries(table)) {
                const expected = type === 'array' && name === 'map' ? map
                    : type === 'array' && name === 'concat' ? arrayConcat
                    : type === 'string' && name === 'concat' ? stringConcat : todo
                assertEq(f, expected)
            }
        }
    },
    throw: {
        notImplemented: () => members.string.startsWith('abc', 'a'),
    },
}
