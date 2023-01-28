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
        /** @type {(a: bigint) => (a: bigint) => void} */
        const check = a => b => {
            if (BigInt(Number(a)) != b) { throw [a, b] }
        }

        /** @type {(v: bigint) => void} */
        const eq = v => check(v)(v)

        // 53, 0x35 bits.
        //        3                   2                   1                   0
        //   4_3210_FEDC_BA98_7654_3210_FEDC_BA98_7654_3210_FEDC_BA98_7654_3210
        eq(0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n)
        eq(0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0001n)
        eq(0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0010n)
        eq(0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0011n)
        eq(0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0100n)

        // 54, 0x35+1 bits.
        //           3                   2                   1                   0
        //      4_3210_FEDC_BA98_7654_3210_FEDC_BA98_7654_3210_FEDC_BA98_7654_3210_1
        check(0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0n)
             (0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0n)
        // round down
        check(0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_1n)
             (0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0n)
        // round up
        check(0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0001_1n)
             (0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0010_0n)
        // round down
        check(0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0010_1n)
             (0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0010_0n)

        // 55, 0x35+2 bits.
        //           3                   2                   1                   0
        //      4_3210_FEDC_BA98_7654_3210_FEDC_BA98_7654_3210_FEDC_BA98_7654_3210_12
        // 0_xx: down, down, up
        // 0_00
        check(0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_00n)
             (0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_00n)
        // 0_01 round down
        check(0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_01n)
             (0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_00n)
        // 0_10 round down
        check(0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_10n)
             (0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_00n)
        // 0_11 round up
        check(0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_11n)
             (0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0001_00n)
        // 1_xx: down, up, up
        // 1_00
        check(0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0001_00n)
             (0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0001_00n)
        // 1_01 round down
        check(0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0001_01n)
             (0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0001_00n)
        // 1_10 round up
        check(0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0001_10n)
             (0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0010_00n)
        // 1_11 round up
        check(0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0001_11n)
             (0b1_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0010_00n)
    }
}
