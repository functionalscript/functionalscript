const btree = require('.')
const { setVisitor, valuesList } = btree
const { cmp } = require('../cmp') 
const list = require('../sequence')

/** @type {(node: btree.Node<string>) => (value: string) => btree.Node<string>} */
const set = node => value => {
    const result = setVisitor(cmp(value))(() => value)(node)
    if ('replace' in result) { return result.replace }
    if ('overflow' in result) { return result.overflow }
    return node
}

const test = () => {
    /** @type {btree.Node<string>} */
    let node = ['a']
    node = set(node)('b')
    node = set(node)('c')
    node = set(node)('d')
    node = set(node)('e')
    node = set(node)('f')
    //
    {
        /** @type {import('../sequence').Result<string>} */
        let result = list.next(valuesList(node))
        while (result !== undefined) {
            result = list.next(result[1])
        }
    }
}

test()