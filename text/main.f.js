const list = require('../types/list/main.f.js')

/** @typedef {list.List<Item>} Text */

/** @typedef {readonly Item[]} ItemArray */

/** @typedef {() => Text} ItemThunk */

/** @typedef {string|ItemArray|ItemThunk} Item */

/** @type {(indent: string) => (text: Text) => list.List<string>} */
const flat = indent => {
    /** @type {(v: string) => string} */
    const indentFn = v => `${indent}${v}`
    const map = list.map(indentFn)
    /** @type {(item: Item) => list.List<string>} */
    const flatItem = item => typeof(item) === 'string' ? [item] : map(flatText(item))
    const flatText = list.flatMap(flatItem)
    return flatText
}

module.exports = {
    /** @readonly */
    flat,
}
