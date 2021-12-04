const { todo } = require('../../../dev')
const json = require('../../../json')
const { isObject } = json
const seq = require('../../../types/sequence')
const path = require('../../path')
const { at } = require('../../../types/object')

/** @typedef {readonly[string, string]} DependencyJson */

/** @typedef {{readonly[k in string]: string}} DependencyMapJson */

/** @typedef {DependencyMapJson|undefined} DependenciesJson */

/** @type {(entry: json.Entry) => boolean} */
const isDependencyJson = ([, v]) => typeof v === 'string'

/** @type {(j: json.Unknown|undefined) => j is DependenciesJson} */
const isDependenciesJson = j => {
    if (j === undefined) { return true }
    if (!json.isObject(j)) { return false }
    return seq.every(seq.map(isDependencyJson)(Object.entries(j)))
}

/** @typedef {readonly[string, seq.Sequence<string>]} IdPath */

/** @type {(prior: readonly[string|undefined, seq.Sequence<string>]) => seq.Thunk<IdPath>} */
const variants = prior => () => {
    const [a, b] = prior
    const r = seq.next(b)
    if (r === undefined) { return undefined }
    const { first, tail } = r
    /** @type {IdPath} */
    const n = [a === undefined ? first : `${a}/${first}`, tail]
    return { first: n, tail: variants(n) }
}

/** @type {(d: DependencyMapJson) => (p: IdPath) => IdPath|undefined} */
const mapDependency = d => ([external, internal]) => {
    const id = at(external)(d)
    if (id === undefined) { return undefined }
    return [id, internal]
}

/** @type {(d: DependenciesJson) => (p: path.Items) => IdPath|undefined} */
const getId = d => p => {
    if (d === undefined) { return undefined }
    const v = variants([undefined, p])
    const x = seq.filterMap(mapDependency(d))(v)
    return seq.first(undefined)(x)
}

module.exports = {
    /** @readonly */
    isDependenciesJson: isDependenciesJson,
}