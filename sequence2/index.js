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

/** @type {<T, C>(sequence: SubSequence<T, C>) => SubSequenceResult<T, C>}*/
const next = sequence => {
    let i = sequence()
    while (true) {
        if (typeof i !== 'function') { return i }
        i = i()
    }
}

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
    const result = next(sequence)
    if (result.length === 1) { return [undefined] }
    const [first, tail] = result
    return operatorConcat(operator(first))(tail)
}

module.exports = {
    /** @readonly */
    apply,
}
