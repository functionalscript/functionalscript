const { todo } = require('../dev')

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

/** @type {<T>(a: Sequence<T>) => (b: Sequence<T>) => Thunk<T>} */
const concat = a => b => () => {
    if (typeof a === 'function') { return concat(a())(b) }
    if (a === undefined) { return b }
    const [first, tail] = a
    return [first, concat(tail)(b)] 
}

const test1 = () => {
    /** @type {Sequence<number>} */
    let m = undefined
    for (let i = 0; i < 1_000_000; ++i) {
        m = concat(m)([1, undefined])
    }
    return sum(m)
}

const test2 = () => {
    /** @type {Sequence<number>} */
    let m = undefined
    for (let i = 0; i < 1_000_000; ++i) {
        m = concat([1, undefined])(m)
    }
    return sum(m)
}

console.log(test1())
// console.log(test2())
