import { vec } from "../../types/bit_vec/module.f.ts"
import { roundUp8, all } from "./module.f.ts"

export default [
    () => {
        if (roundUp8(3n) !== 8n) { throw new Error("fail") }
    },
    () => {
        if (all(7n).bits2int(vec(5n)(0b10100n)) !== 0b101n) { throw new Error("fail") }
        if (all(17n).bits2int(vec(3n)(0b101n)) !== 0b101n) { throw new Error("fail") }
    },
    () => {
        // 3 bit prime
        if (all(5n).int2octets(0b101n) !== vec(8n)(0b0000_0101n)) { throw new Error("fail") }
        // 5 bit prime
        if (all(17n).int2octets(0b10100n) !== vec(8n)(0b0001_0100n)) { throw new Error("fail") }
        // 15 bit prime
        if (all(16387n).int2octets(0x13n) !== vec(16n)(0x13n)) { throw new Error("fail") }
    },
    () => {
        if (all(11n).bits2octets(vec(4n)(0b1101n)) !== vec(8n)(0b0000_0010n)) { throw new Error("fail") }
    }
]
