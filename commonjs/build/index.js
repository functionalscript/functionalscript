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
    const moduleIdStr = module_.idToString(moduleId)

    /** @type {() => Result<typeof moduleMap>} */
    const notFound = () => [['error', ['file not found']], moduleMap]
    
    /** @type {(e: module_.Error) => Result<typeof moduleMap>} */
    const error = e => {
        /** @type {module_.State} */
        const state = ['error', e]
        moduleMapInterface.insert(moduleIdStr)(state)
        return [state, moduleMap]
    }

    const m = moduleMapInterface.at(moduleIdStr)(moduleMap)
    if (m !== undefined) { return [m, moduleMap] }
    
    const p = packageGet(moduleId.packageId)
    if (p === undefined) { return notFound() }
    
    const source = p.file(moduleId.path.join('/'))
    if (source === undefined) { return notFound() }
    
    const compileResult = compile(source)
    if (compileResult[0] === 'error') { return error(['compilation error', compileResult[1]]) }
    
    return todo()
}

module.exports = {
    /** @readonly */
    getOrBuild,
}
