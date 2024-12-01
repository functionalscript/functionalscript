import list, * as List from '../../types/list/module.f.mjs'
const { next, fold, reverse, first, flat, toArray, filterMap, isEmpty, concat } = list
import string from '../../types/string/module.f.mjs'
const { join } = string
import * as Package from '../package/module.f.mjs'
import * as Module from '../module/module.f.mjs'

/** @typedef {readonly string[]} Items */

/**
 * @typedef {{
 *  readonly external: boolean
 *  readonly dir: boolean
 *  readonly items: Items
 * }} LocalPath
 */

/** @type {(path: string) => readonly string[]} */
const split = path => path.split('/')

/** @typedef {readonly[List.List<string>] | null} OptionList */

/** @type {(items: string) => (prior: OptionList) => OptionList} */
const normItemsOp = first => prior => {
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

/** @type {(items: List.List<string>) => OptionList} */
const normItems = items => {
    const result = fold(normItemsOp)([list.empty])(items)
    return result === null ? result : [reverse(result[0])]
}

const firstNull = first(null)

/** @type {(local: string) => (path: string) => LocalPath|null} */
const parseLocal = local => {
    /** @type {(path: string) => readonly[boolean, boolean, List.List<string>]} */
    const fSeq = path => {
        const pathSeq = split(path)
        const dir = [null, '', '.', '..'].includes(pathSeq[pathSeq.length - 1])
        return /** @type {readonly (string|null)[]} */(['.', '..']).includes(firstNull(pathSeq)) ?
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

/** @typedef {readonly[string, List.List<string>]} IdPath */

/** @type {(prior: readonly[string|null, List.List<string>]) => List.Thunk<IdPath>} */
const variants = prior => () => {
    const [a, b] = prior
    const r = next(b)
    if (r === list.empty) { return list.empty }
    const { first, tail } = r
    /** @type {IdPath} */
    const n = [a === null ? first : `${a}/${first}`, tail]
    return { first: n, tail: variants(n) }
}

/** @type {(d: (local: string) => string|null) => (p: IdPath) => IdPath|null} */
const mapDependency = d => ([external, internal]) => {
    const id = d(external)
    return id === null ? null : [id, internal]
}

/**
 * @typedef {{
 *  readonly package: string,
 *  readonly items: Items,
 *  readonly dir: boolean,
 * }} Path
 */

/**
 * @type {(d: (local: string) => string|null) =>
 *  (dir: boolean) =>
 *  (items: List.List<string>) =>
 *  Path|null}
 */
const parseGlobal = dependencies =>
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
 * @type {(packageId: string) =>
 *  (dependencies: (local: string) => string|null) =>
 *  (local: string) =>
 *  (path: string) =>
 *  Path|null }
 */
const parse = packageId => dependencies => {
    const pg = parseGlobal(dependencies)
    return local => path => {
        const parsed = parseLocal(local)(path)
        if (parsed === null) { return null }
        const {external, dir, items } = parsed
        if (!external) { return { package: packageId, items, dir } }
        return pg(dir)(items)
    }
}

/**
 * @typedef {{
 *  readonly id: Module.Id
 *  readonly source: string
 * }} FoundResult
 */

/** @typedef {FoundResult| null} Result */

/**
 * @type {(packageGet: Package.Get) =>
 *  (moduleId: Module.Id) =>
 *  (path: string) =>
 *  Result
 * }
 */
const parseAndFind = packageGet => moduleId => path => {
    const currentPack = packageGet(moduleId.package)
    if (currentPack === null) { return null }
    const p = parse(moduleId.package)(currentPack.dependency)(moduleId.path.join('/'))(path)
    if (p === null) { return null }
    const pack = packageGet(p.package)
    if (pack === null) { return null }
    /** @type {(file: string) => FoundResult | null } */
    const tryFile = file => {
        const source = pack.file(file)
        return source === null ? null : { id: { package: p.package, path: file.split('/') }, source }
    }
    const file = p.items.join('/')
    const indexJs = join('/')(concat(p.items)(['index.js']))
    const fileList = p.dir || isEmpty(p.items) ? [indexJs] : [file, `${file}.js`, indexJs]
    return firstNull(filterMap(tryFile)(fileList))
}

export default {
    /** @readonly */
    parseLocal,
    /** @readonly */
    parseGlobal,
    /** @readonly */
    parse,
    /** @readonly */
    parseAndFind,
}
