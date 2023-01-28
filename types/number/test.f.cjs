const { sum, min, max, cmp } = require('./module.f.cjs')

module.exports = {
    sum: () => {
        const result = sum([2, 3, 4, 5])
        if (result !== 14) { throw result }
    },
    min: {
        empty: () => {
            const result = min([])
            if (result !== null) { throw result }
        },
        multi: () => {
            const result = min([1, 2, 12, -4, 8])
            if (result !== -4) { throw result }
        }
    },
    max: () => {
        const result = max([1, 2, 12, -4, 8])
        if (result !== 12) { throw result }
    },
    cmp: () => {
        const result = cmp(4)(5)
        if (result !== -1) { throw result }
    },
    standard: () => {
        /** @type {(v: bigint) => void} */
        const eq = v => {
            if (BigInt(Number(v)) != v) { throw v }
        }

        // 0x35 bits.
        //        3                   2                   1                   0
        //   4_3210_FEDC_BA98_7654_3210_FEDC_BA98_7654_3210_FEDC_BA98_7654_3210
        eq(0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n)
        eq(0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0001n)
        eq(0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0010n)
        eq(0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0011n)
        eq(0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0100n)
    }
}