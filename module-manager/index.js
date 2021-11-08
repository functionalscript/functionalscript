const { todo } = require('../lib')
const lib = require('../lib')
const iter = require('../lib/iterable')

/**
 * @typedef {{
 *  packages: Packages
 *  file: (_: string) => string|undefined
 * }} Package
 */

/**
 * @typedef {{
 *  pack: Package,
 *  local: string[],
 * }} Location
 */

/**
 * @typedef {{
 *  location: Location
 *  source: string
 * }} Module
 */

/** @typedef {(_: string) => undefined|Package|Packages} Packages */

/** @type {lib.Reduce<string, undefined|string[]>} */
const pathNormReduce = {
    merge: path => item =>
        path === undefined ?
            undefined :
        ['', '.'].includes(item) ?
            path :
        item === '..' ?
            (path.length === 0 ? undefined : path.slice(0, -1)) :
            [...path, item],
    init: []
}

/** @type {(_: string[]) => boolean} */
const isRelative = localId => ['.', '..'].includes(localId[0])

const pathNorm = iter.reduce(pathNormReduce)

/** @type {(_: Package) => (_: string[]) => Module|undefined} */
const internal = pack => path => {
    const local = pathNorm(path)
    /** @type {(_: string[]) => Module|undefined} */
    const file = n => {
        const source = pack.file(n.join('/'))
        return source === undefined ? undefined : { location: { pack, local: n.slice(0, -1)}, source}
    }
    /** @type {(_: string[]) => Module|undefined} */
    const norm = n => {
        return n.length === 0 ? 
                file(['index.js']) : 
            ['.', '..', ''].includes(lib.last(path)) ? 
                file([...n, 'index.js']) : 
                file([...n.slice(0, -1), lib.last(n) + '.js']) ?? file(n) ?? file([...n, 'index.js'])
    }
    return local === undefined ? undefined : norm(local)
}

/** @type {(_: Package|Packages|undefined) => (_: string[]) => Module|undefined} */
const externalOrInternal = p => 
    p === undefined ? () => undefined : (typeof p === 'function' ? external(p) : internal(p))

/** @type {(_: Packages) => (_: string[]) => Module|undefined} */
const external = packages => path => 
    path.length === 0 ? undefined : externalOrInternal(packages(path[0]))(path.slice(1))

/** @type {(_: Location) => (_: string[]) => Module|undefined} */
const getModule = ({pack, local}) => path => 
    isRelative(path) ? internal(pack)([...local, ...path]) : external(pack.packages)(path)

module.exports = {
    isRelative,
    pathNorm,
    getModule,
}