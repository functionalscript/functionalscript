import { assert } from '../../../asserts/module.f.js'
import { bigintEquals } from './module.f.js'

export const proof = {
    // `bigintEquals` is `===` on two bigints.
    bigintEquals: () => {
        assert(bigintEquals(0n, 0n))
        assert(bigintEquals(0x1_0000_0000_0000_0000n, 0x1_0000_0000_0000_0000n))
        assert(!bigintEquals(1n, -1n))
    },
    throw: {
        // either operand that is no bigint traps
        first: () => { bigintEquals(1, 1n) },
        second: () => { bigintEquals(1n, 1) },
    },
}
