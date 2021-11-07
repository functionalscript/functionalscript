const lib = require('../lib')
const iter = require('../lib/iterable')

/**
 * @typedef {{
 *  package: string[],
 *  module: string[],
 * }} GlobalId
 */

/**
 * @typedef {{
 *  packages: Packages
 *  module: Module
 * }} Package
 */

/** 
 * @typedef {{ 
 *  modules: (_: string) => undefined|Module,
 *  source: string,
 *  exports: unknown,
 *  index: number,
 * }} Module 
 */

/** @typedef {(_: string) => undefined|Package|Packages} Packages */

/** @type {lib.Reducer<string, string[]>} */
const pathNorm = {
    merge: path => item =>
        ['', '.'].includes(item) ?
            path :
        item === '..' ?
            path.slice(0, -1) :
            [...path, item],
    init: []
}

module.exports = {
    /** @type {(_: string[]) => boolean} */
    isRelative: localId => ['.', '..'].includes(localId[0]),
    pathNorm: iter.reduce(pathNorm),
}