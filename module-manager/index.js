const lib = require('../lib')
const iter = require('../iterable')
const mr = require('../map-reduce')

/** @typedef {(_: string) => string|undefined} ReadFile */

/**
 * @typedef {{
 *  id: string[]
 *  dependencies: Dependencies
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
 *  fileName: string
 *  location: Location
 *  source: string
 * }} Module
 */

/** @typedef {(_: string) => undefined|Package|Dependencies} Dependencies */

/** @type {mr.Operation<string, undefined|string[], undefined|string[]>} */
const pathNormReduce = {
    reduce: path => item =>
        path === undefined ?
            undefined :
        ['', '.'].includes(item) ?
            path :
        item === '..' ?
            lib.head(path) :
            [...path, item],
    init: [],
    result: s => s,
}

/** @type {(_: string[]) => boolean} */
const isRelative = localId => ['.', '..'].includes(localId[0])

const pathNorm = iter.apply(pathNormReduce)

/** @type {(_: Package) => (_: string[]) => Module|undefined} */
const internal = pack => {
    /** @type {(_: string[]) => (_: string) => Module|undefined} */
    const readFile = local => fileName => {
        const source = pack.file([...local, fileName].join('/'))
        return source === undefined ? undefined : { fileName, location: { pack, local }, source}
    }
    return path => {
        /** @type {(_: string[]) => Module|undefined} */
        const read = local => {
            /** @type {(_: [string[], string]) => Module|undefined} */
            const tryFiles = ([head, last]) => {
                /** @type {(_: string) => Module|undefined} */                
                const one = ext => readFile(head)(last + ext)
                return ['.', '..', '', undefined].includes(lib.last(path)) ? undefined : one('') ?? one('.js')
            }
            return lib.optionMap(tryFiles)(lib.splitLast(local)) ?? readFile(local)('index.js')
        }
        return lib.optionMap(read)(pathNorm(path))
    }
}

/** @type {(_: Package|Dependencies|undefined) => (_: string[]) => Module|undefined} */
const externalOrInternal = p => 
    p === undefined ? () => undefined : (typeof p === 'function' ? external(p) : internal(p))

/** @type {(_: Dependencies) => (_: string[]) => Module|undefined} */
const external = packages => { 
    /** @type {(_: [string, string[]]) => Module|undefined} */
    const defined = ([first, tail]) => externalOrInternal(packages(first))(tail)
    /** @type {(_: string[]) => [string, string[]]|undefined} */
    const splitFirst = lib.splitFirst
    return lib.pipe(splitFirst)(lib.optionMap(defined))
}

/** @type {(_: Location) => (_: string) => Module|undefined} */
const getModule = ({pack, local}) => path => {
    const pathArray = path.split('/')
    return isRelative(pathArray) ? internal(pack)([...local, ...pathArray]) : external(pack.dependencies)(pathArray)
}

/** @type {(_: Module) => string} */
const moduleId = module => [...module.location.pack.id, ...module.location.local, module.fileName].join('/') 

module.exports = {
    /** @readonly */
    isRelative,
    /** @readonly */
    pathNorm,
    /** @readonly */
    getModule,
    /** @readonly */
    moduleId,
}