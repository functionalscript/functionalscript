import type * as package_ from '../package/module.f.ts'
import {
    idToString,
    dir,
    type MapInterface,
    type Id,
    type State,
    type Error,
} from '../module/module.f.ts'
import type * as function_ from '../module/function/module.f.ts'
import { empty as mapEmpty, setReplace, type Map } from '../../types/map/module.f.ts'
import * as object from '../../types/object/module.f.ts'
const { fromMap } = object
import * as path from '../path/module.f.ts'
const { parseAndFind } = path
import * as stringSet from '../../types/string_set/module.f.ts'
const { set: setSet, contains: setContains, empty: stringSetEmpty } = stringSet

type Config<M> = {
   readonly packageGet: package_.Get
   readonly moduleMapInterface: MapInterface<M>
   readonly moduleId: Id
   readonly moduleMap: M
}

type Result<M> = readonly[State, M]

const notFound = <M>(moduleMap: M): Result<M> =>
    [['error', ['file not found']], moduleMap]

export const getOrBuild
:   (compile: function_.Compile) =>
    (packageGet: package_.Get) =>
    <M>(moduleMapInterface: MapInterface<M>) =>
    (moduleId: Id) =>
    (moduleMap: M) =>
    Result<M>
= compile => packageGet => moduleMapInterface =>  {

    type M = typeof moduleMapInterface extends MapInterface<infer M> ? M : never

    const build
        :   (buildSet: stringSet.StringSet) =>
            (moduleId: Id) =>
            (source: string) =>
            (moduleMap: M) =>
            Result<M>
        = buildSet => moduleId => {

        const moduleIdStr = idToString(moduleId)
        const buildSet1 = setSet(moduleIdStr)(buildSet)
        const moduleDir = dir(moduleId)
        const require_
            : function_.Require<readonly[Map<string>, M]>
            = p => ([requireMap, m]) => {
            const error
                : (e: unknown) => function_.Result<readonly[Map<string>, M]>
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
                : (s: State) => (m: M) => Result<M>
                = s => m => [s, moduleMapInterface.setReplace(moduleIdStr)(s)(m)]
            const error
                : (e: Error) => (m: M) => Result<M>
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

    const f = (moduleId: Id) => (moduleMap: M): Result<M> => {

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
