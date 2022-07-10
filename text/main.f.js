const list = require('../types/list/main.f.js')

/** @typedef {list.List<Item>} Block */

/** @typedef {readonly Item[]} ItemArray */

/** @typedef {() => Block} ItemThunk */

/** @typedef {string|ItemArray|ItemThunk} Item */

/** @type {(indent: string) => (text: Block) => list.List<string>} */
const flat = indent => {

    /** @type {(prefix: string) => (text: Block) => list.List<string>} */
    const f = prefix => {
        /** @type {(item: Item) => list.List<string>} */
        const g = item => typeof (item) === 'string' ? [`${prefix}${item}`] : f(`${prefix}${indent}`)(item)
        return list.flatMap(g)
    }

    return f('')
}

module.exports = {
    /** @readonly */
    flat,
}
