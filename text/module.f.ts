import * as list from '../types/list/module.f.mjs'
const { flatMap } = list

export type Block = ItemThunk|ItemArray

type ItemArray = readonly Item[]

type ItemThunk = () => list.List<Item>

export type Item = string|ItemArray|ItemThunk

export const flat
    : (indent: string) => (text: Block) => list.List<string>
    = indent => {

    const f
        : (prefix: string) => (text: Block) => list.List<string>
        = prefix => {
        const g
            : (item: Item) => list.List<string>
            = item => typeof (item) === 'string' ? [`${prefix}${item}`] : f(`${prefix}${indent}`)(item)
        return flatMap(g)
    }

    return f('')
}

export const curly
    : (type: string) => (name: string) => (body: Block) => Block
    = type => name => body => [`${type} ${name}`, '{', body, '}']
