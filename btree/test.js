const btree = require('.')
const { setVisitor, values: valuesList } = btree
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
    let _0 = ['a']
    _0 = set(_0)('b')
    _0 = set(_0)('c')
    _0 = set(_0)('d')
    _0 = set(_0)('e')
    _0 = set(_0)('f')
    //
    {
        /** @type {import('../sequence').Result<string>} */
        let _1 = list.next(valuesList(_0))
        while (_1 !== undefined) {
            _1 = list.next(_1[1])
        }
    }
}

test()