const { compose } = require("../function")

/**
 * @template T
 * @typedef {Result<T> | Lazy<T>} Sequence
 */

/**
 * @template T
 * @typedef {FirstAndTail<T> | undefined} Result
 */

/**
 * @template T
 * @typedef {readonly[T, Sequence<T>]} FirstAndTail
 */

/**
 * @template T
 * @typedef {() => Sequence<T>} Lazy
 */

const empty = undefined

/** @type {<T>(sequence: Sequence<T>) => Result<T>} */
const next = sequence => {
    let i = sequence
    while (true) {
        if (typeof i !== 'function') { return i }
        i = i()
    }
}

/** @type {<T, A>(f: (value: Result<T>) => Sequence<A>) => (source: Sequence<T>) => Sequence<A>} */
const unwrap = f => source => {
    if (typeof source === 'function') { return () => unwrap(f)(source()) }
    return f(source)
}

/** @type {<T>(array: readonly T[]) => Sequence<T>} */
const fromArray = array => {
    /** @typedef {typeof array extends readonly(infer T)[] ? T : never} T */
    /** @type {(index: number) => Sequence<T>} */
    const f = index => {
        if (array.length <= index) { return undefined }
        return [array[index], () => f(index + 1)]
    }
    return f(0)
}

/** 
 * @template T
 * @template A
 * @typedef {(prior: A) => (value: T) => Sequence<A>} Operator
 */

/** @type {<T, A>(operator: Operator<T, A>) => (init: A) => (source: Sequence<T>) => Sequence<A>} */
const apply = operator => {

    /** @typedef {typeof operator extends Operator<infer T, infer A> ? [T, A] : never} TA */
    /** @typedef {TA[0]} T */
    /** @typedef {TA[1]} A */

    /** @type {(sourceTail: Sequence<T>) => (sequence: Sequence<A>) => Sequence<A>} */
    const f2 = sourceTail => {

        /** @type {(first: A) => (result: Result<A>) => Sequence<A>} */
        const g3 = first => result => {
            if (result === undefined) { return () => apply(operator)(first)(sourceTail) }
            const [second, resultTail] = result
            return [first, () => g2(second)(resultTail)]
        }

        const g2 = compose(g3)(unwrap)

        /** @type {(result: Result<A>) => Sequence<A>} */
        const g1 = result => {
            if (result === undefined) { return undefined }
            const [first, resultTail] = result
            return g2(first)(resultTail)
        }

        return unwrap(g1)
    }

    /** @type {(init: A) => (source: Result<T>) => Sequence<A>} */
    const f1 = init => source => {
        if (source === undefined) { return undefined }
        const [first, sourceTail] = source
        return f2(sourceTail)(operator(init)(first))
    }

    return compose(f1)(unwrap)
}

/** @type {<T>(sequence: Sequence<T>) => Iterable<T>} */
const iterable = sequence => ({
    *[Symbol.iterator]() {
        let i = sequence
        while (true) {
            if (i === undefined) { return }
            if (typeof i === 'function') {
                i = i()
            } else {
                const [first, tail] = i
                yield first
                i = tail
            }
        }
    }
})

/** @type {(count: number) => Sequence<number>} */
const countdown = count => {
    if (count <= 0) { return empty }
    const n = count - 1
    return [n, () => countdown(n)]
}

/** @type {<T>(...array: readonly T[]) => Sequence<T>} */
const list = (...array) => fromArray(array)

module.exports = {
    /** @readonly */
    empty,
    /** @readonly */
    next,
    /** @readonly */
    apply,
    /** @readonly */
    fromArray,
    /** @readonly */
    iterable,
    /** @readonly */
    countdown,
    /** @readonly */
    list,
}
