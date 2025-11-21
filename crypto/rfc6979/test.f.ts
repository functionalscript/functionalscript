import { vec } from "../../types/bit_vec/module.f.ts"
import { bits2int, clearBits, roundUpBits, int2octets, roundUp8, bits2octets } from "./module.f.ts"

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
        if (roundUp8(3n) !== 8n) { throw new Error("fail") }
    },
    () => {
        if (bits2int(3n)(vec(5n)(0b10100n)) !== 0b101n) { throw new Error("fail") }
        if (bits2int(5n)(vec(3n)(0b101n)) !== 0b101n) { throw new Error("fail") }
    },
    () => {
        if (int2octets(3n)(0b101n) !== vec(8n)(0b0000_0101n)) { throw new Error("fail") }
        if (int2octets(5n)(0b10100n) !== vec(8n)(0b0001_0100n)) { throw new Error("fail") }
        if (int2octets(15n)(0x13n) !== vec(16n)(0x13n)) { throw new Error("fail") }
    },
    () => {
        if (bits2octets(11n)(vec(4n)(0b1101n)) !== vec(8n)(0b0000_0010n)) { throw new Error("fail") }
    }
]
