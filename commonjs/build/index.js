const package_ = require('../package')
const module_ = require('../module')
const function_ = require('../module/function')
const { todo } = require('../../dev')
const map = require('../../types/map')
const object = require('../../types/object')
const list = require('../../types/list')

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

/** @type {<M>(moduleMap: M) => Result<M>} */
const notFound = moduleMap => [['error', ['file not found']], moduleMap]

/**
 * @type {(packageGet: package_.Get) =>
 *  <M>(moduleMapInterface: module_.MapInterface<M>) =>
 *  (compile: function_.Compile) =>
 *  (moduleId: module_.Id) =>
 *  (moduleMapFirst: M) =>
 *  Result<M>
 * }
 */
const getOrBuild = packageGet => moduleMapInterface => compile => moduleId => {

    /** @typedef {typeof moduleMapInterface extends module_.MapInterface<infer M> ? M : never} M */

    const moduleIdStr = module_.idToString(moduleId)

    /** @type {(e: module_.Error) => (moduleMap: M) => Result<M>} */
    const error = e => moduleMap => {
        /** @type {module_.State} */
        const state = ['error', e]
        return [state, moduleMapInterface.insert(moduleIdStr)(state)(moduleMap)]
    }

    /** @type {function_.Require<readonly[M, map.Map<string>]>} */
    const require_ = path => ([moduleMap, requireMap]) => {
        return todo()
    }

    return moduleMapFirst => {
        let moduleMap = moduleMapFirst

        {
            const m = moduleMapInterface.at(moduleIdStr)(moduleMap)
            if (m !== undefined) { return [m, moduleMap] }
        }

        const p = packageGet(moduleId.packageId)
        if (p === undefined) { return notFound(moduleMap) }

        const source = p.file(moduleId.path.join('/'))
        if (source === undefined) { return notFound(moduleMap) }

        const compileResult = compile(source)
        if (compileResult[0] === 'error') { return error(['compilation error', compileResult[1]])(moduleMap) }

        const moduleFunction = compileResult[1]

        moduleMap = moduleMapInterface.insert(moduleIdStr)(['building'])(moduleMap)

        const [[type, exportsOrError], [newModuleMap, requireMap]] = moduleFunction(require_)([moduleMap, map.empty])
        moduleMap = newModuleMap

        {
            const m = moduleMapInterface.at(moduleIdStr)(moduleMap)
            if (m === undefined ) { throw 'm === undefined' }
            if (m[0] !== 'building') { return [m, moduleMap] }
        }

        /** @type {module_.State} */
        const result = type === 'error' ?
            ['error', ['runtime error', exportsOrError]] :
            ['ok', {
                exports: exportsOrError,
                requireMap: object.fromMap(requireMap)
            }]

        return [result, moduleMapInterface.insert(moduleIdStr)(result)(moduleMap)]
    }
}

module.exports = {
    /** @readonly */
    getOrBuild,
}
