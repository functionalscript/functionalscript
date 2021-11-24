const array = require('../sequence/array')
const { combine } = require('../function')
const option = require('../option')
const { head, last, splitLast, splitFirst } = array
const iter = require('../sequence/iterable')
const seq = require('../sequence/operator')

/**
 * @template T
 * @typedef {array.Array<T>} Array
 */

/** @typedef {Array<string>} Path */

/** @typedef {(_: string) => string|undefined} ReadFile */

/**
 * @typedef {{
 *  readonly id: Array<string>
 *  readonly dependencies: Dependencies
 *  readonly file: ReadFile
 * }} Package
 */

/**
 * @typedef {{
 *  readonly pack: Package,
 *  readonly local: Array<string>,
 * }} Location
 */

/**
 * @typedef {{
 *  readonly fileName: string
 *  readonly location: Location
 *  readonly source: string
 * }} Module
 */

/** @typedef {(_: string) => undefined|Package|Dependencies} Dependencies */

/** @type {seq.ExclusiveScan<string, undefined|Path>} */
const pathNormReduce = seq.exclusiveScan
    (path => item =>
        path === undefined ?
            undefined :
        ['', '.'].includes(item) ?
            path :
        item === '..' ?
            head(path) :
            [...path, item])
    ([])

/** @type {(_: Array<string>) => boolean} */
const isRelative = localId => ['.', '..'].includes(localId[0])

const pathNorm = iter.reduce(pathNormReduce)

/** @type {(_: Package) => (_: Path) => Module|undefined} */
const internal = pack => {
    /** @type {(_: Path) => (_: string) => Module|undefined} */
    const readFile = local => fileName => {
        const source = pack.file([...local, fileName].join('/'))
        return source === undefined ? undefined : { fileName, location: { pack, local }, source}
    }
    return path => {
        /** @type {(_: Path) => Module|undefined} */
        const read = local => {
            /** @type {(_: readonly[Path, string]) => Module|undefined} */
            const tryFiles = ([head, file]) => {
                /** @type {(_: string) => Module|undefined} */                
                const one = ext => readFile(head)(file + ext)
                return ['.', '..', '', undefined].includes(last(path)) ? undefined : one('') ?? one('.js')
            }
            return option.map(tryFiles)(splitLast(local)) ?? readFile(local)('index.js')
        }
        return option.map(read)(pathNorm(path))
    }
}

/** @type {(_: Package|Dependencies|undefined) => (_: Path) => Module|undefined} */
const externalOrInternal = p => 
    p === undefined ? () => undefined : (typeof p === 'function' ? external(p) : internal(p))

/** @type {(_: Dependencies) => (_: Path) => Module|undefined} */
const external = packages => { 
    /** @type {(_: readonly [string, Path]) => Module|undefined} */
    const defined = ([first, tail]) => externalOrInternal(packages(first))(tail)
    /** @type {(_: Path) => readonly [string, Path]|undefined} */
    const sf = splitFirst
    return combine
        (option.map(defined))
        (sf)        
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
