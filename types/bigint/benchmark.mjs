const log2 = v => {
    if (v <= 0n) { return -1n }
    let result = 31n
    let i = 32n
    while (true) {
        const n = v >> i
        if (n === 0n) {
            // overshot
            break
        }
        v = n
        result += i
        i <<= 1n
    }
    // We know that `v` is not 0 so it doesn't make sense to check `n` when `i` is 0.
    // Because of this, We check if `i` is greater than 32 before we divide it by 2.
    while (i !== 32n) {
        i >>= 1n
        const n = v >> i
        if (n !== 0n) {
            result += i
            v = n
        }
    }
    return result - BigInt(Math.clz32(Number(v)))
}

const oldLog2 = v => {
    if (v <= 0n) { return -1n }
    let result = 0n
    let i = 1n
    while (true) {
        const n = v >> i
        if (n === 0n) {
            // overshot
            break
        }
        v = n
        result += i
        i <<= 1n // multiple by two
    }
    // We know that `v` is not 0 so it doesn't make sense to check `n` when `i` is 0.
    // Because of this, We check if `i` is greater than 1 before we divide it by 2.
    while (i !== 1n) {
        i >>= 1n
        const n = v >> i
        if (n !== 0n) {
            result += i
            v = n
        }
    }
    return result
}

const stringLog2 = v => BigInt(v.toString(2).length) - 1n

const stringHexLog2 = v => {
    const len = (BigInt(v.toString(16).length) - 1n) << 2n
    const x = v >> len
    return len + 31n - BigInt(Math.clz32(Number(x)))
}

const string32Log2 = v => {
    const len = (BigInt(v.toString(32).length) - 1n) * 5n
    const x = v >> len
    return len + 31n - BigInt(Math.clz32(Number(x)))
}

const mathLog2 = v => {
    if (v <= 0n) { return -1n }
    let result = -1n
    let i = 1023n
    while (true) {
        const n = v >> i
        if (n === 0n) {
            // overshot
            break
        }
        v = n
        result += i
        i <<= 1n
    }
    // We know that `v` is not 0 so it doesn't make sense to check `n` when `i` is 0.
    // Because of this, We check if `i` is greater than 32 before we divide it by 2.
    while (i !== 1023n) {
        i >>= 1n
        const n = v >> i
        if (n !== 0n) {
            result += i
            v = n
        }
    }
    const x = BigInt(Math.log2(Number(v)) | 0)
    return result + x + (v >> x)
}

const ylog2 = v => {
    if (v <= 0n) { return -1n }

    //
    // 1. Fast Doubling.
    //

    let result = -1n
    // `bigints` higher than 2**1023 may lead to `Inf` during conversion to `number`.
    // For example: `Number((1n << 1024n) - (1n << 970n)) === Inf`.
    let i = 0x400n
    while (true) {
        const n = v >> i
        if (n === 0n) {
            // overshot
            break
        }
        v = n
        result += i
        i <<= 1n
    }

    //
    // 2. Binary Search.
    //

    // We know that `v` is not 0 so it doesn't make sense to check `n` when `i` is 0.
    // Because of this, We check if `i` is greater than 1023 before we divide it by 2.
    while (i !== 0x400n) {
        i >>= 1n
        const n = v >> i
        if (n !== 0n) {
            result += i
            v = n
        }
    }

    //
    // 3. Remainder Phase.
    //

    // We know that `v` is less than `1n << 1023` so we can calculate a remainder using
    // `Math.log2`.
    const nl = Math.log2(Number(v))
    const rem = BigInt(isFinite(nl) ? nl | 0 : 0x400)
    // (v >> rem) is either `0` or `1`, and it's used as a correction for
    // Math.log2 rounding.
    return result + rem + (v >> rem)
}

const log = document.getElementById('log')

const big = f => {
    let e = 1_048_575n
    let c = 1n << e
    for (let i = 0n; i < 1_000; ++i) {
        //
        {
            const x = f(c)
            if (x !== e) { throw [e, x] }
        }
        {
            const x = f(c - 1n)
            if (x !== e - 1n) { throw [e, x] }
        }
        //
        c >>= 1n
        --e
    }
}

const min = a => b => a < b ? a : b

const small = f => {
    let e = 2_000n
    let c = 1n << e
    do {
        {
            const x = f(c)
            if (x !== e) { throw [e, x] }
        }
        for (let j = 1n; j < min(c >> 1n)(1000n); ++j) {
            const x = f(c - j)
            if (x !== e - 1n) { throw [j, e, x] }
        }
        c >>= 1n
        --e
    } while (c !== 0n)
}

const benchmark = t => (s, f) => {
    const start = performance.now()
    t(f)
    const end = performance.now()
    const dif = end - start
    //
    log.innerText += `${s}: ${dif}\n`
}

const run = t => {
    log.innerText += `${t.name}\n`
    const b = benchmark(t)
    b('stringLog2', stringLog2)
    b('stringHexLog2', stringHexLog2)
    b('string32Log2', string32Log2)
    b('oldLog2', oldLog2)
    b('log2', log2)
    b('mathLog2', mathLog2)
    b('ylog2', ylog2)
}

run(big)
run(small)
