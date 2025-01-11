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

const log = document.getElementById('log')

const benchmark = (s, f) => {
    const start = performance.now()
    //
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
    //
    const end = performance.now()
    const dif = end - start
    //
    log.innerText += `${s}: ${dif}\n`
}

benchmark('stringLog2', stringLog2)
benchmark('stringHexLog2', stringHexLog2)
benchmark('string32Log2', string32Log2)
benchmark('oldLog2', oldLog2)
benchmark('log2', log2)
benchmark('mathLog2', mathLog2)
