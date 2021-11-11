const lib = require('../lib')
const iter = require('../lib/iterable')

/** @typedef {(_: string[]) => string|undefined} ReadFile */

/**
 * @typedef {{
 *  id: string[]
 *  packages: Packages
 *  file: ReadFile
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
            lib.head(path) :
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
        const source = pack.file([...local, name])
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
const external = packages => { 
    /** @type {(_: [string, string[]]) => Module|undefined} */
    const defined = ([first, tail]) => externalOrInternal(packages(first))(tail)
    /** @type {(_: string[]) => [string, string[]]|undefined} */
    const splitFirst = lib.splitFirst
    return lib.pipe(splitFirst)(lib.optionMap(defined))
}

/** @type {(_: Location) => (_: string[]) => Module|undefined} */
const getModule = ({pack, local}) => path => 
    isRelative(path) ? internal(pack)([...local, ...path]) : external(pack.packages)(path)

module.exports = {
    isRelative,
    pathNorm,
    getModule,
}