/** @type {<I, X>(_: (_: I) => X) => <O>(_: (_: X) => O) => (_: I) => O} */
const pipe = g => f => x => f(g(x))

/** @type {<T>(value: T) => T} */
const id = value => value

module.exports = {
    /** @readonly */
    id,
    /** @readonly */
    pipe,
}