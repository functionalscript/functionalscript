const package_ = require('../package')
const module_ = require('../module')
const function_ = require('../module/function')
const { todo } = require('../../dev')
const map = require('../../types/map')
const object = require('../../types/object')
const path = require('../path')
const stringSet = require('../../types/stringSet')

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
 * @type {(compile: function_.Compile) =>
 *  (packageGet: package_.Get) =>
 *  <M>(moduleMapInterface: module_.MapInterface<M>) =>
 *  (moduleId: module_.Id) =>
 *  (moduleMap: M) =>
 *  Result<M>
 * }
 */
const getOrBuild = compile => packageGet => moduleMapInterface =>  {
    /** @typedef {typeof moduleMapInterface extends module_.MapInterface<infer M> ? M : never} M */
    /** @type {(moduleId: module_.Id) => function_.Require<readonly[map.Map<string>, M]>} */
    const req = moduleId => p => prior => {
        const r = path.parseAndFind(packageGet)(moduleId)(p)
        if (r === undefined) { return [['error', 'file not found'], prior] }
        const [state, m] = build(r.id)(r.source)(prior[1])
        return [
            state[0] === 'error' ? state : ['ok', state[1].exports],
            [map.set(p)(module_.idToString(moduleId))(prior[0]), m]
        ]
    }
    /** @type {(moduleId: module_.Id) => (source: string) => (moduleMap: M) => Result<M>} */
    const build = moduleId => source => moduleMap => {
        /** @type {(s: module_.State) => (m: M) => Result<M>} */
        const set = s => m => [s, moduleMapInterface.insert(module_.idToString(moduleId))(s)(m)]
        /** @type {(e: module_.Error) => (m: M) => Result<M>} */
        const error = e => set(['error', e])
        // check compilation
        const j = compile(source)
        if (j[0] === 'error') { return error(['compilation error', j[1]])(moduleMap) }
        // build
        const [r, [requireMap, moduleMap2]] = j[1](req(moduleId))([undefined, moduleMap])
        const x = r[0] === 'error' ?
            error(['runtime error', r[1]]) :
            set(['ok', { exports: r[1], requireMap: object.fromMap(requireMap) }])
        return x(moduleMap2)
    }
    /** @type {(moduleId: module_.Id) => (moduleMap: M) => Result<M>} */
    const f = moduleId => moduleMap => {
        const moduleIdStr = module_.idToString(moduleId)
        // check moduleMap
        {
            const m = moduleMapInterface.at(moduleIdStr)(moduleMap)
            if (m !== undefined) { return [m, moduleMap] }
        }
        // check package
        const p = packageGet(moduleId.package)
        if (p === undefined) { return notFound(moduleMap) }
        // check file
        const source = p.file(moduleId.path.join('/'))
        return (source === undefined ? notFound : build(moduleId)(source))(moduleMap)
    }
    return f
}

// /**
//  * @type {(packageGet: package_.Get) =>
//  *  <M>(moduleMapInterface: module_.MapInterface<M>) =>
//  *  (compile: function_.Compile) =>
//  *  (moduleId: module_.Id) =>
//  *  (moduleMapFirst: M) =>
//  *  Result<M>
//  * }
//  */
// const getOrBuild = packageGet => moduleMapInterface => compile => moduleId => {

//     /** @typedef {typeof moduleMapInterface extends module_.MapInterface<infer M> ? M : never} M */

//     const moduleIdStr = module_.idToString(moduleId)

//     /** @type {(e: module_.Error) => (moduleMap: M) => Result<M>} */
//     const error = e => moduleMap => {
//         /** @type {module_.State} */
//         const state = ['error', e]
//         return [state, moduleMapInterface.insert(moduleIdStr)(state)(moduleMap)]
//     }

//     /** @type {function_.Require<readonly[M, map.Map<string>]>} */
//     const require_ = pathStr => prior => {
//         const pathResult = path.parseAndFind(packageGet)(moduleId.packageId)(moduleIdStr)(pathStr)
//         if (pathResult === undefined) { return [['error', `file not found: '${pathStr}'`], prior] }
//         const mId = { packageId: pathResult.package, path: pathResult.file.split('/') }
//         const [state, newMap] = getOrBuild
//             (packageGet)
//             (moduleMapInterface)
//             (compile)
//             (mId)
//             (prior[0])
//         switch (state[0]) {
//             case 'ok': {
//                 const newRequireMap = map.set(pathStr)(module_.idToString(mId))(prior[1])
//                 return [
//                     ['ok', state[1].exports],
//                     [newMap, newRequireMap]
//                 ]
//             }
//             case 'building': {
//                 return todo()
//             }
//             // 'ok'
//             default: {
//                 return todo()
//             }
//         }
//     }

//     return moduleMapFirst => {
//         let moduleMap = moduleMapFirst

//         {
//             const m = moduleMapInterface.at(moduleIdStr)(moduleMap)
//             if (m !== undefined) { return [m, moduleMap] }
//         }

//         const p = packageGet(moduleId.packageId)
//         if (p === undefined) { return notFound(moduleMap) }

//         const source = p.file(moduleId.path.join('/'))
//         if (source === undefined) { return notFound(moduleMap) }

//         const compileResult = compile(source)
//         if (compileResult[0] === 'error') { return error(['compilation error', compileResult[1]])(moduleMap) }

//         const moduleFunction = compileResult[1]

//         moduleMap = moduleMapInterface.insert(moduleIdStr)(['building'])(moduleMap)

//         const [[type, exportsOrError], [newModuleMap, requireMap]] = moduleFunction(require_)([moduleMap, map.empty])
//         moduleMap = newModuleMap

//         {
//             const m = moduleMapInterface.at(moduleIdStr)(moduleMap)
//             if (m === undefined ) { throw 'm === undefined' }
//             if (m[0] !== 'building') { return [m, moduleMap] }
//         }

//         /** @type {module_.State} */
//         const result = type === 'error' ?
//             ['error', ['runtime error', exportsOrError]] :
//             ['ok', {
//                 exports: exportsOrError,
//                 requireMap: object.fromMap(requireMap)
//             }]

//         return [result, moduleMapInterface.insert(moduleIdStr)(result)(moduleMap)]
//     }
// }

module.exports = {
    /** @readonly */
    getOrBuild,
}
