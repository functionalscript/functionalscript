/**
 * @template T
 * @template C
 * @typedef {readonly[T, SubSequence<T, C>] | readonly[C]} SubSequenceResult
 */

/**
 * @template T
 * @template C
 * @typedef {() => SubSequenceResult<T, C> | SubSequence<T, C>} SubSequence
 */

/**
 * @template T
 * @typedef {SubSequence<T, undefined>} Sequence
 */

/**
 * @template T
 * @template A
 * @typedef {(value: T) => OperatorSequence<T, A>} Operator
 */

/**
 * @template T
 * @template A
 * @typedef {SubSequence<A, Operator<T, A>>} OperatorSequence
 */

/** @typedef {() => () => readonly[OperatorEmpty]} OperatorEmpty */

/** @type {OperatorEmpty} */
const operatorEmpty = () => () => [operatorEmpty]

/** 
 * @template T
 * @typedef {readonly[T, Sequence<T>] | undefined} Result<T> 
 */

/** @type {<T, A>(a: OperatorSequence<T, A>) => (b: Sequence<T>) => Sequence<A>} */
const operatorConcat = a => b => () => {
    const result = a()
    if (typeof result === 'function') return operatorConcat(result)(b)
    if (result.length === 1) { return apply(result[0])(b) }
    const [first, tail] = result
    return [first, operatorConcat(tail)(b)]
}

/** @type {<T, A>(operator: Operator<T, A>) => (sequence: Sequence<T>) => Sequence<A>} */
const apply = operator => sequence => () => {
    if (operator === operatorEmpty) { return [undefined] }
    const result = sequence()
    if (typeof result === 'function') { return apply(operator)(sequence) }
    if (result.length === 1) { return [undefined] }
    const [first, tail] = result
    return operatorConcat(operator(first))(tail)
}

/** @type {() => readonly[undefined]} */
const empty = () => [undefined]

/** @type {<T>(sequence: Sequence<T>) => Result<T>}*/
const next = sequence => {
    let i = sequence()
    while (true) {

        if (typeof i !== 'function') {
            if (i.length === 1) { return undefined }
            return i
        }
        i = i()
    }
}

/** @type {<T>(a: readonly T[]) => (index: number) => Sequence<T>} */
const fromArrayAt = array => index => {
    if (array.length <= index) { return empty }
    return () => [array[index], fromArrayAt(array)(index + 1)]
}

/** @type {<T>(a: readonly T[]) => Sequence<T>} */
const fromArray = array => fromArrayAt(array)(0)

/** @type {<T>(sequence: Sequence<T>) => Iterable<T>} */
const iterable = sequence => ({
    *[Symbol.iterator]() {
        let i = sequence
        while (true) {
            const result = next(i)
            if (result === undefined) { return }
            const [first, tail] = result
            yield first
            i = tail
        }
    }
})

/** @type {<T>(sequence: Sequence<T>) => readonly T[]} */
const array = sequence => Array.from(iterable(sequence))

/** @type {(count: number) => Sequence<number>} */
const countdown = count => {
    if (count <= 0) { return empty }    
    const result = count - 1
    return () => [result, countdown(result)]
}

module.exports = {
    /** @readonly */
    next,
    /** @readonly */
    empty,
    /** @readonly */
    apply,
    /** @readonly */
    fromArray,
    /** @readonly */
    iterable,
    /** @readonly */
    array,
    /** @readonly */
    countdown,
}
