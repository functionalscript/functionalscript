const list = require('../list/index.f.js')
const option = require('../option/index.f.js')
const _ = require('./types/f.js')

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
    find: require('./find/f.js'),
    /** @readonly */
    remove: require('./remove/f.js'),
    /** @readonly */
    set: require('./set/f.js'),
    /** @readonly */
    values,
}
