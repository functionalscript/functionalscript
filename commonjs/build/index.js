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
 *  readonly packageGet: package_.Get
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

    /** @type {(buildSet: stringSet.StringSet) => (moduleId: module_.Id) => (source: string) => (moduleMap: M) => Result<M>} */
    const build = buildSet => moduleId => {
        const moduleIdStr = module_.idToString(moduleId)
        const buildSet1 = stringSet.set(moduleIdStr)(buildSet)
        /** @type {function_.Require<readonly[map.Map<string>, M]>} */
        const require_ = p => ([requireMap, m]) => {
            const r = path.parseAndFind(packageGet)(moduleId)(p)
            const requireMap1 = map.set(p)(moduleIdStr)(requireMap)
            /** @type {(e: unknown) => function_.Result<readonly[map.Map<string>, M]>} */
            const error = e => [['error', 'file not found'], [requireMap1, m]]
            if (r === undefined) { return error('file not found') }
            if (stringSet.contains(module_.idToString(r.id))(buildSet1)) { return error('circular reference') }
            const [state, m1] = build(buildSet1)(r.id)(r.source)(m)
            return [state[0] === 'error' ? state : ['ok', state[1].exports], [requireMap1, m1]]
        }
        return source => moduleMap => {
            /** @type {(s: module_.State) => (m: M) => Result<M>} */
            const set = s => m => [s, moduleMapInterface.set(moduleIdStr)(s)(m)]
            /** @type {(e: module_.Error) => (m: M) => Result<M>} */
            const error = e => set(['error', e])
            // check compilation
            const j = compile(source)
            if (j[0] === 'error') { return error(['compilation error', j[1]])(moduleMap) }
            // build
            const [r, [requireMap, moduleMap2]] = j[1](require_)([undefined, moduleMap])
            const x = r[0] === 'error' ?
                error(['runtime error', r[1]]) :
                set(['ok', { exports: r[1], requireMap: object.fromMap(requireMap) }])
            return x(moduleMap2)
        }
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
        return (source === undefined ? notFound : build(undefined)(moduleId)(source))(moduleMap)
    }
    return f
}

module.exports = {
    /** @readonly */
    getOrBuild,
}
