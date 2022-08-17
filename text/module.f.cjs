const list = require('../types/list/module.f.cjs')
const { flatMap } = list

/** @typedef {ItemThunk|ItemArray} Block */

/** @typedef {readonly Item[]} ItemArray */

/** @typedef {() => list.List<Item>} ItemThunk */

/** @typedef {string|ItemArray|ItemThunk} Item */

/** @type {(indent: string) => (text: Block) => list.List<string>} */
const flat = indent => {

    /** @type {(prefix: string) => (text: Block) => list.List<string>} */
    const f = prefix => {
        /** @type {(item: Item) => list.List<string>} */
        const g = item => typeof (item) === 'string' ? [`${prefix}${item}`] : f(`${prefix}${indent}`)(item)
        return flatMap(g)
    }

    return f('')
}

/** @type {(type: string) => (name: string) => (body: Block) => Block} */
const curly = type => name => body => [`${type} ${name}`, '{', body, '}']

module.exports = {
    /** @readonly */
    flat,
    /** @readonly */
    curly,
}
