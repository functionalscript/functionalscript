import { empty, vec, type Vec } from "../bit_vec/module.f.ts"
import { unwrap, type Result } from "../result/module.f.ts"
import { fromCBase32, toCBase32 } from "./module.f.ts"

const check = (s: string, v: Vec) => {
    const sr = toCBase32(v)
    if (sr !== s) { throw [sr, s] }
    const vr = unwrap(fromCBase32(s))
    if (vr !== v) { throw [vr, v] }
}

const shouldError = (fn: () => Result<Vec, string>) => {
    const [kind] = fn()
    if (kind !== 'error') { throw 'expected to error' }
}

export default [
    () => {
        check("", empty)
        check("0", vec(5n)(0b00000n))
        check("1", vec(5n)(0b00001n))
        check("7", vec(5n)(0b00111n))
        check("a", vec(5n)(0b01010n))
        check("b", vec(5n)(0b01011n))
        check("f", vec(5n)(0b01111n))
        check("gh", vec(10n)(0b10000_10001n))
        check("jk", vec(10n)(0b10010_10011n))
        check("mnpq", vec(20n)(0b010100_10101_10110_10111n))
        check("rstvwxyz", vec(40n)(0b11000_11001_11010_11011_11100_11101_11110_11111n))
    }
    , () => {
        if (unwrap(fromCBase32("A")) !== unwrap(fromCBase32("a"))) { throw 'case-insensitive expected' }
        if (unwrap(fromCBase32("I")) !== unwrap(fromCBase32("1"))) { throw 'i maps to 1' }
        if (unwrap(fromCBase32("l")) !== unwrap(fromCBase32("1"))) { throw 'l maps to 1' }
        if (unwrap(fromCBase32("o")) !== unwrap(fromCBase32("0"))) { throw 'o maps to 0' }
        shouldError(() => fromCBase32("u"))
    }
]
