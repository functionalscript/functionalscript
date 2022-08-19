const { compose } = require('./module.f.cjs')

{
    /** @type {(x: string) => readonly[string]} */
    const f = x => [x]
    /** @type {(x: readonly[string]) => readonly[number]} */
    const g = ([x]) => [x.length]
    /** @type {(x: readonly[number]) => number} */
    const w = ([x]) => x

    const r = compose(f).and(g).and(w).f

    const result = r('hello')
    if (result !== 5) { throw r }
}

module.exports = {}
