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

const string32Log2 = n => {
    const i = (BigInt(n.toString(32).length) - 1n) * 5n
    return i + 31n - BigInt(Math.clz32(Number(n >> i)))
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

const mLog2 = Math.log2

const ylog2 = n => {
    let i = -1n
    let j = 0x400n
    while (true) {
        const m = n >> j
        if (m === 0n) {
            // overshot
            break
        }
        n = m
        i += j
        j <<= 1n
    }
    while (j !== 0x400n) {
        j >>= 1n
        const m = n >> j
        if (m !== 0n) {
            i += j
            n = m
        }
    }
    const nl = mLog2(Number(n))
    if (isFinite(nl)) {
        const rem = BigInt(nl | 0)
        i += rem + (n >> rem)
    } else {
        i += 0x400n
    }

    return i
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
    // b('stringLog2', stringLog2)
    // b('stringHexLog2', stringHexLog2)
    b('string32Log2', string32Log2)
    // b('oldLog2', oldLog2)
    // b('log2', log2)
    // b('mathLog2', mathLog2)
    b('ylog2', ylog2)
}

run(big)
run(small)
