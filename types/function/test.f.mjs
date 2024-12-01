import _ from './module.f.mjs'

const { fn } = _

export default () => {
    /** @type {(x: string) => readonly[string]} */
    const f = x => [x]
    /** @type {(x: readonly[string]) => readonly[number]} */
    const g = ([x]) => [x.length]
    /** @type {(x: readonly[number]) => number} */
    const w = ([x]) => x

    const r = fn(f).then(g).then(w).result

    const result = r('hello')
    if (result !== 5) { throw r }
}
