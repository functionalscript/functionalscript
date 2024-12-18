/** @type {readonly[bigint, bigint, bigint, bigint]} */
const k4x16 = [0n, 0n, 0n, 0n]

/** @type {(size: bigint) => (d: bigint) => (n: bigint) => bigint} */
const rotr = size => d => {
    const r = size - d
    const mask = (1n << d) - 1n
    return n => n >> d | (n & mask) << r
}

/**
 * @type {{
 *  readonly size: bigint
 *  readonly k: readonly bigint[]
 * }} Field
 */

/** @type {(init8: bigint) => (w16: bigint) => bigint} */
export const compress = init8 => w16 => {
    let v8 = init8
    // the first run without w calculation.
    //    for (const i of 0..16) {
    //        wi = w[i]
    //        calculate new v8
    //    }
    // others are with w calculation like this:
    //    for (const i of 0..16) {
    //        wi = calculate new w[i] from w
    //        calculate new v8
    //        w[i] = wi
    //    }
    let i = 0
    while (true) {
        let ki = k4x16[i]
        let j = 0n
        while (true) {
            const kij = ki & 0xFFFF_FFFFn
            const wij = w16 & 0xFFFF_FFFFn
            // calculate new v8
            w16 >>= 32n
            if (i !== 3) {
                // calculate new wij

                //
                w16 |= wij << (15n << 5n)
            }
            if (j === 15n) { break }
            ++j
            ki >>= 32n
        }
        if (i === 3) { break }
        ++i
    }
}
