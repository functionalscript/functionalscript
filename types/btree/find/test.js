const _ = require('.')
const list = require('../../list')
const json = require('../../../json')
const { sort } = require('../../object')
const btree = require('..')
const { stringCmp } = require('../../function/compare')

const jsonStr = json.stringify(sort)

// /** @type {(sequence: list.List<json.Unknown>) => string} */
// const arrayStr = sequence => jsonStr(list.toArray(sequence))

/** @type {(node: btree.Node<string>) => (value: string) => btree.Node<string>} */
const set = node => value => {
    const result = btree.setVisitor(stringCmp(value))(node)(() => value)
    switch (result[0]) {
        case 'replace': case 'overflow': { return result[1] }
        default: { return node }
    }
}

/** @type {(r: _.Result<json.Unknown>) => string} */
const str = ([r, path]) => jsonStr([r[0], list.toArray(list.map(x => x[0])(path))])

/** @type {(i: string) => (m: btree.Node<string>) => string} */
const find = i => m => str(_.find(stringCmp(i))(m))

{
    /** @type {btree.Node<string>} */
    let _map = ['1']
    for (let i = 2; i <= 10; i++)
        _map = set(_map)((i * i).toString())
    {
        const s = jsonStr(_map)
        if (s !== '[[["1","100"],"16",["25","36"]],"4",[["49"],"64",["81","9"]]]') { throw s }
    }
    //
    {
        const r = find("0")(_map)
        if (r !== '[0,[0,0]]') { throw r }
    }
    {
        const r = find("1")(_map)
        if (r !== '[1,[0,0]]') { throw r }
    }
    {
        const r = find("10")(_map)
        if (r !== '[2,[0,0]]') { throw r }
    }
    {
        const r = find("100")(_map)
        if (r !== '[3,[0,0]]') { throw r }
    }
    {
        const r = find("12")(_map)
        if (r !== '[4,[0,0]]') { throw r }
    }
    {
        const r = find("16")(_map)
        if (r !== '[1,[0]]') { throw r }
    }
    {
        const r = find("17")(_map)
        if (r !== '[0,[2,0]]') { throw r }
    }
    {
        const r = find("25")(_map)
        if (r !== '[1,[2,0]]') { throw r }
    }
    {
        const r = find("26")(_map)
        if (r !== '[2,[2,0]]') { throw r }
    }
    {
        const r = find("36")(_map)
        if (r !== '[3,[2,0]]') { throw r }
    }
    {
        const r = find("37")(_map)
        if (r !== '[4,[2,0]]') { throw r }
    }
    {
        const r = find("4")(_map)
        if (r !== '[1,[]]') { throw r }
    }
    {
        const r = find("41")(_map)
        if (r !== '[0,[0,2]]') { throw r }
    }
    {
        const r = find("49")(_map)
        if (r !== '[1,[0,2]]') { throw r }
    }
    {
        const r = find("5")(_map)
        if (r !== '[2,[0,2]]') { throw r }
    }
    {
        const r = find("64")(_map)
        if (r !== '[1,[2]]') { throw r }
    }
    {
        const r = find("65")(_map)
        if (r !== '[0,[2,2]]') { throw r }
    }
    {
        const r = find("81")(_map)
        if (r !== '[1,[2,2]]') { throw r }
    }
    {
        const r = find("85")(_map)
        if (r !== '[2,[2,2]]') { throw r }
    }
    {
        const r = find("9")(_map)
        if (r !== '[3,[2,2]]') { throw r }
    }
    {
        const r = find("91")(_map)
        if (r !== '[4,[2,2]]') { throw r }
    }
}