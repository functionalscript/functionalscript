import * as list from '../../types/list/module.f.mjs'
const { next, fold, reverse, first, flat, toArray, filterMap, isEmpty, concat } = list
import * as string from '../../types/string/module.f.ts'
const { join } = string
import * as Package from '../package/module.f.ts'
import * as Module from '../module/module.f.ts'

type Items = readonly string[]

type LocalPath = {
    readonly external: boolean
    readonly dir: boolean
    readonly items: Items
}

const split
    : (path: string) => readonly string[]
    = path => path.split('/')

type OptionList = readonly[list.List<string>] | null

const normItemsOp
    : (items: string) => (prior: OptionList) => OptionList
    = first => prior => {
    if (prior === null) { return null }
    const tail = prior[0]
    switch (first) {
        case '': case '.': { return prior }
        case '..': {
            const result = next(tail)
            if (result === null) { return null }
            return [result.tail]
        }
        default: {
            return [{ first, tail }]
        }
    }
}

const normItems
    : (items: list.List<string>) => OptionList
    = items => {
    const result = fold(normItemsOp)([list.empty])(items)
    return result === null ? result : [reverse(result[0])]
}

const firstNull = first(null)

export const parseLocal
    : (local: string) => (path: string) => LocalPath|null
    = local => {
    const fSeq
        : (path: string) => readonly[boolean, boolean, list.List<string>]
        = path => {
        const pathSeq = split(path)
        const dir = [null, '', '.', '..'].includes(pathSeq[pathSeq.length - 1])
        return (['.', '..'] as readonly (string|null)[]).includes(firstNull(pathSeq)) ?
            [false, dir, flat([split(local), pathSeq])] :
            [true, dir, pathSeq]
    }
    // /** @type {(path: string) => LocalPath|null} */
    return path => {
        const [external, dir, items] = fSeq(path)
        const n = normItems(items)
        if (n === null) { return null }
        return {
            external,
            dir,
            items: toArray(n[0])
        }
    }
}

type IdPath = readonly[string, list.List<string>]

/** @type {} */
const variants
    : (prior: readonly[string|null, list.List<string>]) => list.Thunk<IdPath>
    = prior => () => {
    const [a, b] = prior
    const r = next(b)
    if (r === list.empty) { return list.empty }
    const { first, tail } = r
    const n
        : IdPath
        = [a === null ? first : `${a}/${first}`, tail]
    return { first: n, tail: variants(n) }
}

const mapDependency
    : (d: (local: string) => string|null) => (p: IdPath) => IdPath|null
    = d => ([external, internal]) => {
    const id = d(external)
    return id === null ? null : [id, internal]
}

type Path = {
    readonly package: string,
    readonly items: Items,
    readonly dir: boolean,
}

/**
 * @type {}
 */
export const parseGlobal
    :   (d: (local: string) => string|null) =>
        (dir: boolean) =>
        (items: list.List<string>) =>
        Path|null
    = dependencies =>
{
    const fMap = filterMap(mapDependency(dependencies))
    return dir => items => {
        const v = variants([null, items])
        const r = firstNull(fMap(v))
        if (r === null) { return null }
        return { package: r[0], items: toArray(r[1]), dir }
    }
}

/**
 * @type { }
 */
export const parse
    :   (packageId: string) =>
        (dependencies: (local: string) => string|null) =>
        (local: string) =>
        (path: string) =>
        Path|null
    = packageId => dependencies => {
    const pg = parseGlobal(dependencies)
    return local => path => {
        const parsed = parseLocal(local)(path)
        if (parsed === null) { return null }
        const {external, dir, items } = parsed
        if (!external) { return { package: packageId, items, dir } }
        return pg(dir)(items)
    }
}

type FoundResult = {
    readonly id: Module.Id
    readonly source: string
}

type Result = FoundResult| null

export const parseAndFind
    :   (packageGet: Package.Get) =>
        (moduleId: Module.Id) =>
        (path: string) =>
        Result
    = packageGet => moduleId => path => {
    const currentPack = packageGet(moduleId.package)
    if (currentPack === null) { return null }
    const p = parse(moduleId.package)(currentPack.dependency)(moduleId.path.join('/'))(path)
    if (p === null) { return null }
    const pack = packageGet(p.package)
    if (pack === null) { return null }
    const tryFile
        : (file: string) => FoundResult | null
        = file => {
        const source = pack.file(file)
        return source === null ? null : { id: { package: p.package, path: file.split('/') }, source }
    }
    const file = p.items.join('/')
    const indexJs = join('/')(concat(p.items)(['index.js']))
    const fileList = p.dir || isEmpty(p.items) ? [indexJs] : [file, `${file}.js`, indexJs]
    return firstNull(filterMap(tryFile)(fileList))
}
