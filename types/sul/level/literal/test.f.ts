import { vec, type Vec } from '../../../bit_vec/module.f.ts'
import { stateScan, toArray } from '../../../list/module.f.ts'
import {
    emptyState,
    level,
    literal1ToVec,
    literal2ToVec,
    literal3ToVec,
    symbolToString,
    wordEqual,
    wordToString
} from './module.f.ts'

const tests = (n: bigint) => {
    const { sum, decode, encode: push } = level(n)
    return {
        c: (i: bigint, s: bigint) => {
            const result = sum(i)
            if (result !== s) {
                throw new Error(`Assertion failed for n=${n}, i=${i}, s=${symbolToString(s)}, got ${symbolToString(result)}`);
            }
        },
        n: (word: readonly bigint[], expected: bigint) => {
            // encode
            const decoded = decode(expected)
            if (!wordEqual(decoded)(word)) {
                throw new Error(`Assertion failed for n=${n}, word=${wordToString(word)}, expected decode to return ${wordToString(word)}, got [${wordToString(decoded)}]`);
            }
            // encode
            const a =toArray(stateScan(push)(emptyState)(word))
            if (!a.slice(0, -1).every(i => i === undefined)) {
                throw a
            }
            const x = a.at(-1)
            if (x !== expected) {
                throw x
            }
        }
    }
}

const l = (f: (literal: bigint) => Vec) => (l: bigint, e: Vec) => {
    const result = f(l)
    if (result !== e) {
        throw [result, e]
    }
}

export default {
    x2: () => {
        const { c, n } = tests(0n)
        c(-1n, 0n)
        c(0n, 2n)
        c(1n, 5n)
        //
        n([0n, 0n], 0n)
        n([0n, 1n], 1n)
        n([1n, 0n, 0n], 2n)
        n([1n, 0n, 1n], 3n)
        n([1n, 1n], 4n)
    },
    x5: () => {
        const { c, n } = tests(2n)
        c(-1n, 0n)
        c(0n, 5n) // N
        c(1n, 0xEn) // N + (2N - 1) = 3N - 1
        c(2n, 0x1Fn) // N + (2N - 1) + (4N - 3) = 7N - 4
        c(3n, 0x40n)
        c(4n, 0x81n)
        //
        n([0n, 0n], 0x00n)
        n([0n, 1n], 0x01n)
        n([0n, 2n], 0x02n)
        n([0n, 3n], 0x03n)
        n([0n, 4n], 0x04n)
        //
        n([1n, 0n, 0n], 0x05n)
        n([1n, 0n, 1n], 0x06n)
        n([1n, 0n, 2n], 0x07n)
        n([1n, 0n, 3n], 0x08n)
        n([1n, 0n, 4n], 0x09n)
        n([1n, 1n], 0x0An)
        n([1n, 2n], 0x0Bn)
        n([1n, 3n], 0x0Cn)
        n([1n, 4n], 0x0Dn)
        //
        n([2n, 0n, 0n], 0x0En)
        n([2n, 0n, 1n], 0x0Fn)
        n([2n, 0n, 2n], 0x10n)
        n([2n, 0n, 3n], 0x11n)
        n([2n, 0n, 4n], 0x12n)
        n([2n, 1n, 0n, 0n], 0x13n)
        n([2n, 1n, 0n, 1n], 0x14n)
        n([2n, 1n, 0n, 2n], 0x15n)
        n([2n, 1n, 0n, 3n], 0x16n)
        n([2n, 1n, 0n, 4n], 0x17n)
        n([2n, 1n, 1n], 0x18n)
        n([2n, 1n, 2n], 0x19n)
        n([2n, 1n, 3n], 0x1An)
        n([2n, 1n, 4n], 0x1Bn)
        n([2n, 2n], 0x1Cn)
        n([2n, 3n], 0x1Dn)
        n([2n, 4n], 0x1En)
        //
        n([3n, 0n, 0n], 0x1Fn)
        n([3n, 0n, 1n], 0x20n)
        n([3n, 0n, 2n], 0x21n)
        n([3n, 0n, 3n], 0x22n)
        n([3n, 0n, 4n], 0x23n)
        n([3n, 1n, 0n, 0n], 0x24n)
        n([3n, 1n, 0n, 1n], 0x25n)
        n([3n, 1n, 0n, 2n], 0x26n)
        n([3n, 1n, 0n, 3n], 0x27n)
        n([3n, 1n, 0n, 4n], 0x28n)
        n([3n, 1n, 1n], 0x29n)
        n([3n, 1n, 2n], 0x2An)
        n([3n, 1n, 3n], 0x2Bn)
        n([3n, 1n, 4n], 0x2Cn)
        n([3n, 2n, 0n, 0n], 0x2Dn)
        n([3n, 2n, 0n, 1n], 0x2En)
        n([3n, 2n, 0n, 2n], 0x2Fn)
        n([3n, 2n, 0n, 3n], 0x30n)
        n([3n, 2n, 0n, 4n], 0x31n)
        n([3n, 2n, 1n, 0n, 0n], 0x32n)
        n([3n, 2n, 1n, 0n, 1n], 0x33n)
        n([3n, 2n, 1n, 0n, 2n], 0x34n)
        n([3n, 2n, 1n, 0n, 3n], 0x35n)
        n([3n, 2n, 1n, 0n, 4n], 0x36n)
        n([3n, 2n, 1n, 1n], 0x37n)
        n([3n, 2n, 1n, 2n], 0x38n)
        n([3n, 2n, 1n, 3n], 0x39n)
        n([3n, 2n, 1n, 4n], 0x3An)
        n([3n, 2n, 2n], 0x3Bn)
        n([3n, 2n, 3n], 0x3Cn)
        n([3n, 2n, 4n], 0x3Dn)
        n([3n, 3n], 0x3En)
        n([3n, 4n], 0x3Fn)
        //
        n([4n, 0n, 0n], 0x40n)
        n([4n, 0n, 1n], 0x41n)
        n([4n, 0n, 2n], 0x42n)
        n([4n, 0n, 3n], 0x43n)
        n([4n, 0n, 4n], 0x44n)
        n([4n, 1n, 0n, 0n], 0x45n)
        n([4n, 1n, 0n, 1n], 0x46n)
        n([4n, 1n, 0n, 2n], 0x47n)
        n([4n, 1n, 0n, 3n], 0x48n)
        n([4n, 1n, 0n, 4n], 0x49n)
        n([4n, 1n, 1n], 0x4An)
        n([4n, 1n, 2n], 0x4Bn)
        n([4n, 1n, 3n], 0x4Cn)
        n([4n, 1n, 4n], 0x4Dn)
        n([4n, 2n, 0n, 0n], 0x4En)
        n([4n, 2n, 0n, 1n], 0x4Fn)
        n([4n, 2n, 0n, 2n], 0x50n)
        n([4n, 2n, 0n, 3n], 0x51n)
        n([4n, 2n, 0n, 4n], 0x52n)
        n([4n, 2n, 1n, 0n, 0n], 0x53n)
        n([4n, 2n, 1n, 0n, 1n], 0x54n)
        n([4n, 2n, 1n, 0n, 2n], 0x55n)
        n([4n, 2n, 1n, 0n, 3n], 0x56n)
        n([4n, 2n, 1n, 0n, 4n], 0x57n)
        n([4n, 2n, 1n, 1n], 0x58n)
        n([4n, 2n, 1n, 2n], 0x59n)
        n([4n, 2n, 1n, 3n], 0x5An)
        n([4n, 2n, 1n, 4n], 0x5Bn)
        n([4n, 2n, 2n], 0x5Cn)
        n([4n, 2n, 3n], 0x5Dn)
        n([4n, 2n, 4n], 0x5En)
        n([4n, 3n, 0n, 0n], 0x5Fn)
        n([4n, 3n, 0n, 1n], 0x60n)
        n([4n, 3n, 0n, 2n], 0x61n)
        n([4n, 3n, 0n, 3n], 0x62n)
        n([4n, 3n, 0n, 4n], 0x63n)
        n([4n, 3n, 1n, 0n, 0n], 0x64n)
        n([4n, 3n, 1n, 0n, 1n], 0x65n)
        n([4n, 3n, 1n, 0n, 2n], 0x66n)
        n([4n, 3n, 1n, 0n, 3n], 0x67n)
        n([4n, 3n, 1n, 0n, 4n], 0x68n)
        n([4n, 3n, 1n, 1n], 0x69n)
        n([4n, 3n, 1n, 2n], 0x6An)
        n([4n, 3n, 1n, 3n], 0x6Bn)
        n([4n, 3n, 1n, 4n], 0x6Cn)
        n([4n, 3n, 2n, 0n, 0n], 0x6Dn)
        n([4n, 3n, 2n, 0n, 1n], 0x6En)
        n([4n, 3n, 2n, 0n, 2n], 0x6Fn)
        n([4n, 3n, 2n, 0n, 3n], 0x70n)
        n([4n, 3n, 2n, 0n, 4n], 0x71n)
        n([4n, 3n, 2n, 1n, 0n, 0n], 0x72n)
        n([4n, 3n, 2n, 1n, 0n, 1n], 0x73n)
        n([4n, 3n, 2n, 1n, 0n, 2n], 0x74n)
        n([4n, 3n, 2n, 1n, 0n, 3n], 0x75n)
        n([4n, 3n, 2n, 1n, 0n, 4n], 0x76n)
        n([4n, 3n, 2n, 1n, 1n], 0x77n)
        n([4n, 3n, 2n, 1n, 2n], 0x78n)
        n([4n, 3n, 2n, 1n, 3n], 0x79n)
        n([4n, 3n, 2n, 1n, 4n], 0x7An)
        n([4n, 3n, 2n, 2n], 0x7Bn)
        n([4n, 3n, 2n, 3n], 0x7Cn)
        n([4n, 3n, 2n, 4n], 0x7Dn)
        n([4n, 3n, 3n], 0x7En)
        n([4n, 3n, 4n], 0x7Fn)
        n([4n, 4n], 0x80n)
    },
    x81: () => {
        const { c, n } = tests(7n)
        c(-1n, 0n)
        // N,
        // N + (2N - 1) = 3N - 1,
        // N + (2N - 1) + (4N - 3) = 7N - 4,
        // N + (2N - 1) + (4N - 3) + (8N - 7) = 15N - 11,
        // N + (2N - 1) + (4N - 3) + (8N - 7) + (16N - 15) = 31N - 26,
        c(0x00n, 0x81n)
        c(0x01n, 0x182n)
        c(0x02n, 0x383n)
        c(0x03n, 0x784n)
        c(0x04n, 0xF85n)
        c(0x05n, 0x1F86n)
        c(0x06n, 0x3F87n)
        c(0x07n, 0x7F88n)
        c(0x08n, 0xFF89n)
        c(0x09n, 0x1_FF8An)
        c(0x0An, 0x3_FF8Bn)
        c(0x0Bn, 0x7_FF8Cn)
        c(0x0Cn, 0xF_FF8Dn)
        c(0x0Dn, 0x1F_FF8En)
        c(0x0En, 0x3F_FF8Fn)
        c(0x0Fn, 0x7F_FF90n)
        c(0x10n, 0xFF_FF91n)
        c(0x11n, 0x1FF_FF92n)
        c(0x12n, 0x3FF_FF93n)
        c(0x13n, 0x7FF_FF94n)
        c(0x14n, 0xFFF_FF95n)
        c(0x15n, 0x1FFF_FF96n)
        c(0x16n, 0x3FFF_FF97n)
        c(0x17n, 0x7FFF_FF98n)
        c(0x18n, 0xFFFF_FF99n)
        c(0x19n, 0x1_FFFF_FF9An)
        c(0x1An, 0x3_FFFF_FF9Bn)
        c(0x1Bn, 0x7_FFFF_FF9Cn)
        c(0x1Cn, 0xF_FFFF_FF9Dn)
        c(0x1Dn, 0x1F_FFFF_FF9En)
        c(0x1En, 0x3F_FFFF_FF9Fn)
        c(0x1Fn, 0x7F_FFFF_FFA0n)
        c(0x20n, 0xFF_FFFF_FFA1n)
        c(0x21n, 0x1FF_FFFF_FFA2n)
        c(0x22n, 0x3FF_FFFF_FFA3n)
        c(0x23n, 0x7FF_FFFF_FFA4n)
        c(0x24n, 0xFFF_FFFF_FFA5n)
        c(0x25n, 0x1FFF_FFFF_FFA6n)
        c(0x26n, 0x3FFF_FFFF_FFA7n)
        c(0x27n, 0x7FFF_FFFF_FFA8n)
        c(0x28n, 0xFFFF_FFFF_FFA9n)
        c(0x29n, 0x1_FFFF_FFFF_FFAAn)
        c(0x2An, 0x3_FFFF_FFFF_FFABn)
        c(0x2Bn, 0x7_FFFF_FFFF_FFACn)
        c(0x2Cn, 0xF_FFFF_FFFF_FFADn)
        c(0x2Dn, 0x1F_FFFF_FFFF_FFAEn)
        c(0x2En, 0x3F_FFFF_FFFF_FFAFn)
        c(0x2Fn, 0x7F_FFFF_FFFF_FFB0n)
        c(0x30n, 0xFF_FFFF_FFFF_FFB1n)
        c(0x31n, 0x1FF_FFFF_FFFF_FFB2n)
        c(0x32n, 0x3FF_FFFF_FFFF_FFB3n)
        c(0x33n, 0x7FF_FFFF_FFFF_FFB4n)
        c(0x34n, 0xFFF_FFFF_FFFF_FFB5n)
        c(0x35n, 0x1FFF_FFFF_FFFF_FFB6n)
        c(0x36n, 0x3FFF_FFFF_FFFF_FFB7n)
        c(0x37n, 0x7FFF_FFFF_FFFF_FFB8n)
        c(0x38n, 0xFFFF_FFFF_FFFF_FFB9n)
        c(0x39n, 0x1_FFFF_FFFF_FFFF_FFBAn)
        c(0x3An, 0x3_FFFF_FFFF_FFFF_FFBBn)
        c(0x3Bn, 0x7_FFFF_FFFF_FFFF_FFBCn)
        c(0x3Cn, 0xF_FFFF_FFFF_FFFF_FFBDn)
        c(0x3Dn, 0x1F_FFFF_FFFF_FFFF_FFBEn)
        c(0x3En, 0x3F_FFFF_FFFF_FFFF_FFBFn)
        c(0x3Fn, 0x7F_FFFF_FFFF_FFFF_FFC0n)
        c(0x40n, 0xFF_FFFF_FFFF_FFFF_FFC1n)
        c(0x41n, 0x1FF_FFFF_FFFF_FFFF_FFC2n)
        c(0x42n, 0x3FF_FFFF_FFFF_FFFF_FFC3n)
        c(0x43n, 0x7FF_FFFF_FFFF_FFFF_FFC4n)
        c(0x44n, 0xFFF_FFFF_FFFF_FFFF_FFC5n)
        c(0x45n, 0x1FFF_FFFF_FFFF_FFFF_FFC6n)
        c(0x46n, 0x3FFF_FFFF_FFFF_FFFF_FFC7n)
        c(0x47n, 0x7FFF_FFFF_FFFF_FFFF_FFC8n)
        c(0x48n, 0xFFFF_FFFF_FFFF_FFFF_FFC9n)
        c(0x49n, 0x1_FFFF_FFFF_FFFF_FFFF_FFCAn)
        c(0x4An, 0x3_FFFF_FFFF_FFFF_FFFF_FFCBn)
        c(0x4Bn, 0x7_FFFF_FFFF_FFFF_FFFF_FFCCn)
        c(0x4Cn, 0xF_FFFF_FFFF_FFFF_FFFF_FFCDn)
        c(0x4Dn, 0x1F_FFFF_FFFF_FFFF_FFFF_FFCEn)
        c(0x4En, 0x3F_FFFF_FFFF_FFFF_FFFF_FFCFn)
        c(0x4Fn, 0x7F_FFFF_FFFF_FFFF_FFFF_FFD0n)
        c(0x50n, 0xFF_FFFF_FFFF_FFFF_FFFF_FFD1n)
        c(0x51n, 0x1FF_FFFF_FFFF_FFFF_FFFF_FFD2n)
        c(0x52n, 0x3FF_FFFF_FFFF_FFFF_FFFF_FFD3n)
        c(0x53n, 0x7FF_FFFF_FFFF_FFFF_FFFF_FFD4n)
        c(0x54n, 0xFFF_FFFF_FFFF_FFFF_FFFF_FFD5n)
        c(0x55n, 0x1FFF_FFFF_FFFF_FFFF_FFFF_FFD6n)
        c(0x56n, 0x3FFF_FFFF_FFFF_FFFF_FFFF_FFD7n)
        c(0x57n, 0x7FFF_FFFF_FFFF_FFFF_FFFF_FFD8n)
        c(0x58n, 0xFFFF_FFFF_FFFF_FFFF_FFFF_FFD9n)
        c(0x59n, 0x1_FFFF_FFFF_FFFF_FFFF_FFFF_FFDAn)
        c(0x5An, 0x3_FFFF_FFFF_FFFF_FFFF_FFFF_FFDBn)
        c(0x5Bn, 0x7_FFFF_FFFF_FFFF_FFFF_FFFF_FFDCn)
        c(0x5Cn, 0xF_FFFF_FFFF_FFFF_FFFF_FFFF_FFDDn)
        c(0x5Dn, 0x1F_FFFF_FFFF_FFFF_FFFF_FFFF_FFDEn)
        c(0x5En, 0x3F_FFFF_FFFF_FFFF_FFFF_FFFF_FFDFn)
        c(0x5Fn, 0x7F_FFFF_FFFF_FFFF_FFFF_FFFF_FFE0n)
        c(0x60n, 0xFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFE1n)
        c(0x61n, 0x1FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFE2n)
        c(0x62n, 0x3FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFE3n)
        c(0x63n, 0x7FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFE4n)
        c(0x64n, 0xFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFE5n)
        c(0x65n, 0x1FFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFE6n)
        c(0x66n, 0x3FFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFE7n)
        c(0x67n, 0x7FFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFE8n)
        c(0x68n, 0xFFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFE9n)
        c(0x69n, 0x1_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFEAn)
        c(0x6An, 0x3_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFEBn)
        c(0x6Bn, 0x7_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFECn)
        c(0x6Cn, 0xF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFEDn)
        c(0x6Dn, 0x1F_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFEEn)
        c(0x6En, 0x3F_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFEFn)
        c(0x6Fn, 0x7F_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFF0n)
        c(0x70n, 0xFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFF1n)
        c(0x71n, 0x1FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFF2n)
        c(0x72n, 0x3FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFF3n)
        c(0x73n, 0x7FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFF4n)
        c(0x74n, 0xFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFF5n)
        c(0x75n, 0x1FFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFF6n)
        c(0x76n, 0x3FFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFF7n)
        c(0x77n, 0x7FFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFF8n)
        c(0x78n, 0xFFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFF9n)
        c(0x79n, 0x1_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFAn)
        c(0x7An, 0x3_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFBn)
        c(0x7Bn, 0x7_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFCn)
        c(0x7Cn, 0xF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFDn)
        c(0x7Dn, 0x1F_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFEn)
        c(0x7En, 0x3F_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFFn)
        c(0x7Fn, 0x80_0000_0000_0000_0000_0000_0000_0000_0000n)
        c(0x80n, 0x100_0000_0000_0000_0000_0000_0000_0000_0001n)
        //
        n([0n, 0n], 0x00n)
        n([0n, 1n], 0x01n)
        n([0n, 2n], 0x02n)
        //
        n([0n, 0x80n], 0x80n)
        n([1n, 0n, 0n], 0x81n)
        //
        n([0x80n, 0x80n], 0x100_0000_0000_0000_0000_0000_0000_0000_0000n)
    },
    toVec: {
        level1: () => {
            const x = l(literal1ToVec)
            x(0n, vec(2n)(0b00n))
            x(1n, vec(2n)(0b01n))
            x(2n, vec(3n)(0b100n))
            x(3n, vec(3n)(0b101n))
            x(4n, vec(2n)(0b11n))
        },
        level2: () => {
            const x = l(literal2ToVec)
            // 0...
            x(0x00n, vec(4n)(0b00_00n))
            x(0x01n, vec(4n)(0b00_01n))
            x(0x02n, vec(5n)(0b00_100n))
            x(0x03n, vec(5n)(0b00_101n))
            x(0x04n, vec(4n)(0b00_11n))
            // 1
            // 10...
            x(0x05n, vec(0x6n)(0b01_00_00n))
            x(0x06n, vec(0x6n)(0b01_00_01n))
            x(0x07n, vec(0x7n)(0b01_00_100n))
            x(0x08n, vec(0x7n)(0b01_00_101n))
            x(0x09n, vec(0x6n)(0b01_00_11n))
            // 1...
            x(0x0An, vec(0x4n)(0b01_01n))
            x(0x0Bn, vec(0x5n)(0b01_100n))
            x(0x0Cn, vec(0x5n)(0b01_101n))
            x(0x0Dn, vec(0x4n)(0b01_11n))
            // 2
            // 20...
            x(0x0En, vec(0x7n)(0b100_00_00n))
            x(0x0Fn, vec(0x7n)(0b100_00_01n))
            x(0x10n, vec(0x8n)(0b100_00_100n))
            x(0x11n, vec(0x8n)(0b100_00_101n))
            x(0x12n, vec(0x7n)(0b100_00_11n))
            // 21
            // 210...
            x(0x13n, vec(0x9n)(0b100_01_00_00n))
            x(0x14n, vec(0x9n)(0b100_01_00_01n))
            x(0x15n, vec(0xAn)(0b100_01_00_100n))
            x(0x16n, vec(0xAn)(0b100_01_00_101n))
            x(0x17n, vec(0x9n)(0b100_01_00_11n))
            // 21...
            x(0x18n, vec(0x7n)(0b100_01_01n))
            x(0x19n, vec(0x8n)(0b100_01_100n))
            x(0x1An, vec(0x8n)(0b100_01_101n))
            x(0x1Bn, vec(0x7n)(0b100_01_11n))
            // 2...
            x(0x1Cn, vec(0x6n)(0b100_100n))
            x(0x1Dn, vec(0x6n)(0b100_101n))
            x(0x1En, vec(0x5n)(0b100_11n))
            // 3
            // 30...
            x(0x1Fn, vec(7n)(0b101_00_00n))
            x(0x20n, vec(7n)(0b101_00_01n))
            x(0x21n, vec(8n)(0b101_00_100n))
            x(0x22n, vec(8n)(0b101_00_101n))
            x(0x23n, vec(7n)(0b101_00_11n))
            // 31
            // 310...
            x(0x24n, vec(0x9n)(0b101_01_00_00n))
            x(0x25n, vec(0x9n)(0b101_01_00_01n))
            x(0x26n, vec(0xAn)(0b101_01_00_100n))
            x(0x27n, vec(0xAn)(0b101_01_00_101n))
            x(0x28n, vec(0x9n)(0b101_01_00_11n))
            // 31...
            x(0x29n, vec(0x7n)(0b101_01_01n))
            x(0x2An, vec(0x8n)(0b101_01_100n))
            x(0x2Bn, vec(0x8n)(0b101_01_101n))
            x(0x2Cn, vec(0x7n)(0b101_01_11n))
            // 32
            // 320...
            x(0x2Dn, vec(0xAn)(0b101_100_00_00n))
            x(0x2En, vec(0xAn)(0b101_100_00_01n))
            x(0x2Fn, vec(0xBn)(0b101_100_00_100n))
            x(0x30n, vec(0xBn)(0b101_100_00_101n))
            x(0x31n, vec(0xAn)(0b101_100_00_11n))
            // 321
            // 3210...
            x(0x32n, vec(0xCn)(0b101_100_01_00_00n))
            x(0x33n, vec(0xCn)(0b101_100_01_00_01n))
            x(0x34n, vec(0xDn)(0b101_100_01_00_100n))
            x(0x35n, vec(0xDn)(0b101_100_01_00_101n))
            x(0x36n, vec(0xCn)(0b101_100_01_00_11n))
            // 321...
            x(0x37n, vec(0xAn)(0b101_100_01_01n))
            x(0x38n, vec(0xBn)(0b101_100_01_100n))
            x(0x39n, vec(0xBn)(0b101_100_01_101n))
            x(0x3An, vec(0xAn)(0b101_100_01_11n))
            // 32...
            x(0x3Bn, vec(0x9n)(0b101_100_100n))
            x(0x3Cn, vec(0x9n)(0b101_100_101n))
            x(0x3Dn, vec(0x8n)(0b101_100_11n))
            // 3...
            x(0x3En, vec(0x6n)(0b101_101n))
            x(0x3Fn, vec(0x5n)(0b101_11n))
            // 40...
            x(0x40n, vec(6n)(0b11_00_00n))
            x(0x41n, vec(6n)(0b11_00_01n))
            x(0x42n, vec(7n)(0b11_00_100n))
            x(0x43n, vec(7n)(0b11_00_101n))
            x(0x44n, vec(6n)(0b11_00_11n))
            // 41
            // 410...
            x(0x45n, vec(0x8n)(0b11_01_00_00n))
            x(0x46n, vec(0x8n)(0b11_01_00_01n))
            x(0x47n, vec(0x9n)(0b11_01_00_100n))
            x(0x48n, vec(0x9n)(0b11_01_00_101n))
            x(0x49n, vec(0x8n)(0b11_01_00_11n))
            // 41...
            x(0x4An, vec(0x6n)(0b11_01_01n))
            x(0x4Bn, vec(0x7n)(0b11_01_100n))
            x(0x4Cn, vec(0x7n)(0b11_01_101n))
            x(0x4Dn, vec(0x6n)(0b11_01_11n))
            // 42
            // 420
            x(0x4En, vec(0x9n)(0b11_100_00_00n))
            x(0x4Fn, vec(0x9n)(0b11_100_00_01n))
            x(0x50n, vec(0xAn)(0b11_100_00_100n))
            x(0x51n, vec(0xAn)(0b11_100_00_101n))
            x(0x52n, vec(0x9n)(0b11_100_00_11n))
            // 421
            // 4210
            x(0x53n, vec(0xBn)(0b11_100_01_00_00n))
            x(0x54n, vec(0xBn)(0b11_100_01_00_01n))
            x(0x55n, vec(0xCn)(0b11_100_01_00_100n))
            x(0x56n, vec(0xCn)(0b11_100_01_00_101n))
            x(0x57n, vec(0xBn)(0b11_100_01_00_11n))
            // 421...
            x(0x58n, vec(0x9n)(0b11_100_01_01n))
            x(0x59n, vec(0xAn)(0b11_100_01_100n))
            x(0x5An, vec(0xAn)(0b11_100_01_101n))
            x(0x5Bn, vec(0x9n)(0b11_100_01_11n))
            // 42...
            x(0x5Cn, vec(0x8n)(0b11_100_100n))
            x(0x5Dn, vec(0x8n)(0b11_100_101n))
            x(0x5En, vec(0x7n)(0b11_100_11n))
            // 43
            // 430
            x(0x5Fn, vec(0x9n)(0b11_101_00_00n))
            x(0x60n, vec(0x9n)(0b11_101_00_01n))
            x(0x61n, vec(0xAn)(0b11_101_00_100n))
            x(0x62n, vec(0xAn)(0b11_101_00_101n))
            x(0x63n, vec(0x9n)(0b11_101_00_11n))
            // 431
            // 4310
            x(0x64n, vec(0xBn)(0b11_101_01_00_00n))
            x(0x65n, vec(0xBn)(0b11_101_01_00_01n))
            x(0x66n, vec(0xCn)(0b11_101_01_00_100n))
            x(0x67n, vec(0xCn)(0b11_101_01_00_101n))
            x(0x68n, vec(0xBn)(0b11_101_01_00_11n))
            // 431...
            x(0x69n, vec(0x9n)(0b11_101_01_01n))
            x(0x6An, vec(0xAn)(0b11_101_01_100n))
            x(0x6Bn, vec(0xAn)(0b11_101_01_101n))
            x(0x6Cn, vec(0x9n)(0b11_101_01_11n))
            // 432
            // 4320
            x(0x6Dn, vec(0xCn)(0b11_101_100_00_00n))
            x(0x6En, vec(0xCn)(0b11_101_100_00_01n))
            x(0x6Fn, vec(0xDn)(0b11_101_100_00_100n))
            x(0x70n, vec(0xDn)(0b11_101_100_00_101n))
            x(0x71n, vec(0xCn)(0b11_101_100_00_11n))
            // 4321
            // 43210
            x(0x72n, vec(0xEn)(0b11_101_100_01_00_00n))
            x(0x73n, vec(0xEn)(0b11_101_100_01_00_01n))
            x(0x74n, vec(0xFn)(0b11_101_100_01_00_100n))
            x(0x75n, vec(0xFn)(0b11_101_100_01_00_101n))
            x(0x76n, vec(0xEn)(0b11_101_100_01_00_11n))
            // 4321...
            x(0x77n, vec(0xCn)(0b11_101_100_01_01n))
            x(0x78n, vec(0xDn)(0b11_101_100_01_100n))
            x(0x79n, vec(0xDn)(0b11_101_100_01_101n))
            x(0x7An, vec(0xCn)(0b11_101_100_01_11n))
            // 432...
            x(0x7Bn, vec(0xBn)(0b11_101_100_100n))
            x(0x7Cn, vec(0xBn)(0b11_101_100_101n))
            x(0x7Dn, vec(0xAn)(0b11_101_100_11n))
            // 43...
            x(0x7En, vec(0x8n)(0b11_101_101n))
            x(0x7Fn, vec(0x7n)(0b11_101_11n))
            // 4...
            x(0x80n, vec(0x4n)(0b11_11n))
        },
        level3: () => {
            const x = l(literal3ToVec)
            // `0000`...
            x(0x000n, vec(0x8n)(0b0000_0000n))
            // ...
            x(0x080n, vec(0x8n)(0b0000_1111n))
            // `0001`
            // `0001_0000`...
            x(0x081n, vec(0xCn)(0b0001_0000_0000n))
            // ...
            x(0x101n, vec(0xCn)(0b0001_0000_1111n))
            // `0001`...
            x(0x102n, vec(0x8n)(0b0001_0001n))
            // ...
            x(0x181n, vec(0x8n)(0b0001_1111n))
            // `1111_1110111_11101101_1110110011_11101100101_11101100100_111011000111_1110110001101_1110110001100_111011000101_11101100010011_111011000100101_111011000100100`...
            x(0x0FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFB2n,
                vec(0x95n)(0b1111_1110111_11101101_1110110011_11101100101_11101100100_111011000111_1110110001101_1110110001100_111011000101_11101100010011_111011000100101_111011000100100_1111n))
            // `1111_1110111_11101101_1110110011_11101100101_11101100100_111011000111_1110110001101_1110110001100_111011000101_11101100010011_111011000100101`...
            x(0x0FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFB3n,
                vec(0x91n)(0b1111_1110111_11101101_1110110011_11101100101_11101100100_111011000111_1110110001101_1110110001100_111011000101_11101100010011_111011000100101_111011000100101n))
            // ... 0xB
            x(0x0FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFBEn,
                vec(0x86n)(0b1111_1110111_11101101_1110110011_11101100101_11101100100_111011000111_1110110001101_1110110001100_111011000101_11101100010011_111011000100101_1111n))
            // `1111_1110111_11101101_1110110011_11101100101_11101100100_111011000111_1110110001101_1110110001100_111011000101_11101100010011`...
            x(0x0FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFBFn,
                vec(0x81n)(0b1111_1110111_11101101_1110110011_11101100101_11101100100_111011000111_1110110001101_1110110001100_111011000101_11101100010011_11101100010011n))
            // ...
            x(0x0FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFC9n,
                vec(0x77n)(0b1111_1110111_11101101_1110110011_11101100101_11101100100_111011000111_1110110001101_1110110001100_111011000101_11101100010011_1111n))
            // `1111_1110111_11101101_1110110011_11101100101_11101100100_111011000111_1110110001101_1110110001100_111011000101`...
            x(0x0FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFCAn,
                vec(0x71n)(0b1111_1110111_11101101_1110110011_11101100101_11101100100_111011000111_1110110001101_1110110001100_111011000101_111011000101n))
            // ...
            x(0x0FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFD3n,
                vec(0x69n)(0b1111_1110111_11101101_1110110011_11101100101_11101100100_111011000111_1110110001101_1110110001100_111011000101_1111n))
            // `1111_1110111_11101101_1110110011_11101100101_11101100100_111011000111_1110110001101_1110110001100`...
            x(0x0FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFD4n,
                vec(0x66n)(0b1111_1110111_11101101_1110110011_11101100101_11101100100_111011000111_1110110001101_1110110001100_1110110001100n))
            // ...
            x(0x0FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFDCn,
                vec(0x5Dn)(0b1111_1110111_11101101_1110110011_11101100101_11101100100_111011000111_1110110001101_1110110001100_1111n))
            // `1111_1110111_11101101_1110110011_11101100101_11101100100_111011000111_1110110001101`...
            x(0x0FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFDDn,
                vec(0x59n)(0b1111_1110111_11101101_1110110011_11101100101_11101100100_111011000111_1110110001101_1110110001101n))
            // ...
            x(0x0FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFE4n,
                vec(0x50n)(0b1111_1110111_11101101_1110110011_11101100101_11101100100_111011000111_1110110001101_1111n))
            // `1111_1110111_11101101_1110110011_11101100101_11101100100_111011000111`...
            x(0x0FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFE5n,
                vec(0x4Bn)(0b1111_1110111_11101101_1110110011_11101100101_11101100100_111011000111_111011000111n))
            // ...
            x(0x0FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFEBn,
                vec(0x43n)(0b1111_1110111_11101101_1110110011_11101100101_11101100100_111011000111_1111n))
            // `1111_1110111_11101101_1110110011_11101100101_11101100100`...
            x(0x0FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFECn,
                vec(0x3En)(0b1111_1110111_11101101_1110110011_11101100101_11101100100_11101100100n))
            // ...
            x(0x0FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFF1n,
                vec(0x37n)(0b1111_1110111_11101101_1110110011_11101100101_11101100100_1111n))
            // `1111_1110111_11101101_1110110011_11101100101`...
            x(0x0FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFF2n,
                vec(0x33n)(0b1111_1110111_11101101_1110110011_11101100101_11101100101n))
            // ...
            x(0x0FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFF6n,
                vec(0x2Cn)(0b1111_1110111_11101101_1110110011_11101100101_1111n))
            // ...
            x(0x0FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFF6n,
                vec(0x2Cn)(0b1111_1110111_11101101_1110110011_11101100101_1111n))
            // `1111_1110111_11101101_1110110011`...
            x(0x0FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFF7n,
                vec(0x27n)(0b1111_1110111_11101101_1110110011_1110110011n))
            // ...
            x(0x0FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFAn,
                vec(0x21n)(0b1111_1110111_11101101_1110110011_1111n))
            // `1111_1110111_11101101`...
            x(0x0FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFBn,
                vec(0x1Bn)(0b1111_1110111_11101101_11101101n))
            // ...
            x(0x0FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFDn,
                vec(0x17n)(0b1111_1110111_11101101_1111n))
            // `1111_1110111`...
            x(0x0FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFEn,
                vec(0x12n)(0b1111_1110111_1110111n))
            x(0x0FF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFFn,
                vec(0x0Fn)(0b1111_1110111_1111n))
            // `1111`...
            x(0x100_0000_0000_0000_0000_0000_0000_0000_0000n,
                vec(0x08n)(0b1111_1111n))
        }
    }
}
