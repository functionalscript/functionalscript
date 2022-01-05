const _ = require('.')
const btree = require('..')
const s = require('../set')
const { stringCmp } = require('../../function/compare')
const json = require('../../../json')
const { sort } = require('../../object')

/** @type {(node: btree.Node<string>) => (value: string) => btree.Node<string>} */
const set = node => value => s.set(stringCmp(value))(value)(node)

const jsonStr = json.stringify(sort)

{
    /** @type {btree.Node<string>} */
    let _map = ['1']
    for (let i = 2; i <= 38; i++)
        _map = set(_map)((i * i).toString())
    const r = jsonStr(_map)
    if (r !==
        '[[[[["1"],"100",["1024"]],"1089",[["1156"],"121",["1225"]]],' +
        '"1296",' +
        '[[["1369"],"144",["1444"]],"16",[["169"],"196",["225"]]]],' +
        '"25",' +
        '[[[["256"],"289",["324"],"36",["361"]],"4",[["400"],"441",["484"]]],' +
        '"49",' +
        '[[["529"],"576",["625"]],"64",[["676"],"729",["784"]],"81",[["841"],"9",["900","961"]]]]]'
    ) { throw r }
}
