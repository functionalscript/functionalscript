import { vec } from "../../types/bit_vec/module.f.ts"
import { bits2int, clearBits, roundUpBits } from "./module.f.ts"

export default [
    () => {
        if (clearBits(3n)(0b1000n) !== 0b1000n) { throw new Error("fail") }
        if (clearBits(3n)(0b1111n) !== 0b1000n) { throw new Error("fail") }
    },
    () => {
        if (roundUpBits(3n)(0b1000n) !== 0b1000n) { throw new Error("fail") }
        if (roundUpBits(3n)(0b1111n) !== 0b10000n) { throw new Error("fail") }
    },
    () => {
        if (bits2int(3n)(vec(5n)(0b10100n)) !== 0b101n) { throw new Error("fail") }
        if (bits2int(5n)(vec(3n)(0b101n)) !== 0b101n) { throw new Error("fail") }
    }
]
