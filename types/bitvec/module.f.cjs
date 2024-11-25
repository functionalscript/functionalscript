const size = (/** @type {bigint} */v) => {
    if (v < 0n) { v = -v }
    if (v === 0n) { return 0n }
    let result = 1n
    let i = 1n
    while (true) {
        const n = v >> i
        if (n === 0n) {
            break
        }
        v = n
        result += i
        i <<= 1n
    }
    while (i !== 0n) {
        i >>= 1n
        const n = v >> i
        if (n !== 0n) {
            result += i
            v = n
        }
    }
    return result
}

module.exports = {
    size,
}