const lib = require('../lib')

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

/** @type {(_: string[]) => (_: string) => string[]} */
const pathAdd = path => item =>
    ['', '.'].includes(item) ?
        path :
    item === '..' ?
        path.slice(0, -1) :
        [...path, item]

module.exports = {
    /** @type {(_: string[]) => boolean} */
    isRelative: localId => ['.', '..'].includes(localId[0]),
    pathNorm: lib.reduce(pathAdd)([])
}