import { flat, type List, type Thunk } from '../list/module.f.ts'
import { map } from '../nullable/module.f.ts'
import type * as _ from './types/module.f.ts'

const nodeValues
    : <T>(node: _.TNode<T>) => Thunk<T>
    = node => () => {
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

export const values
    : <T>(tree: _.Tree<T>) => List<T>
    = map(nodeValues)
