// @ts-self-types="./module.f.d.mts"

import list, * as List from '../list/module.f.mjs'
const { flat } = list
import n from '../nullable/module.f.mjs'
const { map } = n
import * as _ from './types/module.f.mjs'

/** @type {<T>(node: _.Node<T>) => List.Thunk<T>} */
const nodeValues = node => () => {
    switch (node.length) {
        case 1: case 2: { return node }
        case 3: {
            return flat([
                nodeValues(node[0]),
                [node[1]],
                nodeValues(node[2])
            ])
        }
        default: {
            return flat([
                nodeValues(node[0]),
                [node[1]],
                nodeValues(node[2]),
                [node[3]],
                nodeValues(node[4])
            ])
        }
    }
}

export const empty = null

/** @type {<T>(tree: _.Tree<T>) => List.List<T>} */
export const values = map(nodeValues)
