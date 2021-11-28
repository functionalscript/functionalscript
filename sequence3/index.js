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

/** @type {<T, A>(f: (_: Result<T>) => Sequence<A>) => (x: Sequence<T>) => Sequence<A>} */
const unwrap = f => source => {
    if (typeof source === 'function') { return () => unwrap(f)(source()) }
    return f(source)
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
