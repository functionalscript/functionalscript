import { vec } from '../bit_vec/module.f.ts'
import { toVec, fromVec } from './module.f.ts'

    },
    unalignedLength: () => {
        const input = vec(4n)(0xFn)
        const output = fromVec(input)
        assertArrayEq(output, Uint8Array.from([0xF0]))
const assertEq = (a: number, b: number) => {
    if (a !== b) { throw [a, b] }
}

const assertArrayEq = (a: Uint8Array, b: Uint8Array) => {
    assertEq(a.length, b.length)
    for (let i = 0; i < a.length; i += 1) {
        assertEq(a[i], b[i])
    }
}

export default {
    roundTrip: () => {
        const input = Uint8Array.from([0, 1, 2, 250, 255])
        const vec = toVec(input)
        const output = fromVec(vec)
        assertArrayEq(output, input)
    },
    empty: () => {
        const input = new Uint8Array()
        const output = fromVec(toVec(input))
        assertArrayEq(output, input)
    }
}
