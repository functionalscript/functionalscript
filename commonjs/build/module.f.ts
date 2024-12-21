import * as package_ from '../package/module.f.ts'
import * as module from '../module/module.f.ts'
const { idToString, dir } = module
import * as function_ from '../module/function/module.f.ts'
import * as map from '../../types/map/module.f.mjs'
const { empty: mapEmpty, setReplace } = map
import * as object from '../../types/object/module.f.mjs'
const { fromMap } = object
import * as path from '../path/module.f.ts'
const { parseAndFind } = path
import * as stringSet from '../../types/string_set/module.f.mjs'
const { set: setSet, contains: setContains, empty: stringSetEmpty } = stringSet

type Config<M> = {
   readonly packageGet: package_.Get
   readonly moduleMapInterface: module.MapInterface<M>
   readonly moduleId: module.Id
   readonly moduleMap: M
}

type Result<M> = readonly[module.State, M]

const notFound
    : <M>(moduleMap: M) => Result<M>
    = moduleMap => [['error', ['file not found']], moduleMap]

export const getOrBuild
    :   (compile: function_.Compile) =>
        (packageGet: package_.Get) =>
        <M>(moduleMapInterface: module.MapInterface<M>) =>
        (moduleId: module.Id) =>
        (moduleMap: M) =>
        Result<M>
    = compile => packageGet => moduleMapInterface =>  {

    type M = typeof moduleMapInterface extends module.MapInterface<infer M> ? M : never

    const build
        :   (buildSet: stringSet.StringSet) =>
            (moduleId: module.Id) =>
            (source: string) =>
            (moduleMap: M) =>
            Result<M>
        = buildSet => moduleId => {

        const moduleIdStr = idToString(moduleId)
        const buildSet1 = setSet(moduleIdStr)(buildSet)
        const moduleDir = dir(moduleId)
        const require_
            : function_.Require<readonly[map.Map<string>, M]>
            = p => ([requireMap, m]) => {
            const error
                : (e: unknown) => function_.Result<readonly[map.Map<string>, M]>
                = e => [['error', e], [requireMap, m]]
            if (moduleDir === null) { return error('file not found') }
            const r = parseAndFind(packageGet)(moduleDir)(p)
            if (r === null) { return error('file not found') }
            const rIdStr = idToString(r.id)
            if (setContains(rIdStr)(buildSet1)) { return error('circular reference') }
            const [state, m1] = build(buildSet1)(r.id)(r.source)(m)
            return [state[0] === 'error' ? state : ['ok', state[1].exports], [setReplace(p)(rIdStr)(requireMap), m1]]
        }
        return source => moduleMap => {
            const set
                : (s: module.State) => (m: M) => Result<M>
                = s => m => [s, moduleMapInterface.setReplace(moduleIdStr)(s)(m)]
            const error
                : (e: module.Error) => (m: M) => Result<M>
                = e => set(['error', e])
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

    const f
        : (moduleId: module.Id) => (moduleMap: M) => Result<M>
        = moduleId => moduleMap => {

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
