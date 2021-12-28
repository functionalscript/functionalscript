const btree = require('.')
const { getVisitor, setVisitor, values, concat } = btree
const json = require('../../json')
const { sort } = require('../object')
const { stringCmp } = require('../function/compare')
const list = require('../list')

/** @type {(sequence: list.List<json.Unknown>) => string} */
const stringify = sequence => json.stringify(sort)(list.toArray(sequence))

/** @type {(node: btree.Node<string>) => (value: string) => btree.Node<string>} */
const set = node => value => {
    const result = setVisitor(stringCmp(value))(node)(() => value)
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
    const result = getVisitor(stringCmp('b'))(_map)
    if (result === undefined) { throw result }
}

{
    /** @type {btree.Node<string>} */
    let _map = ['a']
    _map = set(_map)('b')
    _map = set(_map)('c')
    const result = getVisitor(stringCmp('e'))(_map)
    if (result !== undefined) { throw result }
}

{
    /** @type {btree.Node<string>} */
    let _map = ['1']
    for (let i = 2; i <= 10; i++)
        _map = set(_map)((i * i).toString())
    if (_map.length !== 3) { throw _map }
    // console.log(_map)
    let [a,,b] = _map
    let _c = concat(a)(b)
    // console.log(_c)
    if (_c.length !== 3) { throw _c }
    [a,,b] = _c
    _c = concat(a)(b)
    // console.log(_c)
    if (_c.length !== 1) { throw _c }
    let [_r] = _c
    if (_r.length !== 5) { throw _r }
    [a,,b] = _r
    _c = concat(a)(b)
    // console.log(_c)
    if (_c.length !== 3) { throw _c }
    [a,,b] = _c
    _c = concat(a)(b)
    // console.log(_c)
    if (_c.length !== 3) { throw _c }
    [a,,b] = _c
    _c = concat(a)(b)
    // console.log(_c)
    if (_c.length !== 1) { throw _c }
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