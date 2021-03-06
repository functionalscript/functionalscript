const list = require("../../types/list/main.f.cjs")
const package_ = require("../package/main.f.cjs")
const module_ = require("../module/main.f.cjs")

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

/** @typedef {readonly[list.List<string>] | undefined} OptionList */

/** @type {(items: string) => (prior: OptionList) => OptionList} */
const normItemsOp = first => prior => {
    if (prior === undefined) { return undefined }
    const tail = prior[0]
    switch (first) {
        case '': case '.': { return prior }
        case '..': {
            const result = list.next(tail)
            if (result === undefined) { return undefined }
            return [result.tail]
        }
        default: {
            return [{ first, tail }]
        }
    }
}

/** @type {(items: list.List<string>) => OptionList} */
const normItems = items => {
    const result = list.reduce(normItemsOp)([undefined])(items)
    if (result === undefined) { return result }
    return [list.reverse(result[0])]
}

/** @type {(local: string) => (path: string) => LocalPath|undefined} */
const parseLocal = local => {
    /** @type {(path: string) => readonly[boolean, boolean, list.List<string>]} */
    const fSeq = path => {
        const pathSeq = split(path)
        const dir = [undefined, '', '.', '..'].includes(pathSeq[pathSeq.length - 1])
        return /** @type {readonly (string|undefined)[]} */(['.', '..']).includes(list.first(undefined)(pathSeq)) ?
            [false, dir, list.flat([split(local), pathSeq])] :
            [true, dir, pathSeq]
    }
    /** @type {(path: string) => LocalPath|undefined} */
    const f = path => {
        const [external, dir, items] = fSeq(path)
        const n = normItems(items)
        if (n === undefined) { return undefined }
        return {
            external,
            dir,
            items: list.toArray(n[0])
        }
    }
    return f
}

/** @typedef {readonly[string, list.List<string>]} IdPath */

/** @type {(prior: readonly[string|undefined, list.List<string>]) => list.Thunk<IdPath>} */
const variants = prior => () => {
    const [a, b] = prior
    const r = list.next(b)
    if (r === undefined) { return undefined }
    const { first, tail } = r
    /** @type {IdPath} */
    const n = [a === undefined ? first : `${a}/${first}`, tail]
    return { first: n, tail: variants(n) }
}

/** @type {(d: (local: string) => string|undefined) => (p: IdPath) => IdPath|undefined} */
const mapDependency = d => ([external, internal]) => {
    const id = d(external)
    return id === undefined ? undefined : [id, internal]
}

/**
 * @typedef {{
 *  readonly package: string,
 *  readonly items: Items,
 *  readonly dir: boolean,
 * }} Path
 */

/**
 * @type {(d: (local: string) => string|undefined) =>
 *  (dir: boolean) =>
 *  (items: list.List<string>) =>
 *  Path|undefined}
 */
const parseGlobal = dependencies =>
{
    const filterMap = list.filterMap(mapDependency(dependencies))
    return dir => items => {
        const v = variants([undefined, items])
        const r = list.first(undefined)(filterMap(v))
        if (r === undefined) { return undefined }
        return { package: r[0], items: list.toArray(r[1]), dir }
    }
}

/**
 * @type {(packageId: string) =>
 *  (dependencies: (local: string) => string|undefined) =>
 *  (local: string) =>
 *  (path: string) =>
 *  Path|undefined }
 */
const parse = packageId => dependencies => {
    const pg = parseGlobal(dependencies)
    return local => path => {
        const parsed = parseLocal(local)(path)
        if (parsed === undefined) { return undefined }
        const {external, dir, items } = parsed
        if (!external) { return { package: packageId, items, dir } }
        return pg(dir)(items)
    }
}

/**
 * @typedef {{
 *  readonly id: module_.Id
 *  readonly source: string
 * }| undefined} Result
 */

/**
 * @type {(packageGet: package_.Get) =>
 *  (moduleId: module_.Id) =>
 *  (path: string) =>
 *  Result
 * }
 */
const parseAndFind = packageGet => moduleId => path => {
    const currentPack = packageGet(moduleId.package)
    if (currentPack === undefined) { return undefined }
    const p = parse(moduleId.package)(currentPack.dependency)(moduleId.path.join('/'))(path)
    if (p === undefined) { return undefined }
    const pack = packageGet(p.package)
    if (pack === undefined) { return undefined }
    /** @type {(file: string) => Result } */
    const tryFile = file => {
        const source = pack.file(file)
        return source === undefined ? undefined : { id: { package: p.package, path: file.split('/') }, source }
    }
    const file = p.items.join('/')
    const indexJs = list.join('/')(list.concat(p.items)(['index.js']))
    const fileList = p.dir || list.isEmpty(p.items) ? [indexJs] : [file, `${file}.js`, indexJs]
    return list.first(undefined)(list.filterMap(tryFile)(fileList))
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
