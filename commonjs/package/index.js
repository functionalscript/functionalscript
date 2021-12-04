const json = require('../../json')
const dep = require('./dependencies')

/** 
 * @typedef {{
 *  readonly version: string
 *  readonly dependencies?: dep.Dependencies
 * }} Package 
 */

/** @type {(j: json.Unknown) => j is Package} */
const isPackage = j => {
    if (!json.isObject(j)) { return false }
    if (typeof j.version !== 'string') { return false }
    if (!dep.isDependencies(j.dependencies)) { return false }
    return true
}

module.exports = {
    /** @readonly */
    isPackage,
}
