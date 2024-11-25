const size = (/** @type {bigint} */v) => {
    if (v === 0n) { return 0n }
    if (v < 0n) { v = -v }
    let result = 0n
    let i = 0n
    while (true) {
        const n = v >> (1n << i)
        if (n === 0n) {
            break
        }
        v = n
        result += i
        //
        i += 1n
    }
    while (i !== 0n) {
        i -= 1n
        const n = v >> (1n << i)
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