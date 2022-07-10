const list = require('../types/list/main.f.js')

/** @typedef {list.List<Item>} Block */

/** @typedef {readonly Item[]} ItemArray */

/** @typedef {() => Block} ItemThunk */

/** @typedef {string|ItemArray|ItemThunk} Item */

// /** @type {(indent: string) => (text: Block) => list.List<string>} */
// const flat = indent => {

//     /** @type {(n: number) => (text: Block) => list.List<string>} */
//     const f = n => {
//         /** @type {(item: Item) => list.List<string>} */
//         const g = item => typeof (item) === 'string' ? list.flat(list.repeat() prefix, item, '\n'] : f(`${prefix}${indent}`)(item)
//         return list.flatMap(g)
//     }

//     /** @type {(v: string) => string} */
//     const indentFn = v => `${indent}${v}`
//     const map = list.map(indentFn)
//     /** @type {(item: Item) => list.List<string>} */
//     const flatItem = item => typeof (item) === 'string' ? [item] : map(flatText(item))
//     const flatText = list.flatMap(flatItem)
//     return flatText
// }

/** @type {(indent: string) => (text: Block) => list.List<string>} */
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
