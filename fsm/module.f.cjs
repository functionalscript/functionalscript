const { todo } = require('../dev/module.f.cjs')
const list = require('../types/list/module.f.cjs')
const byteSet = require('../types/byte_set/module.f.cjs')
const object = require('../types/object/module.f.cjs')
const operator = require('../types/function/operator/module.f.cjs')
const map = require('../types/map/module.f.cjs')

/** @typedef {readonly[string, byteSet.ByteSet, string]} Rule */

/** @typedef {list.List<Rule>} Grammar */

/** @typedef {readonly string[]} ByteMap */

/**
 * @typedef {{
 *  readonly[state in string]: ByteMap
 * }} Dfa
 */

/** @type {(faId: string) => string} */
const escape = faId => faId.replaceAll('\\', '\\\\').replaceAll('|', '\\|')

/** @type {(rule: Rule) =>  object.Entry<Rule>} */
const toEntry = r => [escape(r[2]), r]

/** @type {(grammar: Grammar) => Dfa} */
const dfa = grammar =>
{
    const sorted = object.sort(list.map(toEntry)(grammar))
    return todo()
}

/** @type {(byteMap: ByteMap|undefined) => (byteSet: byteSet.ByteSet) => (name: string) => Dfa} */
const merge = byteMap => byteSet => name => todo()

/** @type {operator.FoldT<object.Entry<Rule>, map.Map<ByteMap>} */
const foldOp = r => m => {
    const fromName = escape(r[1][0])
    const toName = r[0]
    const byteMap = merge(map.at(fromName)(m))(r[1][1])(toName)
    return todo()
}

module.exports = {
    /** @readonly */
    escape,
    /** @readonly */
    dfa,
}