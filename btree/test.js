const btree = require('.')
const { setVisitor, values } = btree
const { cmp } = require('../cmp') 
const list = require('../sequence')

/** @type {(node: btree.Node<string>) => (value: string) => btree.Node<string>} */
const set = node => value => {
    const result = setVisitor(cmp(value))(() => value)(node)
    switch (result[0]) {
        case 'replace': case 'overflow': { return result[1] }
        default: { return node }
    }
}

const test = () => {
    /** @type {btree.Node<string>} */
    let _map = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    _map = set(_map)('d')
    _map = set(_map)('e')
    _map = set(_map)('f')
    //
    {
        /** @type {import('../sequence').Result<string>} */
        let _item = list.next(values(_map))
        while (_item !== undefined) {
            _item = list.next(_item[1])
        }
    }
}

test()