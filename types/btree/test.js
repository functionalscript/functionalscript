const btree = require('.')
const { getVisitor, setVisitor, values } = btree
const json = require('../../json')
const { sort } = require('../object')
const { cmp } = require('../function/compare') 
const list = require('../list')

/** @type {(sequence: list.List<json.Unknown>) => string} */
const stringify = sequence => json.stringify(sort)(list.toArray(sequence))

/** @type {(node: btree.Node<string>) => (value: string) => btree.Node<string>} */
const set = node => value => {
    const result = setVisitor(cmp(value))(node)(() => value)
    switch (result[0]) {
        case 'replace': case 'overflow': { return result[1] }
        default: { return node }
    }
}

{
    /** @type {btree.Node<string>} */
    let _map = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    _map = set(_map)('d')
    _map = set(_map)('e')
    _map = set(_map)('f')
    let result = stringify(values(_map))
    if (result !== '["a","b","c","d","e","f"]') { throw result }
}

{
    /** @type {btree.Node<string>} */
    let _map = ['1']
    for(let i = 2; i <= 10; i++)
        _map = set(_map)((i*i).toString())
    let result = stringify(values(_map))
    if (result !== '["1","100","16","25","36","4","49","64","81","9"]') { throw result }
}

{
    /** @type {btree.Node<string>} */
    let _map = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    const result = getVisitor(cmp('b'))(_map)
    if (result === undefined) { throw result }
}

{
    /** @type {btree.Node<string>} */
    let _map = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    const result = getVisitor(cmp('e'))(_map)
    if (result !== undefined) { throw result }
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
        /** @type {list.Result<string>} */
        let _item = list.next(values(_map))
        while (_item !== undefined) {
            _item = list.next(_item.tail)
        }
    }
}

test()