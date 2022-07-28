const list = require('../list/main.f.cjs')
const option = require('../option/main.f.cjs')
const _ = require('./types/main.f.cjs')

/** @type {<T>(node: _.Node<T>) => list.Thunk<T>} */
const nodeValues = node => () => {
    switch (node.length) {
        case 1: case 2: { return node }
        case 3: {
            return list.flat([
                nodeValues(node[0]),
                [node[1]],
                nodeValues(node[2])
            ])
        }
        default: {
            return list.flat([
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
const values = option.map(nodeValues)

module.exports = {
    /** @readonly */
    find: require('./find/main.f.cjs'),
    /** @readonly */
    remove: require('./remove/main.f.cjs'),
    /** @readonly */
    set: require('./set/main.f.cjs'),
    /** @readonly */
    values,
}
