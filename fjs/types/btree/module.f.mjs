/**
 * Core persistent B-tree construction and traversal helpers.
 *
 * @module
 */
import { flat } from '../list/module.f.mjs'
/** @import { List, Thunk } from '../list/module.f.mjs' */
import { map } from '../nullable/module.f.mjs'
/** @import { TNode, Tree } from './types/module.f.mjs' */

/** @type {<T>(node: TNode<T>) => Thunk<T>} */
const nodeValues
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

/** @type {<T>(tree: Tree<T>) => List<T>} */
export const values = map(nodeValues)
