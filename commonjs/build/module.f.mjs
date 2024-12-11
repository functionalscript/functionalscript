// @ts-self-types="./module.f.d.mts"
import * as package_ from '../package/module.f.mjs'
import * as module from '../module/module.f.mjs'
const { idToString, dir } = module
import * as function_ from '../module/function/module.f.mjs'
import map, * as Map from '../../types/map/module.f.mjs'
const { empty: mapEmpty, setReplace } = map
import object from '../../types/object/module.f.mjs'
const { fromMap } = object
import path from '../path/module.f.mjs'
const { parseAndFind } = path
import stringSet, * as StringSet from '../../types/string_set/module.f.mjs'
const { set: setSet, contains: setContains, empty: stringSetEmpty } = stringSet

/**
 * @template M
 * @typedef {{
 *  readonly packageGet: package_.Get
 *  readonly moduleMapInterface: module.MapInterface<M>
 *  readonly moduleId: module.Id
 *  readonly moduleMap: M
 * }} Config
 */

/**
 * @template M
 * @typedef {readonly[module.State, M]} Result
 */

/** @type {<M>(moduleMap: M) => Result<M>} */
const notFound = moduleMap => [['error', ['file not found']], moduleMap]

/**
 * @type {(compile: function_.Compile) =>
 *  (packageGet: package_.Get) =>
 *  <M>(moduleMapInterface: module.MapInterface<M>) =>
 *  (moduleId: module.Id) =>
 *  (moduleMap: M) =>
 *  Result<M>
 * }
 */
export const getOrBuild = compile => packageGet => moduleMapInterface =>  {
    /** @typedef {typeof moduleMapInterface extends module.MapInterface<infer M> ? M : never} M */

    /**
     * @type {(buildSet: StringSet.StringSet) =>
     *  (moduleId: module.Id) =>
     *  (source: string) =>
     *  (moduleMap: M) =>
     *  Result<M>}
     */
    const build = buildSet => moduleId => {
        const moduleIdStr = idToString(moduleId)
        const buildSet1 = setSet(moduleIdStr)(buildSet)
        const moduleDir = dir(moduleId)
        /** @type {function_.Require<readonly[Map.Map<string>, M]>} */
        const require_ = p => ([requireMap, m]) => {
            /** @type {(e: unknown) => function_.Result<readonly[Map.Map<string>, M]>} */
            const error = e => [['error', e], [requireMap, m]]
            if (moduleDir === null) { return error('file not found') }
            const r = parseAndFind(packageGet)(moduleDir)(p)
            if (r === null) { return error('file not found') }
            const rIdStr = idToString(r.id)
            if (setContains(rIdStr)(buildSet1)) { return error('circular reference') }
            const [state, m1] = build(buildSet1)(r.id)(r.source)(m)
            return [state[0] === 'error' ? state : ['ok', state[1].exports], [setReplace(p)(rIdStr)(requireMap), m1]]
        }
        return source => moduleMap => {
            /** @type {(s: module.State) => (m: M) => Result<M>} */
            const set = s => m => [s, moduleMapInterface.setReplace(moduleIdStr)(s)(m)]
            /** @type {(e: module.Error) => (m: M) => Result<M>} */
            const error = e => set(['error', e])
            // check compilation
            const [kind, result] = compile(source)
            if (kind === 'error') { return error(['compilation error', result])(moduleMap) }
            // build
            const [[state, value], [requireMap, moduleMap2]] = result(require_)([mapEmpty, moduleMap])
            const x = state === 'error' ?
                error(['runtime error', value]) :
                set(['ok', { exports: value, requireMap: fromMap(requireMap) }])
            return x(moduleMap2)
        }
    }
    /** @type {(moduleId: module.Id) => (moduleMap: M) => Result<M>} */
    const f = moduleId => moduleMap => {
        const moduleIdStr = idToString(moduleId)
        // check moduleMap
        {
            const m = moduleMapInterface.at(moduleIdStr)(moduleMap)
            if (m !== null) { return [m, moduleMap] }
        }
        // check package
        const p = packageGet(moduleId.package)
        if (p === null) { return notFound(moduleMap) }
        // check file
        const source = p.file(moduleId.path.join('/'))
        return (source === null ? notFound : build(stringSetEmpty)(moduleId)(source))(moduleMap)
    }
    return f
}
