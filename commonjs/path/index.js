const seq = require("../../types/sequence")
const option = require("../../types/option")
const { compose } = require("../../types/function")
const dep = require("../package/dependencies")
const { at } = require("../../types/object")

/** @typedef {readonly string[]} Items */

/** 
 * @typedef {{
 *  readonly external: boolean
 *  readonly dir: boolean
 *  readonly items: Items
 * }} Path 
 */

/** @type {(path: string) => readonly string[]} */
const split = path => path.split('/')

/** @type {(s: undefined|seq.Sequence<string>) => (items: string) => undefined|seq.Sequence<string>} */
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
            return seq.sequence(item)(prior)
        }
    }
}

/** @type {(items: seq.Sequence<string>) => seq.Sequence<string>|undefined} */
const normItems = compose(seq.reduce(normItemsOp)([]))(option.map(seq.reverse))

/** @type {(local: string) => (path: string) => Path|undefined} */
const parse = local => {
    /** @type {(path: string) => readonly[boolean, seq.Sequence<string>]} */
    const fSeq = path => {
        const pathSeq = split(path)
        switch (seq.first(undefined)(pathSeq)) {
            case '.': case '..': { return [false, seq.flat([split(local), pathSeq])] }
            default: { return [true, pathSeq] }
        }
    }
    /** @type {(path: string) => Path|undefined} */
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

/** @typedef {readonly[string, seq.Sequence<string>]} IdPath */

/** @type {(prior: readonly[string|undefined, seq.Sequence<string>]) => seq.Thunk<IdPath>} */
const variants = prior => () => {
    const [a, b] = prior
    const r = seq.next(b)
    if (r === undefined) { return undefined }
    const { first, tail } = r
    /** @type {IdPath} */
    const n = [a === undefined ? first : `${a}/${first}`, tail]
    return { first: n, tail: variants(n) }
}

/** @type {(d: dep.DependencyMapJson) => (p: IdPath) => IdPath|undefined} */
const mapDependency = d => ([external, internal]) => {
    const id = at(external)(d)
    return id === undefined ? undefined : [id, internal]
}

/** @typedef {readonly[string, string]} GlobalPath */

/** @type {(d: dep.DependenciesJson) => (p: Items) => GlobalPath|undefined} */
const idPath = d => p => {
    if (d === undefined) { return undefined }
    const v = variants([undefined, p])
    const valid = seq.first(undefined)(seq.filterMap(mapDependency(d))(v))
    if (valid === undefined) { return undefined }
    const [packId, localId] = valid
    return [packId, seq.join('/')(localId)]
}

module.exports = {
    /** @readonly */
    // split,
    /** @readonly */
    parse,
    /** @readonly */
    idPath,
}
