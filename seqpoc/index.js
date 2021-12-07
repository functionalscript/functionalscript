/**
 * @template T
 * @typedef {Result<T> | Thunk<T> } Sequence
 */

/**
 * @template T
 * @typedef {undefined | FirstAndTail<T>} Result
 */

/**
 * @template T
 * @typedef {readonly[T, Sequence<T>]} FirstAndTail
 */

/**
 * @template T
 * @typedef {() => Sequence<T>} Thunk
 */

/** @type {<T>(s: Sequence<T>) => undefined|FirstAndTail<T>} */
const next = s => {
    let i = s 
    while (true) {
        if (typeof i !== 'function') { return i }
        i = i()
    }
}

/** @type {(s: Sequence<number>) => number} */
const sum = a => {
    let result = 0
    let i = a
    while (true) {
        i = next(i)
        if (i === undefined) { return result }
        const [first, tail] = i
        result += first
        i = tail
    }
}

module.exports = {
    /** @readonly */
    next,
    /** @readonly */
    sum,
}
