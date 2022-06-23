const list = require('../list/main.f.js')
const option = require('../option/main.f.js')
const _ = require('./types/main.f.js')

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
    find: require('./find/main.f.js'),
    /** @readonly */
    remove: require('./remove/main.f.js'),
    /** @readonly */
    set: require('./set/main.f.js'),
    /** @readonly */
    values,
}
