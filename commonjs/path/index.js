const seq = require("../../types/list")
const option = require("../../types/option")
const { compose } = require("../../types/function")
const dep = require("../package/dependencies")
const { at } = require("../../types/object")
// const pack = require("../package")

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

/** @type {(s: undefined|seq.List<string>) => (items: string) => undefined|seq.List<string>} */
const normItemsOp = prior => item => {
    if (prior === undefined) { return undefined }
    switch (item) {
        case '': case '.': { return prior }
        case '..': {
            const result = seq.next(prior)
            if (result === undefined) { return undefined }
            return result.tail
        }
        default: {
            return seq.nonEmpty(item)(prior)
        }
    }
}

/** @type {(items: seq.List<string>) => seq.List<string>|undefined} */
const normItems = compose(seq.reduce(normItemsOp)([]))(option.map(seq.reverse))

/** @type {(local: string) => (path: string) => LocalPath|undefined} */
const parseLocal = local => {
    /** @type {(path: string) => readonly[boolean, seq.List<string>]} */
    const fSeq = path => {
        const pathSeq = split(path)
        switch (seq.first(undefined)(pathSeq)) {
            case '.': case '..': { return [false, seq.flat([split(local), pathSeq])] }
            default: { return [true, pathSeq] }
        }
    }
    /** @type {(path: string) => LocalPath|undefined} */
    const f = path => {
        const [external, items] = fSeq(path)
        const n = normItems(items)
        if (n === undefined) { return undefined }
        return {
            external,
            dir: path[path.length - 1] === '/',
            items: seq.toArray(n)
        }
    }
    return f
}

/** @typedef {readonly[string, seq.List<string>]} IdPath */

/** @type {(prior: readonly[string|undefined, seq.List<string>]) => seq.Thunk<IdPath>} */
const variants = prior => () => {
    const [a, b] = prior
    const r = seq.next(b)
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
 *  readonly name: string,
 *  readonly items: Items,
 *  readonly dir: boolean,
 * }} Path
 */

/** @type {(d: (local: string) => string|undefined) => (dir: boolean) => (items: seq.List<string>) => Path|undefined} */
const parseGlobal = d => dir => items => {
    const v = variants([undefined, items])
    const r = seq.first(undefined)(seq.filterMap(mapDependency(d))(v))
    if (r === undefined) { return undefined }
    return { name: r[0], items: seq.toArray(r[1]), dir }
}

/**
 * @type {(name: string) =>
 *  (dependencies: (local: string) => string|undefined) =>
 *  (local: string) =>
 *  (path: string) =>
 *  Path|undefined }
 */
const parse = name => dependencies => local => path => {
    const parsed = parseLocal(local)(path)
    if (parsed === undefined) { return undefined }
    const {external, dir, items} = parsed
    if (!external) { return { name, items, dir } }
    return parseGlobal(dependencies)(dir)(items)
}

module.exports = {
    /** @readonly */
    parseLocal,
    /** @readonly */
    parseGlobal,
    /** @readonly */
    parse,
}
