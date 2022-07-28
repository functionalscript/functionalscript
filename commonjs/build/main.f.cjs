const package_ = require('../package/main.f.cjs')
const module_ = require('../module/main.f.cjs')
const function_ = require('../module/function/main.f.cjs')
const map = require('../../types/map/main.f.js')
const object = require('../../types/object/main.f.js')
const path = require('../path/main.f.cjs')
const stringSet = require('../../types/stringset/main.f.js')

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

    /**
     * @type {(buildSet: stringSet.StringSet) =>
     *  (moduleId: module_.Id) =>
     *  (source: string) =>
     *  (moduleMap: M) =>
     *  Result<M>}
     */
    const build = buildSet => moduleId => {
        const moduleIdStr = module_.idToString(moduleId)
        const buildSet1 = stringSet.set(moduleIdStr)(buildSet)
        const dir = module_.dir(moduleId)
        /** @type {function_.Require<readonly[map.Map<string>, M]>} */
        const require_ = p => ([requireMap, m]) => {
            /** @type {(e: unknown) => function_.Result<readonly[map.Map<string>, M]>} */
            const error = e => [['error', 'file not found'], [requireMap, m]]
            if (dir === undefined) { return error('file not found') }
            const r = path.parseAndFind(packageGet)(dir)(p)
            if (r === undefined) { return error('file not found') }
            const rIdStr = module_.idToString(r.id)
            if (stringSet.contains(rIdStr)(buildSet1)) { return error('circular reference') }
            const [state, m1] = build(buildSet1)(r.id)(r.source)(m)
            return [state[0] === 'error' ? state : ['ok', state[1].exports], [map.set(p)(rIdStr)(requireMap), m1]]
        }
        return source => moduleMap => {
            /** @type {(s: module_.State) => (m: M) => Result<M>} */
            const set = s => m => [s, moduleMapInterface.set(moduleIdStr)(s)(m)]
            /** @type {(e: module_.Error) => (m: M) => Result<M>} */
            const error = e => set(['error', e])
            // check compilation
            const [kind, result] = compile(source)
            if (kind === 'error') { return error(['compilation error', result])(moduleMap) }
            // build
            const [r, [requireMap, moduleMap2]] = result(require_)([undefined, moduleMap])
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
