const list = require('../list/module.f.cjs')
const { flat } = list
const { map } = require('../nullable/module.f.cjs')
const _ = require('./types/module.f.cjs')

/** @type {<T>(node: _.Node<T>) => list.Thunk<T>} */
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

/** @type {<T>(tree: _.Tree<T>) => list.List<T>} */
const values = map(nodeValues)

module.exports = {
    /** @readonly */
    empty: undefined,
    /** @readonly */
    find: require('./find/module.f.cjs'),
    /** @readonly */
    remove: require('./remove/module.f.cjs'),
    /** @readonly */
    set: require('./set/module.f.cjs'),
    /** @readonly */
    values,
}
