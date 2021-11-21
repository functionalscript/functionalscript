/** @type {<I, X>(_: (_: I) => X) => <O>(_: (_: X) => O) => (_: I) => O} */
const pipe = g => f => x => f(g(x))

module.exports = {
    /** @readonly */
    pipe,
}