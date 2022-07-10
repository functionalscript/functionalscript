const list = require('../types/list/main.f.js')

/** @typedef {list.List<Item>} Block */

/** @typedef {readonly Item[]} ItemArray */

/** @typedef {() => Block} ItemThunk */

/** @typedef {string|ItemArray|ItemThunk} Item */

/** @type {(indent: string) => (text: Block) => list.List<string>} */
const flat = indent => {

    /** @type {(n: number) => (text: Block) => list.List<string>} */
    const f = n => {
        /** @type {(item: Item) => list.List<string>} */
        const g = item => typeof (item) === 'string' ? list.concat(list.repeat(indent)(n))([item, '\n']) : f(n + 1)(item)
        return list.flatMap(g)
    }

    return f(0)
}

module.exports = {
    /** @readonly */
    flat,
}
