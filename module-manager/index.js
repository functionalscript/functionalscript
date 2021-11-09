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
const internal = pack => {
    /** @type {(_: string[]) => (_: string) => Module|undefined} */
    const readFile = local => name => {
        const source = pack.file([...local, name].join('/'))
        return source === undefined ? undefined : { location: { pack, local }, source}
    }
    return path => {
        /** @type {(_: string[]) => Module|undefined} */
        const read = local => {
            /** @type {(_: [string[], string]) => Module|undefined} */
            const tryFiles = ([head, last]) => {
                /** @type {(_: string) => Module|undefined} */                
                const one = ext => readFile(head)(last + ext)
                return ['.', '..', '', undefined].includes(lib.last(path)) ? undefined : one('.js') ?? one('')
            }
            return lib.optionMap(tryFiles)(lib.splitLast(local)) ?? readFile(local)('index.js')
        }
        return lib.optionMap(read)(pathNorm(path))
    }
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