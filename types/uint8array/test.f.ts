import { vec } from '../bit_vec/module.f.ts'
import { strictEqual } from '../function/operator/module.f.ts'
import { equal, fromArrayLike } from '../list/module.f.ts'
import { toVec, fromVec } from './module.f.ts'

const assertArrayEq = (a: Uint8Array, b: Uint8Array) => {
    if (!equal(strictEqual)(fromArrayLike(a))(fromArrayLike(b))) {
        throw [a, b]
    }
}

export default {
    empty: () => {
        const input = new Uint8Array()
        const vec = toVec(input)
        const output = fromVec(vec)
        assertArrayEq(output, input)
    },
    roundTrip: () => {
        const input = Uint8Array.from([0, 1, 2, 3, 255])
        const vec = toVec(input)
        const output = fromVec(vec)
        assertArrayEq(output, input)
    },
    unalignedLength: () => {
        const input = vec(4n)(0xFn)
        const output = fromVec(input)
        assertArrayEq(output, Uint8Array.from([0xF0]))
    }
}
