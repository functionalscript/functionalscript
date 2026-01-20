import { empty, vec, type Vec } from "../bit_vec/module.f.ts"
import { cBase32ToVec, cBase32ToVec5x, vec5xToCBase32, vecToCBase32 } from "./module.f.ts"

const check5x = (s: string, v: Vec) => {
    const sr = vec5xToCBase32(v)
    if (sr !== s) { throw [sr, s] }
    const vr = cBase32ToVec5x(s)
    if (vr !== v) { throw [vr, v] }
}

const check = (s: string, v: Vec) => {
    const sr = vecToCBase32(v)
    if (sr !== s) { throw [sr, s] }
    const vr = cBase32ToVec(s)
    if (vr !== v) { throw [vr, v] }
}

export default {
    roundtrip5x: () => {
        check5x("", empty)
        check5x("0", vec(5n)(0b00000n))
        check5x("1", vec(5n)(0b00001n))
        check5x("7", vec(5n)(0b00111n))
        check5x("a", vec(5n)(0b01010n))
        check5x("b", vec(5n)(0b01011n))
        check5x("f", vec(5n)(0b01111n))
        check5x("gh", vec(10n)(0b10000_10001n))
        check5x("jk", vec(10n)(0b10010_10011n))
        check5x("mnpq", vec(20n)(0b010100_10101_10110_10111n))
        check5x("rstvwxyz", vec(40n)(0b11000_11001_11010_11011_11100_11101_11110_11111n))
    },
    roundtrip: () => {
        check("g", empty)
        check("8", vec(1n)(0n))
        check("r", vec(1n)(1n))
        check("4", vec(2n)(0n))
        check("c", vec(2n)(1n))
        check("2", vec(3n)(0n))
        check("1", vec(4n)(0n))
        check("2g", vec(5n)(2n))
        check("01", vec(9n)(0n))
    },
    unalignedBits: () => {
        const v = vec(1n)(1n)
        const cr = vec5xToCBase32(v)
        if (cr !== "g") { throw ['g', cr] }
    },
    caseInsensitive: () => {
        if (cBase32ToVec5x("A") !== cBase32ToVec5x("a")) { throw 'case-insensitive expected' }
        if (cBase32ToVec5x("I") !== cBase32ToVec5x("1")) { throw 'i maps to 1' }
        if (cBase32ToVec5x("l") !== cBase32ToVec5x("1")) { throw 'l maps to 1' }
        if (cBase32ToVec5x("o") !== cBase32ToVec5x("0")) { throw 'o maps to 0' }
        if (cBase32ToVec5x("u") !== null) { throw 'should error on invalid character' }
    }
}
