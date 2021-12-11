const package_ = require('../package')
const module_ = require('../module')
const function_ = require('../module/function')
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
 *  (compile: function_.Compile) =>
 *  (moduleId: module_.Id) =>
 *  (moduleMap: M) =>
 *  Result<M>
 * } 
 */
const getOrBuild = packageGet => moduleMapInterface => compile => moduleId => moduleMap => {
    /** @type {() => Result<typeof moduleMap>} */
    const notFound = () => {
        /** @type {module_.State} */
        const state = ['error', ['file not found']]
        moduleMapInterface.insert(moduleIdStr)(state)
        return [state, moduleMap]
    }
    const moduleIdStr = module_.idToString(moduleId)
    const m = moduleMapInterface.at(moduleIdStr)(moduleMap)
    if (m !== undefined) { return [m, moduleMap] }
    const p = packageGet(moduleId.packageId)
    if (p === undefined) { return notFound() }
    const source = p.file(moduleId.path.join('/'))
    if (source === undefined) { return notFound() }
    return todo()
}

module.exports = {
    /** @readonly */
    getOrBuild,
}
