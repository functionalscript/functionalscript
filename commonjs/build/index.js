const package_ = require('../package')
const module_ = require('../module')
const { todo } = require('../../dev')

/**
 * @template M
 * @typedef {{
 *  readonly pagkageGet: package_.Get
 *  readonly moduleMapInterface: module_.MapInterface<M>
 *  readonly moduleId: module_.Id
 *  readonly moduleMap: M
 * }} Config
 */

/** 
 * @template M
 * @typedef {readonly[module_.State, M]} Result 
 */

/** 
 * @type {(packageGet: package_.Get) =>
 *  <M>(moduleMapInterface: module_.MapInterface<M>) =>
 *  (moduleId: module_.Id) =>
 *  (moduleMap: M) =>
 *  Result<M>
 * } 
 */
const getOrBuild = packageGet => modueMapInterface => moduleId => moduleMap => todo()

module.exports = {
    /** @readonly */
    getOrBuild,
}
