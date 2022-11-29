const list = require("../../types/list/module.f.cjs")
const { next, fold, reverse, first, flat, toArray, filterMap, isEmpty, concat } = list
const { join } = require('../../types/string/module.f.cjs')
const package_ = require("../package/module.f.cjs")
const module_ = require("../module/module.f.cjs")

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

/** @typedef {readonly[list.List<string>] | null} OptionList */

/** @type {(items: string) => (prior: OptionList) => OptionList} */
const normItemsOp = first => prior => {
    if (prior === null) { return null }
    const tail = prior[0]
    switch (first) {
        case '': case '.': { return prior }
        case '..': {
            const result = next(tail)
            if (result === list.empty) { return null }
            return [result.tail]
        }
        default: {
            return [{ first, tail }]
        }
    }
}

/** @type {(items: list.List<string>) => OptionList} */
const normItems = items => {
    const result = fold(normItemsOp)([list.empty])(items)
    return result === null ? result : [reverse(result[0])]
}

const firstNull = first(null)

/** @type {(local: string) => (path: string) => LocalPath|null} */
const parseLocal = local => {
    /** @type {(path: string) => readonly[boolean, boolean, list.List<string>]} */
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

/** @typedef {readonly[string, list.List<string>]} IdPath */

/** @type {(prior: readonly[string|null, list.List<string>]) => list.Thunk<IdPath>} */
const variants = prior => () => {
    const [a, b] = prior
    const r = next(b)
    if (r === list.empty) { return list.empty }
    const { first, tail } = r
    /** @type {IdPath} */
    const n = [a === null ? first : `${a}/${first}`, tail]
    return { first: n, tail: variants(n) }
}

/** @type {(d: (local: string) => string|null) => (p: IdPath) => IdPath|undefined} */
const mapDependency = d => ([external, internal]) => {
    const id = d(external)
    return id === null ? undefined : [id, internal]
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
 *  (items: list.List<string>) =>
 *  Path|undefined}
 */
const parseGlobal = dependencies =>
{
    const fMap = filterMap(mapDependency(dependencies))
    return dir => items => {
        const v = variants([null, items])
        const r = firstNull(fMap(v))
        if (r === null) { return undefined }
        return { package: r[0], items: toArray(r[1]), dir }
    }
}

/**
 * @type {(packageId: string) =>
 *  (dependencies: (local: string) => string|null) =>
 *  (local: string) =>
 *  (path: string) =>
 *  Path|undefined }
 */
const parse = packageId => dependencies => {
    const pg = parseGlobal(dependencies)
    return local => path => {
        const parsed = parseLocal(local)(path)
        if (parsed === null) { return undefined }
        const {external, dir, items } = parsed
        if (!external) { return { package: packageId, items, dir } }
        return pg(dir)(items)
    }
}

/**
 * @typedef {{
 *  readonly id: module_.Id
 *  readonly source: string
 * }} FoundResult
 */

/** @typedef {FoundResult| null} Result */

/**
 * @type {(packageGet: package_.Get) =>
 *  (moduleId: module_.Id) =>
 *  (path: string) =>
 *  Result
 * }
 */
const parseAndFind = packageGet => moduleId => path => {
    const currentPack = packageGet(moduleId.package)
    if (currentPack === null) { return null }
    const p = parse(moduleId.package)(currentPack.dependency)(moduleId.path.join('/'))(path)
    if (p === undefined) { return null }
    const pack = packageGet(p.package)
    if (pack === null) { return null }
    /** @type {(file: string) => FoundResult | undefined } */
    const tryFile = file => {
        const source = pack.file(file)
        return source === null ? undefined : { id: { package: p.package, path: file.split('/') }, source }
    }
    const file = p.items.join('/')
    const indexJs = join('/')(concat(p.items)(['index.js']))
    const fileList = p.dir || isEmpty(p.items) ? [indexJs] : [file, `${file}.js`, indexJs]
    return firstNull(filterMap(tryFile)(fileList))
}

module.exports = {
    /** @readonly */
    parseLocal,
    /** @readonly */
    parseGlobal,
    /** @readonly */
    parse,
    /** @readonly */
    parseAndFind,
}
