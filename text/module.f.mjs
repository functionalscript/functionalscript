// @ts-self-types="./module.f.d.mts"
import list, * as List from '../types/list/module.f.mjs'
const { flatMap } = list

/** @typedef {ItemThunk|ItemArray} Block */

/** @typedef {readonly Item[]} ItemArray */

/** @typedef {() => List.List<Item>} ItemThunk */

/** @typedef {string|ItemArray|ItemThunk} Item */

/** @type {(indent: string) => (text: Block) => List.List<string>} */
export const flat = indent => {

    /** @type {(prefix: string) => (text: Block) => List.List<string>} */
    const f = prefix => {
        /** @type {(item: Item) => List.List<string>} */
        const g = item => typeof (item) === 'string' ? [`${prefix}${item}`] : f(`${prefix}${indent}`)(item)
        return flatMap(g)
    }

    return f('')
}

/** @type {(type: string) => (name: string) => (body: Block) => Block} */
export const curly = type => name => body => [`${type} ${name}`, '{', body, '}']
